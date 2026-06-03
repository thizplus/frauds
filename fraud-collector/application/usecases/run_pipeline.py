"""Run Pipeline — orchestrate LLM → Normalize → Validate → DB Ingest → Face Ingest

เรียกจาก run.py --full-pipeline หรือ run.py auto
ทุก step ถ้า fail จะ log แล้วไปต่อ (ไม่หยุดทั้ง pipeline)
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def run_pipeline(extracted_dir: str = None, no_db: bool = False, use_api: bool = False, skip_face: bool = False):
    """Run post-capture pipeline

    Args:
        extracted_dir: path to extracted/ directory (ถ้าไม่ระบุใช้ default)
        no_db: True = หยุดหลัง validate (ไม่ ingest DB + face) สำหรับตรวจสอบก่อน
        use_api: True = ส่งผ่าน HTTP API แทน psycopg2 ตรง (สำหรับ distributed collector)
    """
    start = time.time()

    if no_db:
        total_steps = 3
        results = {"llm": False, "normalize": False, "validate": False}
    else:
        total_steps = 5
        results = {"llm": False, "normalize": False, "validate": False, "db_ingest": False, "face_ingest": False}

    # === Step 1: LLM Extract ===
    print(f"\n  [Pipeline 1/{total_steps}] LLM Entity Extraction...")
    try:
        from golden_llm_propose import run_llm_propose
        run_llm_propose()
        results["llm"] = True
    except Exception:
        try:
            _run_script("golden/llm_propose.py")
            results["llm"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

    # === Step 2: Normalize ===
    print(f"\n  [Pipeline 2/{total_steps}] Normalize...")
    try:
        _run_script("golden/normalize_all.py")
        results["normalize"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 3: Validate ===
    print(f"\n  [Pipeline 3/{total_steps}] Validate...")
    try:
        _run_script("golden/validate_all.py")
        results["validate"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === หยุดตรงนี้ถ้า no_db ===
    if no_db:
        duration = time.time() - start
        ok = sum(1 for v in results.values() if v)

        # สรุปข้อมูลใน validated/
        validated_dir = Path("golden/validated")
        proposal_dir = Path("golden/llm_proposals")
        v_count = len(list(validated_dir.glob("*.json"))) if validated_dir.exists() else 0
        p_count = len(list(proposal_dir.glob("*.json"))) if proposal_dir.exists() else 0

        # นับ entities
        total_entities = 0
        valid_entities = 0
        entity_types = {"name": 0, "phone": 0, "bank_account": 0, "id_card": 0}
        if validated_dir.exists():
            import json as _json
            for vf in validated_dir.glob("*.json"):
                try:
                    with open(vf, "r", encoding="utf-8") as f:
                        data = _json.load(f)
                    for person in data.get("persons", []):
                        for etype in ["names", "phones", "bank_accounts", "id_cards"]:
                            key = etype.rstrip("s") if etype != "names" else "name"
                            for e in person.get(etype, []):
                                total_entities += 1
                                if e.get("is_valid", True):
                                    valid_entities += 1
                                entity_types[key] = entity_types.get(key, 0) + 1
                except Exception:
                    pass

        print(f"\n{'='*60}")
        print(f"  สรุป Pipeline (หยุดก่อน DB)")
        print(f"{'='*60}")
        print(f"  LLM proposals:  {p_count} posts")
        print(f"  Validated:      {v_count} posts")
        print(f"  Entities:       {total_entities} ({valid_entities} valid)")
        for etype, count in entity_types.items():
            if count > 0:
                print(f"    {etype}: {count}")
        print(f"  Duration:       {duration:.0f}s")
        print(f"")
        print(f"  Steps:")
        for step, success in results.items():
            print(f"    {step}: {'OK' if success else 'FAIL'}")
        print(f"")
        print(f"  ตรวจสอบ: golden/validated/")
        print(f"  เมื่อพร้อม: python run.py pipeline --db-only")
        print(f"{'='*60}")
        return results

    # === Step 4: DB Ingest ===
    ingest_script = "golden/ingest_to_api.py" if use_api else "golden/ingest_to_db.py"
    label = "DB Ingest (API)" if use_api else "DB Ingest"
    print(f"\n  [Pipeline 4/{total_steps}] {label}...")
    try:
        _run_script(ingest_script)
        results["db_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 5: Face Ingest ===
    if skip_face:
        print(f"\n  (Face ingest skipped — รอ admin approve)")
    else:
        print(f"\n  [Pipeline 5/{total_steps}] Face Ingest...")
        try:
            _run_script("golden/ingest_faces_to_service.py")
            results["face_ingest"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

    duration = time.time() - start
    ok = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\n  Pipeline done! ({duration:.0f}s) — {ok}/{total} steps succeeded")
    for step, success in results.items():
        status = "OK" if success else "FAIL"
        print(f"    {step}: {status}")

    return results


def run_db_only(use_api: bool = False, skip_face: bool = False):
    """Run DB Ingest + Face Ingest only (หลังตรวจสอบ validated/ แล้ว)

    Args:
        use_api: True = ส่งผ่าน HTTP API แทน psycopg2
        skip_face: True = ไม่ ingest face (สำหรับ distributed — รอ admin approve)
    """
    start = time.time()

    if skip_face:
        results = {"db_ingest": False}
        total_steps = 1
    else:
        results = {"db_ingest": False, "face_ingest": False}
        total_steps = 2

    ingest_script = "golden/ingest_to_api.py" if use_api else "golden/ingest_to_db.py"
    label = "DB Ingest (API)" if use_api else "DB Ingest"
    print(f"\n  [DB-Only 1/{total_steps}] {label}...")
    try:
        _run_script(ingest_script)
        results["db_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    if not skip_face:
        print(f"\n  [DB-Only 2/{total_steps}] Face Ingest...")
        try:
            _run_script("golden/ingest_faces_to_service.py")
            results["face_ingest"] = True
        except Exception as e:
            print(f"    ERROR: {e}")
    else:
        print(f"\n  (Face ingest skipped — รอ admin approve)")

    duration = time.time() - start
    ok = sum(1 for v in results.values() if v)
    print(f"\n  DB-Only done! ({duration:.0f}s) — {ok}/{total_steps} steps succeeded")
    for step, success in results.items():
        print(f"    {step}: {'OK' if success else 'FAIL'}")

    return results


def _run_script(script_path: str, extra_args: list = None):
    """Run a Python script as subprocess"""
    import subprocess
    env = {**os.environ}

    # Ensure DATABASE_URL is set
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5433/fraud_checker"

    cmd = [sys.executable, script_path] + (extra_args or [])
    result = subprocess.run(
        cmd,
        cwd=str(Path(__file__).parent.parent.parent),
        env=env,
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"{script_path} exited with code {result.returncode}")


def run_pipeline_v6(group_id: str = None, all_groups: bool = False, use_api: bool = True, skip_types: str = "advertisement"):
    """V6 Pipeline — แยกตาม group_id

    Args:
        group_id: ระบุ group เดียว
        all_groups: scan groups/ ที่มี .process_post_ids
        use_api: ส่งผ่าน HTTP API (default True)
        skip_types: post_types ที่ไม่ ingest (comma separated)
    """
    start = time.time()

    if all_groups:
        groups_dir = Path("groups")
        if not groups_dir.exists():
            print("No groups/ directory found")
            return
        group_ids = [d.name for d in sorted(groups_dir.iterdir())
                     if d.is_dir() and (d / ".process_post_ids").exists()]
        if not group_ids:
            print("No groups with .process_post_ids found")
            return
        print(f"Found {len(group_ids)} groups to process")
    elif group_id:
        group_ids = [group_id]
    else:
        print("ERROR: --group or --all required")
        return

    total_results = {}
    for gid in group_ids:
        print(f"\n{'='*60}")
        print(f"  Pipeline V6: {gid}")
        print(f"{'='*60}")

        results = {"llm": False, "normalize": False, "validate": False, "ingest": False}

        try:
            print(f"\n  [1/4] LLM Extract...")
            _run_script("golden/llm_propose.py", ["--group", gid])
            results["llm"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

        try:
            print(f"\n  [2/4] Normalize...")
            _run_script("golden/normalize_all.py", ["--group", gid])
            results["normalize"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

        try:
            print(f"\n  [3/4] Validate...")
            _run_script("golden/validate_all.py", ["--group", gid])
            results["validate"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

        if use_api:
            try:
                print(f"\n  [4/4] Ingest (API + R2)...")
                ingest_args = ["--group", gid]
                if skip_types:
                    ingest_args += ["--skip-types", skip_types]
                _run_script("golden/ingest_to_api.py", ingest_args)
                results["ingest"] = True
            except Exception as e:
                print(f"    ERROR: {e}")

        total_results[gid] = results

    duration = time.time() - start
    print(f"\n{'='*60}")
    print(f"  Pipeline V6 Done! ({duration:.0f}s)")
    print(f"{'='*60}")
    for gid, results in total_results.items():
        ok = sum(1 for v in results.values() if v)
        print(f"  {gid}: {ok}/{len(results)} steps OK")
    print(f"{'='*60}")

    return total_results


if __name__ == "__main__":
    run_pipeline()
