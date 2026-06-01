"""เช็กคนโกง — Collector Bot GUI (V4)

Tkinter GUI สำหรับ distributed collector
เพื่อนกรอก 3 อย่าง: FB Group URL, API Key, Gemini Key → กด Start
ใช้ collect-v4: scroll feed → extract → images → R2 → LLM → API (pending_review)
"""
import json
import os
import re
import sys
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
from pathlib import Path
from datetime import datetime

CONFIG_DIR = Path.home() / ".fraudcollector"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_API_URL = "https://api.xn--12cainl6g3mua5b.com/api/v1"

DEFAULT_SKIP_KEYWORDS = """รับซื้อ
รับจำนำ
สินเชื่อ
iPhone
หลังคารั่ว
นวด
โปรโมชั่น
รีไฟแนนซ์
ยอดว่าง
สร้างเครดิต
เล่ม"""


class CollectorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("เช็กคนโกง — Collector Bot")
        self.root.geometry("620x780")
        self.root.resizable(True, True)

        self.running = False
        self.thread = None
        self.current_posts = 0
        self.script_dir = Path(__file__).parent

        self._load_config()
        self._build_ui()
        self._show_existing_stats()

    def _load_config(self):
        self.config = {
            "api_url": DEFAULT_API_URL,
            "api_key": "0b4e0601b318199e6215d2d95c8bf837e011041cb3dbfe0a",
            "gemini_key": "AIzaSyBoG2TRIoTCRaFGgi32rCotuQMMVts9O0w",
            "group_url": "",
            "max_posts": 500,
            "skip_keywords": DEFAULT_SKIP_KEYWORDS,
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                self.config.update(saved)
            except Exception:
                pass

    def _save_config(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        save_data = {
            "api_url": self.api_url_var.get(),
            "api_key": self.api_key_var.get(),
            "gemini_key": self.gemini_key_var.get(),
            "max_posts": int(self.max_posts_var.get() or 500),
            "skip_keywords": self.skip_keywords_text.get("1.0", "end").strip(),
        }
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)

    def _write_skip_keywords(self):
        """เขียน skip_keywords.txt จาก GUI ก่อนรัน"""
        keywords = self.skip_keywords_text.get("1.0", "end").strip()
        kw_path = self.script_dir / "skip_keywords.txt"
        with open(kw_path, 'w', encoding='utf-8') as f:
            f.write("# Auto-generated from GUI\n")
            f.write(keywords + "\n")

    def _build_ui(self):
        header = ttk.Frame(self.root, padding=10)
        header.pack(fill="x")
        ttk.Label(header, text="เช็กคนโกง — Collector Bot", font=("", 14, "bold")).pack()

        # Stats
        self.stats_frame = ttk.LabelFrame(self.root, text="ข้อมูลปัจจุบัน", padding=8)
        self.stats_frame.pack(fill="x", padx=10, pady=(5, 2))
        self.stats_var = tk.StringVar(value="กำลังนับ...")
        ttk.Label(self.stats_frame, textvariable=self.stats_var, font=("", 10)).pack(anchor="w")

        # Config
        config_frame = ttk.LabelFrame(self.root, text="ตั้งค่า", padding=10)
        config_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(config_frame, text="FB Group URL:").grid(row=0, column=0, sticky="w", pady=2)
        self.group_url_var = tk.StringVar(value=self.config.get("group_url", ""))
        ttk.Entry(config_frame, textvariable=self.group_url_var, width=50).grid(row=0, column=1, sticky="ew", pady=2)

        ttk.Label(config_frame, text="จำนวน Posts:").grid(row=1, column=0, sticky="w", pady=2)
        self.max_posts_var = tk.StringVar(value=str(self.config.get("max_posts", 500)))
        ttk.Entry(config_frame, textvariable=self.max_posts_var, width=10).grid(row=1, column=1, sticky="w", pady=2)

        ttk.Label(config_frame, text="API Key:").grid(row=2, column=0, sticky="w", pady=2)
        self.api_key_var = tk.StringVar(value=self.config.get("api_key", ""))
        ttk.Entry(config_frame, textvariable=self.api_key_var, width=50, show="*").grid(row=2, column=1, sticky="ew", pady=2)

        ttk.Label(config_frame, text="Gemini Key:").grid(row=3, column=0, sticky="w", pady=2)
        self.gemini_key_var = tk.StringVar(value=self.config.get("gemini_key", ""))
        ttk.Entry(config_frame, textvariable=self.gemini_key_var, width=50, show="*").grid(row=3, column=1, sticky="ew", pady=2)

        ttk.Label(config_frame, text="API URL:").grid(row=4, column=0, sticky="w", pady=2)
        self.api_url_var = tk.StringVar(value=self.config.get("api_url", DEFAULT_API_URL))
        ttk.Entry(config_frame, textvariable=self.api_url_var, width=50).grid(row=4, column=1, sticky="ew", pady=2)

        # Skip Keywords
        ttk.Label(config_frame, text="Skip Keywords:").grid(row=5, column=0, sticky="nw", pady=2)
        self.skip_keywords_text = tk.Text(config_frame, width=50, height=4, font=("Consolas", 9))
        self.skip_keywords_text.grid(row=5, column=1, sticky="ew", pady=2)
        self.skip_keywords_text.insert("1.0", self.config.get("skip_keywords", DEFAULT_SKIP_KEYWORDS))

        config_frame.columnconfigure(1, weight=1)

        # Buttons
        btn_frame = ttk.Frame(self.root, padding=10)
        btn_frame.pack(fill="x")
        self.start_btn = ttk.Button(btn_frame, text="▶ Start", command=self._start)
        self.start_btn.pack(side="left", padx=5)
        self.stop_btn = ttk.Button(btn_frame, text="■ Stop", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", padx=5)

        # Progress
        progress_frame = ttk.LabelFrame(self.root, text="Progress", padding=10)
        progress_frame.pack(fill="x", padx=10, pady=5)
        self.step_var = tk.StringVar(value="พร้อมทำงาน")
        ttk.Label(progress_frame, textvariable=self.step_var, font=("", 10, "bold")).pack(anchor="w")
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill="x", pady=(5, 2))
        self.counter_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.counter_var, font=("Consolas", 11)).pack(anchor="w")
        self.status_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.status_var, foreground="gray").pack(anchor="w")

        # Log
        log_frame = ttk.LabelFrame(self.root, text="Log", padding=5)
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)
        self.log_text = scrolledtext.ScrolledText(log_frame, height=10, state="disabled", font=("Consolas", 9))
        self.log_text.pack(fill="both", expand=True)

    def _show_existing_stats(self):
        known_file = self.script_dir / "known_post_ids.txt"
        known = 0
        if known_file.exists():
            with open(known_file, 'r') as f:
                known = sum(1 for line in f if line.strip())
        if known > 0:
            self.stats_var.set(f"Posts ที่เก็บแล้ว: {known}")
        else:
            self.stats_var.set("ยังไม่มีข้อมูล — กด Start เพื่อเริ่มเก็บ")

    def _log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"[{timestamp}] {msg}\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def _validate_inputs(self) -> bool:
        if not self.group_url_var.get().strip():
            messagebox.showerror("Error", "กรุณากรอก FB Group URL")
            return False
        if not self.api_key_var.get().strip():
            messagebox.showerror("Error", "กรุณากรอก API Key")
            return False
        if not self.gemini_key_var.get().strip():
            messagebox.showerror("Error", "กรุณากรอก Gemini Key")
            return False
        return True

    def _start(self):
        if not self._validate_inputs():
            return
        self._save_config()
        self._write_skip_keywords()
        self.running = True
        self.current_posts = 0
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.progress_var.set(0)
        self.counter_var.set("")
        self.step_var.set("กำลังเริ่ม...")
        self.thread = threading.Thread(target=self._run_collector, daemon=True)
        self.thread.start()

    def _stop(self):
        self.running = False
        self.status_var.set("กำลังหยุด...")
        self.stop_btn.config(state="disabled")
        self._log("กำลังหยุด... (รอ browser ปิด)")

    def _find_python(self):
        """หา Python executable — ใช้ system python ถ้ารันจาก .exe"""
        import shutil
        # ถ้ารันจาก PyInstaller → ใช้ python จาก PATH
        if getattr(sys, '_MEIPASS', None):
            python = shutil.which("python") or shutil.which("python3")
            if python:
                return python
        return sys.executable

    def _run_collector(self):
        """รัน collect-v4 ใน background thread"""
        import subprocess

        group_url = self.group_url_var.get().strip()
        max_posts = int(self.max_posts_var.get() or 500)
        api_url = self.api_url_var.get().strip()
        api_key = self.api_key_var.get().strip()
        gemini_key = self.gemini_key_var.get().strip()

        env = {**os.environ}
        env["API_BASE_URL"] = api_url
        env["BOT_API_KEY"] = api_key
        env["GEMINI_API_KEY"] = gemini_key

        python = self._find_python()
        cmd = [
            python, str(self.script_dir / "run.py"),
            "collect-v4",
            "--group", group_url,
            "--max-posts", str(max_posts),
        ]

        self.root.after(0, lambda: self._log(f"เริ่ม V4: เก็บ {max_posts} posts"))
        self.root.after(0, lambda: self.step_var.set("กำลังเก็บข้อมูล..."))

        try:
            process = subprocess.Popen(
                cmd,
                cwd=str(self.script_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
            )

            for line in process.stdout:
                if not self.running:
                    process.terminate()
                    break
                line = line.rstrip()
                if not line:
                    continue

                self.root.after(0, lambda l=line: self._log(l))
                self._parse_output(line, max_posts)

            process.wait()

            if not self.running:
                self.root.after(0, lambda: self._log("หยุดโดย user"))
                self.root.after(0, lambda: self._on_done(was_stopped=True))
                return

            self.root.after(0, lambda: self.progress_var.set(100))
            self.root.after(0, lambda: self.step_var.set("เสร็จสิ้น!"))
            self.root.after(0, lambda: self.counter_var.set(f"เก็บได้ {self.current_posts} posts — ส่งเข้าระบบแล้ว"))
            self.root.after(0, lambda: self.status_var.set(""))
            self.root.after(0, lambda: self._log("เสร็จสิ้น! ข้อมูลเข้าระบบ pending_review"))

        except Exception as e:
            self.root.after(0, lambda: self._log(f"ERROR: {e}"))
            self.root.after(0, lambda: self.status_var.set(f"Error: {e}"))

        finally:
            self.root.after(0, lambda: self._on_done())

    def _parse_output(self, line: str, max_posts: int):
        match = re.search(r'new:\s*(\d+)', line)
        if match:
            self.current_posts = int(match.group(1))
            pct = min(self.current_posts / max_posts * 40, 40) if max_posts > 0 else 0
            self.root.after(0, lambda: self.progress_var.set(pct))
            self.root.after(0, lambda: self.counter_var.set(f"เก็บ: {self.current_posts} / {max_posts} posts"))
            return

        if "Feed done" in line:
            match = re.search(r'(\d+) new', line)
            if match:
                self.current_posts = int(match.group(1))
            self.root.after(0, lambda: self.progress_var.set(40))
            self.root.after(0, lambda: self.step_var.set("Extract..."))

        elif "[3/4] Extract" in line:
            self.root.after(0, lambda: self.progress_var.set(45))
            self.root.after(0, lambda: self.step_var.set("Extract..."))

        elif "[4/4] Download" in line:
            self.root.after(0, lambda: self.progress_var.set(50))
            self.root.after(0, lambda: self.step_var.set("Download images..."))

        elif "Downloaded:" in line:
            self.root.after(0, lambda: self.progress_var.set(60))

        elif "[Pipeline 1/" in line or "LLM Entity" in line:
            self.root.after(0, lambda: self.progress_var.set(65))
            self.root.after(0, lambda: self.step_var.set("LLM วิเคราะห์..."))

        elif "[Pipeline 2/" in line:
            self.root.after(0, lambda: self.progress_var.set(75))
            self.root.after(0, lambda: self.step_var.set("Normalize..."))

        elif "[Pipeline 3/" in line:
            self.root.after(0, lambda: self.progress_var.set(80))
            self.root.after(0, lambda: self.step_var.set("Validate..."))

        elif "[Pipeline 4/" in line or "DB Ingest" in line:
            self.root.after(0, lambda: self.progress_var.set(90))
            self.root.after(0, lambda: self.step_var.set("ส่งเข้าระบบ + R2..."))

        elif "ads skipped" in line:
            match = re.search(r'(\d+) ads skipped', line)
            if match:
                n = match.group(1)
                self.root.after(0, lambda: self.status_var.set(f"กรองโฆษณา {n} โพส"))

        elif "V4 DONE" in line:
            self.root.after(0, lambda: self.progress_var.set(100))

    def _on_done(self, was_stopped=False):
        self.running = False
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self._show_existing_stats()

        if was_stopped:
            self.step_var.set("หยุดแล้ว")
            self.counter_var.set(f"เก็บได้: {self.current_posts} posts (ข้อมูลไม่หาย)")
            self.status_var.set("รันใหม่ได้ — จะข้ามที่เก็บแล้ว")
            self._log("")
            self._log(f"หยุดแล้ว — เก็บได้ {self.current_posts} posts")
            self._log(f"ข้อมูลไม่หาย — รันใหม่จะข้ามที่เก็บแล้ว")


def main():
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    root = tk.Tk()
    app = CollectorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
