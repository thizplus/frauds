"""Parallel Collector — 2 threads ทำพร้อมกัน

Thread 1 (Browser): เก็บ comments + images ทีละ post → ใส่ queue
Thread 2 (LLM):     รอ queue ครบ BATCH_SIZE → Gemini batch → normalize → validate → API

Usage:
    await run_parallel(pw, new_post_ids, group_id, extracted_dir, env, cleanup=True)
"""
import json
import os
import queue
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

BATCH_SIZE = int(os.environ.get("LLM_BATCH_SIZE", "20"))


def build_llm_input(post: dict) -> str:
    """สร้าง input text สำหรับ Gemini (เหมือน llm_propose.py)"""
    author = post.get("author", {}).get("name", "?")
    message = post.get("message") or "(ไม่มีข้อความ)"

    parts = [f"ผู้โพสต์: {author}\n\nข้อความ:\n{message}"]

    att = post.get("attached_story")
    if att and att.get("message"):
        parts.append(f"\nข้อความจากโพสต์ที่แชร์มา:\n{att['message']}")

    comments = post.get("comments", []) or post.get("initial_comments", [])
    if comments:
        parts.append("\nComments:")
        for c in comments[:20]:
            c_author = c.get("author", {}).get("name", "?")
            c_text = c.get("text", "")
            if c_text:
                parts.append(f"- [{c_author}]: {c_text}")

    captions = []
    for i, img in enumerate(post.get("images", [])):
        cap = img.get("accessibility_caption", "")
        if cap:
            captions.append(f"- รูป {i+1}: {cap}")

    if captions:
        parts.append("\nรูปภาพ (accessibility_caption):")
        parts.extend(captions)

    return "\n".join(parts)


async def run_parallel(pw, new_post_ids: list, group_id: str,
                        extracted_dir: Path, env: dict, cleanup: bool = True):
    """Orchestrate 2 threads: browser scrape + LLM pipeline

    Args:
        pw: PlaywrightHelper instance (browser เปิดอยู่)
        new_post_ids: list ของ post_ids ที่ต้อง process
        group_id: FB group ID
        extracted_dir: path to extracted/ directory
        env: environment vars (API_BASE_URL, BOT_API_KEY, GEMINI_API_KEY)
        cleanup: True = ลบ temp data หลังส่ง API สำเร็จ
    """
    from application.usecases.per_post_scraper import process_post

    post_queue = queue.Queue()
    total = len(new_post_ids)

    print(f"\n  Parallel collector: {total} posts, batch={BATCH_SIZE}")
    print(f"  Thread 1: Browser (comments + images)")
    print(f"  Thread 2: LLM → Normalize → Validate → API")

    # Load extracted posts
    post_map = {}
    for pid in new_post_ids:
        for f in extracted_dir.rglob(f"post_{pid}/extracted.json"):
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    post_map[pid] = json.load(fh)
            except Exception:
                pass
            break

    if not post_map:
        print(f"  No extracted posts found for {total} post_ids")
        return

    print(f"  Loaded {len(post_map)} extracted posts")

    # === Thread 2: LLM Pipeline (sync, runs in separate thread) ===
    llm_results = {"batches": 0, "posts": 0, "entities": 0, "errors": 0}

    def llm_pipeline():
        try:
            from infrastructure.adapters.llm.gemini_adapter import GeminiAdapter
            from application.usecases.normalizer import normalize_post
            from application.usecases.entity_validator import validate_post
            from application.usecases.cleanup import cleanup_batch

            gemini_key = env.get("GEMINI_API_KEY", "")
            api_url = env.get("API_BASE_URL", "http://localhost:8080/api/v1")
            api_key = env.get("BOT_API_KEY", "")

            if not gemini_key:
                print("  Thread 2: ERROR — GEMINI_API_KEY not set")
                return

            gemini = GeminiAdapter(api_key=gemini_key)
            print(f"  Thread 2: LLM ready ({gemini.get_provider_name()})")

            try:
                import httpx
                http_client = httpx.Client(headers={"X-API-Key": api_key}, timeout=120)
            except ImportError:
                print("  Thread 2: ERROR — httpx not installed")
                return

            batch = []

            while True:
                try:
                    item = post_queue.get(timeout=60)
                except queue.Empty:
                    continue

                if item is None:  # signal จบ
                    if batch:
                        _process_and_send(gemini, batch, api_url, http_client, group_id, env, cleanup, llm_results)
                    break

                batch.append(item)
                if len(batch) >= BATCH_SIZE:
                    _process_and_send(gemini, batch, api_url, http_client, group_id, env, cleanup, llm_results)
                    batch = []

            http_client.close()

        except Exception as e:
            print(f"  Thread 2: FATAL ERROR — {e}")
            import traceback
            traceback.print_exc()

    # Start Thread 2
    llm_thread = threading.Thread(target=llm_pipeline, daemon=True)
    llm_thread.start()

    # === Thread 1: Browser scrape (async, main thread) ===
    images_dir = Path("images")
    images_dir.mkdir(exist_ok=True)

    for i, pid in enumerate(new_post_ids):
        if pid not in post_map:
            continue

        post_data = post_map[pid]
        cc = post_data.get("engagement", {}).get("comment_count", 0)
        print(f"  [{i+1}/{total}] {pid} (comments={cc})...", end=" ", flush=True)

        try:
            updated = await process_post(pw, post_data, group_id, images_dir)
            post_queue.put(updated)
            print("OK")
        except Exception as e:
            print(f"ERROR: {e}")
            # ใส่ post เดิม (ไม่มี comments ใหม่ แต่ยังส่ง LLM ได้)
            post_queue.put(post_data)

    # Signal จบ
    post_queue.put(None)
    print(f"\n  Thread 1: เสร็จ — รอ Thread 2...")

    # Wait Thread 2
    llm_thread.join(timeout=300)

    print(f"\n  === Parallel Collector Summary ===")
    print(f"  Batches:  {llm_results['batches']}")
    print(f"  Posts:    {llm_results['posts']}")
    print(f"  Entities: {llm_results['entities']}")
    if llm_results['errors'] > 0:
        print(f"  Errors:   {llm_results['errors']}")


def _process_and_send(gemini, batch: list, api_url: str, http_client,
                       group_id: str, env: dict, cleanup: bool, results: dict):
    """LLM batch → Normalize → Validate → Build payload → API"""
    import hashlib
    from application.usecases.normalizer import normalize_post as _normalize
    from application.usecases.entity_validator import validate_post as _validate
    from application.usecases.entity_validator import get_verification

    batch_num = results['batches'] + 1
    post_ids = [p.get("post_id", "") for p in batch]
    print(f"  Thread 2: Batch {batch_num} ({len(batch)} posts)...", end=" ", flush=True)

    try:
        # 1. LLM batch
        inputs = [{"post_id": p.get("post_id", ""), "text": build_llm_input(p)} for p in batch]
        llm_outputs = gemini.extract_entities_batch(inputs)

        # Map results by post_id
        llm_map = {}
        for r in llm_outputs:
            rpid = r.get("post_id", "")
            if rpid:
                llm_map[rpid] = r

        # 2-3. Normalize + Validate + Build payload per post
        posts_payload = []

        for post in batch:
            pid = post.get("post_id", "")
            llm_output = llm_map.get(pid, {"names": [], "phones": [], "bank_accounts": [], "id_cards": []})

            normalized = _normalize(post, llm_output)
            validated = _validate(normalized)

            # Build post payload (inline — ไม่พึ่ง ingest_to_api.py)
            post_payload = {
                "postId": pid,
                "authorName": post.get("author", {}).get("name", ""),
                "authorId": post.get("author", {}).get("id", ""),
                "message": post.get("message", ""),
                "permalinkUrl": post.get("permalink_url", ""),
                "creationTime": post.get("creation_time"),
                "reactionCount": post.get("engagement", {}).get("reaction_count", 0),
                "commentCount": post.get("engagement", {}).get("comment_count", 0),
                "shareCount": post.get("engagement", {}).get("share_count", 0),
                "imageCount": post.get("image_count_reported", 0),
                "persons": [],
            }

            norm_persons = normalized.get("persons", [])
            val_persons = validated.get("persons", [])

            for i, val_person in enumerate(val_persons):
                norm_person = norm_persons[i] if i < len(norm_persons) else {}
                person_id = f"{pid}_{val_person['id']}"

                names = norm_person.get("names", val_person.get("names", []))
                display_name = names[0].get("raw", "") if names else ""
                lang = names[0].get("lang", "") if names else ""

                person_payload = {
                    "personId": person_id,
                    "displayName": display_name,
                    "lang": lang,
                    "namesJson": names,
                    "evidenceJson": norm_person.get("evidence", []),
                    "entities": [],
                }

                # Name entities
                for j, n in enumerate(names):
                    raw = n.get("raw", "")
                    norm_val = n.get("normalized", raw) or None
                    if not raw.strip():
                        continue
                    source_id = "unknown"
                    source_type = "unknown"
                    ev_json = {}
                    for ev in norm_person.get("evidence", []):
                        if ev.get("type") == "name" and ev.get("value") == raw:
                            source_id = ev.get("source", "unknown")
                            source_type = source_id.split("_")[0] if "_" in source_id else source_id
                            ev_json = ev
                            break
                    eid = hashlib.sha1(f"{pid}|name|{raw}|{source_id}|{ev_json.get('start', j)}".encode()).hexdigest()[:16]
                    v_state, v_reason = get_verification(source_id, True)
                    person_payload["entities"].append({
                        "entityId": eid, "entityType": "name",
                        "rawValue": raw, "normalizedValue": norm_val,
                        "isValid": True, "verificationState": v_state,
                        "verificationReason": v_reason, "confidenceScore": 0.5,
                        "sourceType": source_type, "sourceId": source_id,
                        "evidenceJson": json.dumps(ev_json, ensure_ascii=False) if ev_json else None,
                    })

                # Phone/bank/id entities
                for etype, key in [("phone", "phones"), ("bank_account", "bank_accounts"), ("id_card", "id_cards")]:
                    for k, entity in enumerate(val_person.get(key, [])):
                        raw = entity.get("value", "")
                        norm_val = entity.get("normalized", raw) or None
                        is_valid = entity.get("is_valid", True)
                        reason = entity.get("validation", {}).get("reason")
                        conf = entity.get("confidence_score", 0.0)
                        source_id = "unknown"
                        source_type = "unknown"
                        ev_json = {}
                        for ev in norm_person.get("evidence", []):
                            if ev.get("value") == raw:
                                source_id = ev.get("source", "unknown")
                                source_type = source_id.split("_")[0] if "_" in source_id else source_id
                                ev_json = ev
                                break
                        eid = hashlib.sha1(f"{pid}|{etype}|{raw}|{source_id}|{ev_json.get('start', k)}".encode()).hexdigest()[:16]
                        v_state, v_reason = get_verification(source_id, is_valid)
                        person_payload["entities"].append({
                            "entityId": eid, "entityType": etype,
                            "rawValue": raw, "normalizedValue": norm_val,
                            "isValid": is_valid, "validationReason": reason,
                            "verificationState": v_state, "verificationReason": v_reason,
                            "confidenceScore": conf, "sourceType": source_type,
                            "sourceId": source_id,
                            "evidenceJson": json.dumps(ev_json, ensure_ascii=False) if ev_json else None,
                        })

                post_payload["persons"].append(person_payload)

            posts_payload.append(post_payload)

        # 4. Send API
        payload = {
            "groupId": group_id,
            "groupUrl": f"https://www.facebook.com/groups/{group_id}/",
            "pipelineVersion": "collector_v3_parallel",
            "pipelineRunId": f"run_{time.strftime('%Y%m%d_%H%M%S')}",
            "posts": posts_payload,
        }

        resp = http_client.post(f"{api_url}/bot/social-batch", json=payload)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            results['batches'] += 1
            results['posts'] += len(batch)
            results['entities'] += data.get("entitiesCount", 0)
            print(f"OK → entities={data.get('entitiesCount', 0)}")

            # 5. บันทึก known_ids เสมอ + cleanup ถ้าเปิด
            from application.usecases.cleanup import append_known_post_ids, cleanup_batch
            append_known_post_ids(post_ids)
            if cleanup:
                cleanup_batch(post_ids)
        else:
            results['errors'] += 1
            print(f"FAIL HTTP {resp.status_code}: {resp.text[:200]}")

    except Exception as e:
        results['errors'] += 1
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
