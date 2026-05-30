"""Run Pipeline — orchestrate LLM → Normalize → Validate → DB Ingest → Face Ingest

เรียกจาก run.py --full-pipeline หรือ run.py auto
ทุก step ถ้า fail จะ log แล้วไปต่อ (ไม่หยุดทั้ง pipeline)
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def run_pipeline(extracted_dir: str = None, no_db: bool = False):
    """Run post-capture pipeline

    Args:
        extracted_dir: path to extracted/ directory (ถ้าไม่ระบุใช้ default)
        no_db: True = หยุดหลัง validate (ไม่ ingest DB + face) สำหรับตรวจสอบก่อน
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
        print(f"\n  Pipeline stopped before DB (--no-db) ({duration:.0f}s) — {ok}/{total_steps} steps succeeded")
        print(f"  ข้อมูลอยู่ใน golden/validated/ พร้อมตรวจสอบ")
        print(f"  เมื่อตรวจเสร็จ รัน: python run.py pipeline --db-only")
        for step, success in results.items():
            print(f"    {step}: {'OK' if success else 'FAIL'}")
        return results

    # === Step 4: DB Ingest ===
    print(f"\n  [Pipeline 4/{total_steps}] DB Ingest...")
    try:
        _run_script("golden/ingest_to_db.py")
        results["db_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 5: Face Ingest ===
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


def run_db_only():
    """Run DB Ingest + Face Ingest only (หลังตรวจสอบ validated/ แล้ว)"""
    start = time.time()
    results = {"db_ingest": False, "face_ingest": False}

    print(f"\n  [DB-Only 1/2] DB Ingest...")
    try:
        _run_script("golden/ingest_to_db.py")
        results["db_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    print(f"\n  [DB-Only 2/2] Face Ingest...")
    try:
        _run_script("golden/ingest_faces_to_service.py")
        results["face_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    duration = time.time() - start
    ok = sum(1 for v in results.values() if v)
    print(f"\n  DB-Only done! ({duration:.0f}s) — {ok}/2 steps succeeded")
    for step, success in results.items():
        print(f"    {step}: {'OK' if success else 'FAIL'}")

    return results


def _run_script(script_path: str):
    """Run a Python script as subprocess"""
    import subprocess
    env = {**os.environ}

    # Ensure DATABASE_URL is set
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5433/fraud_checker"

    result = subprocess.run(
        [sys.executable, script_path],
        cwd=str(Path(__file__).parent.parent.parent),
        env=env,
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"{script_path} exited with code {result.returncode}")


if __name__ == "__main__":
    run_pipeline()
