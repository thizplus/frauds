"""Replay Extractor — อ่าน raw stream → สร้าง per-post extracted.json

Capture layer เก็บ raw GraphQL responses ไว้ใน graphql_stream/
Extractor อ่าน raw → parse → สร้าง extracted.json + manifest ต่อ post
rerun ได้ทุกเมื่อ — raw ไม่เปลี่ยน extracted สร้างใหม่ได้

Usage:
  python -m application.usecases.replay_extractor --run raw/2371935176344747/run_20260525_201652
  python -m application.usecases.replay_extractor --all
  python -m application.usecases.replay_extractor --rerun-version "2026.05.25"
"""
import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from infrastructure.utils.graphql_parser import (
    safe_get, split_multiline_response, detect_response_shape,
    extract_post, parse_comment_batch, extract_comments_from_html,
    merge_comments, ExtractionMetrics,
)

logger = logging.getLogger("replay_extractor")

EXTRACTOR_VERSION = "2026.05.25-4"
SCHEMA_VERSION = 2


def extract_run(run_dir: Path, output_base: Path | None = None) -> dict:
    """Extract ทุก post จาก raw stream ของ 1 run.

    Args:
        run_dir: path to raw/{group_id}/run_{timestamp}/
        output_base: path to extracted/{group_id}/ (default: derived from run_dir)

    Returns:
        run quality report dict
    """
    stream_dir = run_dir / "graphql_stream"
    if not stream_dir.exists():
        logger.error("stream_dir_not_found", extra={"path": str(stream_dir)})
        return {"error": "stream_dir_not_found"}

    # Derive group_id from path: raw/{group_id}/run_{timestamp}
    group_id = run_dir.parent.name
    run_id = run_dir.name

    if output_base is None:
        output_base = Path("extracted") / group_id

    date_str = datetime.now().strftime("%Y-%m-%d")
    output_dir = output_base / date_str

    logger.info("extract_start", extra={
        "run_dir": str(run_dir), "group_id": group_id, "run_id": run_id,
    })

    # Reset metrics
    metrics = ExtractionMetrics()
    # Inject metrics into parser module
    import infrastructure.utils.graphql_parser as parser_module
    parser_module.metrics = metrics

    # === Phase 1: Parse stream → collect posts + per-post comments ===
    all_posts = {}  # post_id → extracted dict
    per_post_comments = {}  # post_id → list of comment dicts
    total_responses = 0
    shape_counts = {}

    chunks = sorted(stream_dir.glob("chunk_*.jsonl"))
    for chunk_path in chunks:
        with open(chunk_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                try:
                    capture = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("invalid_json_line", extra={
                        "chunk": chunk_path.name, "line": line_num,
                    })
                    continue

                response_text = capture.get("response_text", "")
                if not response_text:
                    continue

                total_responses += 1

                # Extract post_id from job_id (e.g. "comment_1496339308516687" → "1496339308516687")
                cap_meta = capture.get("_capture", {})
                job_id = cap_meta.get("job_id", "")
                job_type = cap_meta.get("job_type", "")
                comment_post_id = ""
                if job_id.startswith("comment_"):
                    comment_post_id = job_id.replace("comment_", "")

                # Split multiline FB response
                json_objects = split_multiline_response(response_text)

                for obj in json_objects:
                    shape = detect_response_shape(obj)
                    shape_counts[shape.type] = shape_counts.get(shape.type, 0) + 1

                    # Feed posts
                    if shape.type in ("feed_posts", "story_node"):
                        for node in shape.nodes:
                            pid = node.get("post_id", "")
                            if pid and pid not in all_posts:
                                post = extract_post(node)
                                all_posts[pid] = post

                    # Comment responses → map to post via job_id
                    # ใช้ job_id แยก post ไม่ใช่ shape — เพราะ shape "unknown" อาจมี comments
                    if comment_post_id:
                        batch = parse_comment_batch(obj)
                        if batch:
                            if comment_post_id not in per_post_comments:
                                per_post_comments[comment_post_id] = []
                            per_post_comments[comment_post_id].extend(batch)

    logger.info("parse_complete", extra={
        "total_responses": total_responses,
        "posts_found": len(all_posts),
        "posts_with_comments": len(per_post_comments),
        "shapes": shape_counts,
    })

    # === Phase 1.5: Merge comments per-post (GraphQL + HTML) ===
    html_dir = run_dir / "html_snapshots"
    for pid, post in all_posts.items():
        graphql_comments = per_post_comments.get(pid, [])
        initial_comments = post.get("initial_comments", [])

        # HTML comments from snapshot
        html_comments = []
        html_path = html_dir / f"post_{pid}_initial.html"
        if html_path.exists():
            try:
                html_content = html_path.read_text(encoding='utf-8')
                html_comments = extract_comments_from_html(html_content)
            except Exception:
                pass

        # Merge all sources
        if graphql_comments or html_comments or initial_comments:
            merged = merge_comments(
                graphql_comments=graphql_comments,
                html_comments=html_comments,
                initial_comments=initial_comments,
            )
            post["comments"] = merged
            comment_status = "ok" if merged else "pending"
        else:
            post["comments"] = []
            comment_status = "pending"

        post["_comment_status"] = comment_status

    # === Phase 2: Save per-post extracted.json ===
    posts_saved = 0
    for pid, post in all_posts.items():
        post_dir = output_dir / f"post_{pid}"
        post_dir.mkdir(parents=True, exist_ok=True)

        comment_status = post.pop("_comment_status", "pending")

        # Add extraction metadata
        extracted = {
            "_extraction": {
                "extractor_version": EXTRACTOR_VERSION,
                "schema_version": SCHEMA_VERSION,
                "generated_at": datetime.now().isoformat(),
                "source_run": run_id,
                "source_group": group_id,
            },
            "_status": {
                "capture": "ok",
                "extract": "ok",
                "comment_collection": comment_status,
                "image_download": "pending",
                "ocr": "pending",
            },
            "_quality": _build_post_quality(post, len(post.get("comments", []))),
            **post,
        }

        extracted_path = post_dir / "extracted.json"
        with open(extracted_path, 'w', encoding='utf-8') as f:
            json.dump(extracted, f, ensure_ascii=False, indent=2)

        # Save per-post manifest
        manifest = {
            "post_id": pid,
            "source_run": str(run_dir),
            "extracted_at": datetime.now().isoformat(),
            "extractor_version": EXTRACTOR_VERSION,
            "has_message": bool(post.get("message")),
            "image_count": len(post.get("images", [])),
            "image_count_reported": post.get("image_count_reported", 0),
            "comment_count": post.get("engagement", {}).get("comment_count", 0),
            "initial_comments": len(post.get("initial_comments", [])),
            "is_shared": bool(post.get("attached_story")),
        }
        manifest_path = post_dir / "manifest.json"
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        posts_saved += 1

    # === Phase 3: Save extraction state ===
    state = {
        "last_processed_chunk": len(chunks) - 1,
        "last_processed_line": -1,  # all lines processed
        "posts_extracted": posts_saved,
        "updated_at": datetime.now().isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }
    state_path = run_dir / "extraction_state.json"
    with open(state_path, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    # === Phase 4: Build run quality report ===
    total_posts = len(all_posts)
    quality_report = {
        "run_id": run_id,
        "group_id": group_id,
        "extracted_at": datetime.now().isoformat(),
        "extractor_version": EXTRACTOR_VERSION,

        "posts_found": total_posts,
        "posts_saved": posts_saved,

        "extraction_success": {
            "message_rate": _rate(sum(1 for p in all_posts.values() if p.get("message")), total_posts),
            "timestamp_rate": _rate(sum(1 for p in all_posts.values() if p.get("creation_time")), total_posts),
            "images_rate": _rate(sum(1 for p in all_posts.values() if p.get("images")), total_posts),
            "engagement_rate": _rate(sum(1 for p in all_posts.values() if p.get("engagement", {}).get("reaction_count", 0) > 0), total_posts),
            "author_id_rate": _rate(sum(1 for p in all_posts.values() if p.get("author", {}).get("id")), total_posts),
        },

        "schema_drift": metrics.get_rates(total_posts),

        "shapes": shape_counts,
        "total_responses": total_responses,

        "comments": {
            "total_expected": sum(p.get("engagement", {}).get("comment_count", 0) for p in all_posts.values()),
            "initial_collected": sum(len(p.get("initial_comments", [])) for p in all_posts.values()),
            "posts_needing_collection": sum(1 for p in all_posts.values() if p.get("engagement", {}).get("comment_count", 0) > 0),
        },

        "images": {
            "total_collected": sum(len(p.get("images", [])) for p in all_posts.values()),
            "total_reported": sum(p.get("image_count_reported", 0) for p in all_posts.values()),
            "posts_with_missing": sum(1 for p in all_posts.values() if p.get("image_count_reported", 0) > len(p.get("images", []))),
        },

        "output_dir": str(output_dir),
    }

    # Save run quality report
    report_path = run_dir / f"run_quality_{run_id}.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(quality_report, f, ensure_ascii=False, indent=2)

    # Also save in output dir
    output_report = output_dir / f"run_quality_{run_id}.json"
    with open(output_report, 'w', encoding='utf-8') as f:
        json.dump(quality_report, f, ensure_ascii=False, indent=2)

    logger.info("extract_complete", extra={
        "posts_saved": posts_saved,
        "output_dir": str(output_dir),
        "report": str(report_path),
    })

    return quality_report


def _build_post_quality(post: dict, merged_comment_count: int = 0) -> dict:
    """Build _quality section for a single post."""
    comment_count = post.get("engagement", {}).get("comment_count", 0)
    collected = merged_comment_count or len(post.get("initial_comments", []))
    img_got = len(post.get("images", []))
    img_reported = post.get("image_count_reported", img_got)

    return {
        "extract_message": bool(post.get("message")),
        "extract_timestamp": bool(post.get("creation_time")),
        "extract_images": img_got > 0 or img_reported == 0,
        "extract_engagement": bool(post.get("engagement", {}).get("reaction_count", 0) > 0 or comment_count > 0),
        "comment_count_reported": comment_count,
        "comment_count_collected": collected,
        "comment_coverage_estimated": round(collected / comment_count, 3) if comment_count > 0 else 1.0,
        "comment_coverage_confident": False,
        "image_count_reported": img_reported,
        "image_count_collected": img_got,
    }


def _rate(count: int, total: int) -> float:
    return round(count / total, 3) if total > 0 else 0.0


# === CLI ===

def find_all_runs(raw_base: Path = Path("raw")) -> list[Path]:
    """Find all run directories under raw/"""
    runs = []
    for group_dir in raw_base.iterdir():
        if not group_dir.is_dir():
            continue
        for run_dir in group_dir.iterdir():
            if run_dir.is_dir() and run_dir.name.startswith("run_"):
                if (run_dir / "graphql_stream").exists():
                    runs.append(run_dir)
    return sorted(runs)


def main():
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(description="Replay Extractor — raw → extracted.json")
    parser.add_argument("--run", type=str, help="Extract specific run directory")
    parser.add_argument("--all", action="store_true", help="Extract all runs")
    parser.add_argument("--rerun-version", type=str, help="Rerun runs extracted with older version")
    parser.add_argument("--force", action="store_true", help="Force re-extract even if already done")
    args = parser.parse_args()

    if args.run:
        run_dir = Path(args.run)
        if not run_dir.exists():
            print(f"ERROR: {run_dir} not found")
            sys.exit(1)
        report = extract_run(run_dir)
        _print_report(report)

    elif args.all or args.rerun_version:
        runs = find_all_runs()
        print(f"Found {len(runs)} runs\n")

        for run_dir in runs:
            # Check if already extracted
            state_path = run_dir / "extraction_state.json"
            if state_path.exists() and not args.force:
                if args.rerun_version:
                    state = json.loads(state_path.read_text())
                    if state.get("extractor_version", "") >= args.rerun_version:
                        print(f"  SKIP {run_dir.name} (version {state.get('extractor_version')} >= {args.rerun_version})")
                        continue
                else:
                    print(f"  SKIP {run_dir.name} (already extracted, use --force to rerun)")
                    continue

            print(f"  EXTRACT {run_dir}")
            report = extract_run(run_dir)
            _print_report(report, indent=4)
            print()

    else:
        parser.print_help()


def _print_report(report: dict, indent: int = 0):
    """Print summary of extraction report."""
    prefix = " " * indent
    if "error" in report:
        print(f"{prefix}ERROR: {report['error']}")
        return

    posts = report.get("posts_found", 0)
    saved = report.get("posts_saved", 0)
    success = report.get("extraction_success", {})
    drift = report.get("schema_drift", {})
    comments = report.get("comments", {})
    images = report.get("images", {})

    print(f"{prefix}Posts: {saved}/{posts}")
    print(f"{prefix}Message: {success.get('message_rate', 0)*100:.0f}% | Timestamp: {success.get('timestamp_rate', 0)*100:.0f}% | Images: {success.get('images_rate', 0)*100:.0f}%")
    print(f"{prefix}Images: got {images.get('total_collected', 0)} / reported {images.get('total_reported', 0)}")
    print(f"{prefix}Comments: {comments.get('initial_collected', 0)} initial / {comments.get('total_expected', 0)} total ({comments.get('posts_needing_collection', 0)} posts need Phase 2)")
    print(f"{prefix}Output: {report.get('output_dir', '?')}")

    # Drift warnings
    fallback_msg = drift.get("message_fallback_rate", 0)
    missing_msg = drift.get("message_missing_rate", 0)
    if missing_msg > 0.05:
        print(f"{prefix}⚠ DRIFT: message_missing_rate={missing_msg:.1%}")
    if fallback_msg > 0.3:
        print(f"{prefix}⚠ DRIFT: message_fallback_rate={fallback_msg:.1%}")


if __name__ == "__main__":
    main()
