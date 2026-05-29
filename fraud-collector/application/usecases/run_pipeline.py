"""Run Pipeline — orchestrate LLM → Normalize → Validate → DB Ingest → Face Ingest

เรียกจาก run.py --full-pipeline หรือ run.py auto
ทุก step ถ้า fail จะ log แล้วไปต่อ (ไม่หยุดทั้ง pipeline)
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def run_pipeline(extracted_dir: str = None):
    """Run full post-capture pipeline

    Args:
        extracted_dir: path to extracted/ directory (ถ้าไม่ระบุใช้ default)
    """
    start = time.time()
    results = {"llm": False, "normalize": False, "validate": False, "db_ingest": False, "face_ingest": False}

    # === Step 1: LLM Extract ===
    print(f"\n  [Pipeline 1/5] LLM Entity Extraction...")
    try:
        from golden_llm_propose import run_llm_propose
        run_llm_propose()
        results["llm"] = True
    except Exception:
        # Fallback: import directly
        try:
            _run_script("golden/llm_propose.py")
            results["llm"] = True
        except Exception as e:
            print(f"    ERROR: {e}")

    # === Step 2: Normalize ===
    print(f"\n  [Pipeline 2/5] Normalize...")
    try:
        _run_script("golden/normalize_all.py")
        results["normalize"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 3: Validate ===
    print(f"\n  [Pipeline 3/5] Validate...")
    try:
        _run_script("golden/validate_all.py")
        results["validate"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 4: DB Ingest ===
    print(f"\n  [Pipeline 4/5] DB Ingest...")
    try:
        _run_script("golden/ingest_to_db.py")
        results["db_ingest"] = True
    except Exception as e:
        print(f"    ERROR: {e}")

    # === Step 5: Face Ingest ===
    print(f"\n  [Pipeline 5/5] Face Ingest...")
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
