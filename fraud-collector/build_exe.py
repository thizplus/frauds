"""Build FraudCollector.exe with PyInstaller

Usage:
  pip install pyinstaller
  python build_exe.py

Output:
  dist/FraudCollector/FraudCollector.exe
  → zip dist/FraudCollector/ แล้วส่งให้เพื่อน
  → เพื่อนแตก zip → ดับเบิลคลิก FraudCollector.exe
  → ครั้งแรกจะ download Chromium (~200MB) อัตโนมัติ
"""
import subprocess
import sys
import shutil
from pathlib import Path


def main():
    script_dir = Path(__file__).parent

    # Ensure PyInstaller
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    # Clean old build
    for d in ["build", "dist"]:
        p = script_dir / d
        if p.exists():
            shutil.rmtree(p)
            print(f"Cleaned {d}/")

    # Build
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "FraudCollector",
        "--onedir",
        "--windowed",
        # Include all source code as data
        "--add-data", f"application;application",
        "--add-data", f"infrastructure;infrastructure",
        "--add-data", f"domain;domain",
        "--add-data", f"golden/llm_propose.py;golden",
        "--add-data", f"golden/normalize_all.py;golden",
        "--add-data", f"golden/validate_all.py;golden",
        "--add-data", f"golden/ingest_to_api.py;golden",
        "--add-data", f"golden/ingest_to_db.py;golden",
        "--add-data", f"golden/ingest_faces_to_service.py;golden",
        "--add-data", f"golden/README.md;golden",
        "--add-data", f"categories.yaml;.",
        "--add-data", f"skip_keywords.txt;.",
        "--add-data", f"run.py;.",
        "--add-data", f"requirements-dist.txt;.",
        # Hidden imports
        "--hidden-import", "google.generativeai",
        "--hidden-import", "httpx",
        "--hidden-import", "playwright",
        "--hidden-import", "playwright.async_api",
        "--hidden-import", "yaml",
        "--hidden-import", "PIL",
        # Entry point
        str(script_dir / "gui_app.py"),
    ]

    print(f"Building .exe...")
    result = subprocess.run(cmd, cwd=str(script_dir))

    if result.returncode != 0:
        print(f"\nBuild failed with code {result.returncode}")
        sys.exit(1)

    # Copy additional files to dist
    dist_dir = script_dir / "dist" / "FraudCollector"

    # Create empty directories
    (dist_dir / "golden" / "llm_proposals").mkdir(parents=True, exist_ok=True)
    (dist_dir / "golden" / "normalized").mkdir(parents=True, exist_ok=True)
    (dist_dir / "golden" / "validated").mkdir(parents=True, exist_ok=True)
    (dist_dir / "raw").mkdir(exist_ok=True)
    (dist_dir / "extracted").mkdir(exist_ok=True)
    (dist_dir / "images").mkdir(exist_ok=True)

    # Create empty known_post_ids.txt
    (dist_dir / "known_post_ids.txt").touch()

    # Create first-run script for Chromium download
    with open(dist_dir / "first_run.bat", 'w') as f:
        f.write('@echo off\n')
        f.write('echo Installing Chromium browser (~200MB)...\n')
        f.write('python -m playwright install chromium\n')
        f.write('echo Done!\n')
        f.write('pause\n')

    print(f"\n{'='*50}")
    print(f"  Build success!")
    print(f"{'='*50}")
    print(f"  Output: {dist_dir}")
    print(f"")
    print(f"  แจกให้เพื่อน:")
    print(f"  1. zip folder dist/FraudCollector/")
    print(f"  2. เพื่อนแตก zip")
    print(f"  3. ดับเบิลคลิก FraudCollector.exe")
    print(f"  4. ครั้งแรก: download Chromium อัตโนมัติ")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
