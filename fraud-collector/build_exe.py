"""Build .exe with PyInstaller

Usage:
  pip install pyinstaller
  python build_exe.py
"""
import subprocess
import sys
from pathlib import Path

def main():
    script_dir = Path(__file__).parent

    # Ensure PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    # Build command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "FraudCollector",
        "--onedir",  # onedir เร็วกว่า onefile ตอน startup
        "--windowed",  # ไม่แสดง console window
        "--add-data", f"categories.yaml;.",
        "--add-data", f"golden;golden",
        "--add-data", f"application;application",
        "--add-data", f"infrastructure;infrastructure",
        "--add-data", f"domain;domain",
        "--add-data", f"migrations;migrations",
        "--hidden-import", "google.generativeai",
        "--hidden-import", "httpx",
        "--hidden-import", "playwright",
        "--icon", "NONE",
        str(script_dir / "gui_app.py"),
    ]

    print(f"Building .exe...")
    print(f"Command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(script_dir))

    if result.returncode == 0:
        print(f"\nBuild success!")
        print(f"Output: {script_dir / 'dist' / 'FraudCollector'}")
        print(f"\nTo distribute: zip dist/FraudCollector/ folder")
    else:
        print(f"\nBuild failed with code {result.returncode}")
        sys.exit(1)


if __name__ == "__main__":
    main()
