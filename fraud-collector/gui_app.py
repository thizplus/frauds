"""เช็กคนโกง — Collector Bot GUI

Tkinter GUI สำหรับ distributed collector
เพื่อนกรอก 3 อย่าง: FB Group URL, API Key, Gemini Key → กด Start
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

# Default API URL (ฝังในตัว ไม่ต้องให้เพื่อนกรอก)
DEFAULT_API_URL = "https://api.xn--12cainl6g3mua5b.com/api/v1"

# Steps ทั้งหมด
STEPS = [
    ("1. เก็บข้อมูล", "กำลังเก็บ posts จาก Facebook..."),
    ("2. LLM Extract", "กำลังวิเคราะห์ข้อมูลด้วย AI..."),
    ("3. Normalize", "กำลังจัดระเบียบข้อมูล..."),
    ("4. Validate", "กำลังตรวจสอบความถูกต้อง..."),
    ("5. ส่งเข้าระบบ", "กำลังส่งข้อมูลเข้า API..."),
    ("6. Face Ingest", "กำลังส่งรูปภาพเข้าระบบ..."),
]


def count_existing_data(base_dir: Path) -> dict:
    """นับข้อมูลที่มีอยู่แล้วใน extracted/ + golden/"""
    stats = {"posts": 0, "validated": 0, "groups": set()}

    extracted = base_dir / "extracted"
    if extracted.exists():
        for f in extracted.rglob("extracted.json"):
            stats["posts"] += 1
        for d in extracted.iterdir():
            if d.is_dir() and d.name.isdigit():
                stats["groups"].add(d.name)

    validated = base_dir / "golden" / "validated"
    if validated.exists():
        stats["validated"] = len(list(validated.glob("*.json")))

    stats["groups"] = len(stats["groups"])
    return stats


class CollectorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("เช็กคนโกง — Collector Bot")
        self.root.geometry("620x750")
        self.root.resizable(True, True)

        self.running = False
        self.thread = None
        self.current_posts = 0
        self.script_dir = Path(__file__).parent

        self._load_config()
        self._build_ui()
        self._show_existing_stats()

    def _load_config(self):
        """โหลด config ที่เคยบันทึก"""
        self.config = {
            "api_url": DEFAULT_API_URL,
            "api_key": "",
            "gemini_key": "",
            "group_url": "",
            "max_posts": 500,
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                self.config.update(saved)
            except Exception:
                pass

    def _save_config(self):
        """บันทึก config"""
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        save_data = {
            "api_url": self.api_url_var.get(),
            "api_key": self.api_key_var.get(),
            "gemini_key": self.gemini_key_var.get(),
            "max_posts": int(self.max_posts_var.get() or 500),
        }
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2)

    def _build_ui(self):
        # === Header ===
        header = ttk.Frame(self.root, padding=10)
        header.pack(fill="x")
        ttk.Label(header, text="เช็กคนโกง — Collector Bot", font=("", 14, "bold")).pack()

        # === Stats Frame (ข้อมูลที่มีอยู่แล้ว) ===
        self.stats_frame = ttk.LabelFrame(self.root, text="ข้อมูลปัจจุบัน", padding=8)
        self.stats_frame.pack(fill="x", padx=10, pady=(5, 2))

        self.stats_var = tk.StringVar(value="กำลังนับ...")
        ttk.Label(self.stats_frame, textvariable=self.stats_var, font=("", 10)).pack(anchor="w")

        # === Config Frame ===
        config_frame = ttk.LabelFrame(self.root, text="ตั้งค่า", padding=10)
        config_frame.pack(fill="x", padx=10, pady=5)

        # FB Group URL
        ttk.Label(config_frame, text="FB Group URL:").grid(row=0, column=0, sticky="w", pady=2)
        self.group_url_var = tk.StringVar(value=self.config.get("group_url", ""))
        ttk.Entry(config_frame, textvariable=self.group_url_var, width=50).grid(row=0, column=1, sticky="ew", pady=2)

        # Max posts
        ttk.Label(config_frame, text="จำนวน Posts:").grid(row=1, column=0, sticky="w", pady=2)
        self.max_posts_var = tk.StringVar(value=str(self.config.get("max_posts", 500)))
        ttk.Entry(config_frame, textvariable=self.max_posts_var, width=10).grid(row=1, column=1, sticky="w", pady=2)

        # API Key
        ttk.Label(config_frame, text="API Key:").grid(row=2, column=0, sticky="w", pady=2)
        self.api_key_var = tk.StringVar(value=self.config.get("api_key", ""))
        ttk.Entry(config_frame, textvariable=self.api_key_var, width=50, show="*").grid(row=2, column=1, sticky="ew", pady=2)

        # Gemini Key
        ttk.Label(config_frame, text="Gemini Key:").grid(row=3, column=0, sticky="w", pady=2)
        self.gemini_key_var = tk.StringVar(value=self.config.get("gemini_key", ""))
        ttk.Entry(config_frame, textvariable=self.gemini_key_var, width=50, show="*").grid(row=3, column=1, sticky="ew", pady=2)

        # API URL (advanced)
        ttk.Label(config_frame, text="API URL:").grid(row=4, column=0, sticky="w", pady=2)
        self.api_url_var = tk.StringVar(value=self.config.get("api_url", DEFAULT_API_URL))
        ttk.Entry(config_frame, textvariable=self.api_url_var, width=50).grid(row=4, column=1, sticky="ew", pady=2)

        config_frame.columnconfigure(1, weight=1)

        # === Button Frame ===
        btn_frame = ttk.Frame(self.root, padding=10)
        btn_frame.pack(fill="x")

        self.start_btn = ttk.Button(btn_frame, text="▶ Start", command=self._start)
        self.start_btn.pack(side="left", padx=5)

        self.stop_btn = ttk.Button(btn_frame, text="■ Stop", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", padx=5)

        # === Progress Frame ===
        progress_frame = ttk.LabelFrame(self.root, text="Progress", padding=10)
        progress_frame.pack(fill="x", padx=10, pady=5)

        # Step label
        self.step_var = tk.StringVar(value="พร้อมทำงาน")
        ttk.Label(progress_frame, textvariable=self.step_var, font=("", 10, "bold")).pack(anchor="w")

        # Progress bar
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill="x", pady=(5, 2))

        # Posts counter
        self.counter_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.counter_var, font=("Consolas", 11)).pack(anchor="w")

        # Status
        self.status_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.status_var, foreground="gray").pack(anchor="w")

        # === Log Frame ===
        log_frame = ttk.LabelFrame(self.root, text="Log", padding=5)
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, state="disabled", font=("Consolas", 9))
        self.log_text.pack(fill="both", expand=True)

    def _show_existing_stats(self):
        """แสดงจำนวนข้อมูลที่มีอยู่แล้ว"""
        stats = count_existing_data(self.script_dir)
        if stats["posts"] > 0:
            self.stats_var.set(
                f"Posts ที่เก็บแล้ว: {stats['posts']}  |  "
                f"Validated: {stats['validated']}  |  "
                f"Groups: {stats['groups']}"
            )
        else:
            self.stats_var.set("ยังไม่มีข้อมูล — กด Start เพื่อเริ่มเก็บ")

    def _log(self, msg: str):
        """เพิ่ม log message"""
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

    def _set_step(self, step_index: int, detail: str = ""):
        """อัพเดท step ที่กำลังทำ"""
        if 0 <= step_index < len(STEPS):
            name, desc = STEPS[step_index]
            self.step_var.set(f"Step {name}")
            self.status_var.set(detail or desc)

    def _start(self):
        if not self._validate_inputs():
            return

        self._save_config()
        self.running = True
        self.current_posts = 0
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.progress_var.set(0)
        self.counter_var.set("")
        self._set_step(0)

        self.thread = threading.Thread(target=self._run_collector, daemon=True)
        self.thread.start()

    def _stop(self):
        self.running = False
        self.status_var.set("กำลังหยุด...")
        self.stop_btn.config(state="disabled")
        self._log("กำลังหยุด... (รอ browser ปิด)")
        # สรุปจะแสดงหลัง process หยุดจริง (ใน _on_stopped)

    def _run_collector(self):
        """รัน collector ใน background thread"""
        import subprocess

        group_url = self.group_url_var.get().strip()
        max_posts = int(self.max_posts_var.get() or 500)
        api_url = self.api_url_var.get().strip()
        api_key = self.api_key_var.get().strip()
        gemini_key = self.gemini_key_var.get().strip()

        # Set environment
        env = {**os.environ}
        env["API_BASE_URL"] = api_url
        env["BOT_API_KEY"] = api_key
        env["GEMINI_API_KEY"] = gemini_key

        # Build command — collect + full pipeline (หยุดก่อน DB)
        cmd = [
            sys.executable, str(self.script_dir / "run.py"),
            "collect",
            "--group", group_url,
            "--max-posts", str(max_posts),
            "--full-pipeline",
            "--no-db",
        ]

        self.root.after(0, lambda: self._log(f"เริ่มเก็บข้อมูล: {max_posts} posts"))
        self.root.after(0, lambda: self._set_step(0))

        try:
            # === Phase 1: Collect + LLM + Validate ===
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
                self._parse_collector_output(line, max_posts)

            process.wait()

            if not self.running:
                self.root.after(0, lambda: self._log("หยุดโดย user"))
                # รัน extract กับข้อมูลที่เก็บมาได้ก่อนหยุด
                self._run_extract_after_stop(env)
                self.root.after(0, lambda: self._on_done(was_stopped=True))
                return

            # === Phase 2: API Ingest ===
            self.root.after(0, lambda: self._set_step(4))
            self.root.after(0, lambda: self.progress_var.set(85))
            self.root.after(0, lambda: self._log(""))
            self.root.after(0, lambda: self._log("=== ส่งข้อมูลเข้าระบบ ==="))

            cmd_api = [
                sys.executable, str(self.script_dir / "run.py"),
                "pipeline", "--db-only", "--api",
            ]

            process2 = subprocess.Popen(
                cmd_api,
                cwd=str(self.script_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
            )

            for line in process2.stdout:
                if not self.running:
                    process2.terminate()
                    break
                line = line.rstrip()
                if line:
                    self.root.after(0, lambda l=line: self._log(l))
                    # Detect face ingest step
                    if "face" in line.lower() and "ingest" in line.lower():
                        self.root.after(0, lambda: self._set_step(5))
                        self.root.after(0, lambda: self.progress_var.set(92))

            process2.wait()

            # Done
            self.root.after(0, lambda: self.progress_var.set(100))
            self.root.after(0, lambda: self.step_var.set("เสร็จสิ้น!"))
            self.root.after(0, lambda: self.counter_var.set(f"เก็บได้ {self.current_posts} posts — ส่งเข้าระบบแล้ว"))
            self.root.after(0, lambda: self.status_var.set(""))
            self.root.after(0, lambda: self._log(""))
            self.root.after(0, lambda: self._log("เสร็จสิ้น! ข้อมูลเข้าระบบแล้ว"))
            self.root.after(0, self._show_existing_stats)

        except Exception as e:
            self.root.after(0, lambda: self._log(f"ERROR: {e}"))
            self.root.after(0, lambda: self.status_var.set(f"Error: {e}"))

        finally:
            self.root.after(0, self._on_done)

    def _parse_collector_output(self, line: str, max_posts: int):
        """Parse output จาก collector เพื่อแสดง progress"""

        # Pattern: "scroll X | posts: Y (DOM: Z) | captured: W"
        match = re.search(r'posts:\s*(\d+)', line)
        if match:
            self.current_posts = int(match.group(1))
            pct = min(self.current_posts / max_posts * 70, 70) if max_posts > 0 else 0
            self.root.after(0, lambda: self.progress_var.set(pct))
            self.root.after(0, lambda: self.counter_var.set(
                f"เก็บได้: {self.current_posts} / {max_posts} posts"
            ))
            return

        # Pattern: "ครบ X posts"
        match = re.search(r'ครบ\s*(\d+)\s*posts', line)
        if match:
            self.current_posts = int(match.group(1))
            self.root.after(0, lambda: self.progress_var.set(70))
            self.root.after(0, lambda: self.counter_var.set(
                f"เก็บครบ: {self.current_posts} posts"
            ))
            return

        # Pattern: "หมด feed (X posts"
        match = re.search(r'หมด feed.*?(\d+)\s*posts', line)
        if match:
            self.current_posts = int(match.group(1))
            self.root.after(0, lambda: self.progress_var.set(70))
            self.root.after(0, lambda: self.counter_var.set(
                f"หมด feed: {self.current_posts} posts"
            ))
            return

        # Detect pipeline steps
        if "[Pipeline 1/" in line or "LLM" in line:
            self.root.after(0, lambda: self._set_step(1))
            self.root.after(0, lambda: self.progress_var.set(72))
        elif "[Pipeline 2/" in line or "Normalize" in line:
            self.root.after(0, lambda: self._set_step(2))
            self.root.after(0, lambda: self.progress_var.set(76))
        elif "[Pipeline 3/" in line or "Validate" in line:
            self.root.after(0, lambda: self._set_step(3))
            self.root.after(0, lambda: self.progress_var.set(80))

    def _on_done(self, was_stopped: bool = False):
        self.running = False
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self._show_existing_stats()

        if was_stopped and self.current_posts > 0:
            self._show_stop_summary()

    def _run_extract_after_stop(self, env: dict):
        """หลังหยุด → รัน extract กับ raw data ที่เก็บมาได้"""
        import subprocess

        self.root.after(0, lambda: self._log(""))
        self.root.after(0, lambda: self._log("กำลัง extract ข้อมูลที่เก็บได้..."))
        self.root.after(0, lambda: self.status_var.set("กำลัง extract ข้อมูลที่เก็บได้..."))

        try:
            cmd = [
                sys.executable, str(self.script_dir / "run.py"),
                "extract", "--all",
            ]
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
                line = line.rstrip()
                if line:
                    self.root.after(0, lambda l=line: self._log(l))
            process.wait()
            self.root.after(0, lambda: self._log("Extract เสร็จ"))
        except Exception as e:
            self.root.after(0, lambda l=str(e): self._log(f"Extract error: {l}"))

    def _show_stop_summary(self):
        """แสดงสรุปเมื่อหยุดกลางทาง + ถามว่าจะทำ pipeline ต่อไหม"""
        # นับ extracted posts จริง
        stats = count_existing_data(self.script_dir)

        self.step_var.set("หยุดแล้ว")
        self.counter_var.set(f"เก็บได้: {self.current_posts} posts (รวมทั้งหมด: {stats['posts']} posts)")
        self.status_var.set("ข้อมูลบันทึกใน raw/ แล้ว — ยังไม่ได้ส่งเข้าระบบ")

        self._log("")
        self._log(f"=== สรุป ===")
        self._log(f"  เก็บได้รอบนี้: {self.current_posts} posts")
        self._log(f"  รวมทั้งหมด: {stats['posts']} posts ({stats['groups']} groups)")
        self._log(f"  ข้อมูลอยู่ใน: raw/ (ยังไม่เข้า DB)")
        self._log(f"")

        # ถ้ามี extracted data พอ → ถามว่าจะทำ pipeline ต่อไหม
        if stats['posts'] > 0:
            self._log(f"  ถ้าต้องการส่งเข้าระบบ:")
            self._log(f"    1. กด Start ใหม่ เพื่อเก็บเพิ่ม")
            self._log(f"    2. หรือรัน: python run.py pipeline --api")
            self._log(f"       เพื่อทำ LLM → Validate → ส่ง API")

    def _run_pipeline_only(self):
        """รัน pipeline (LLM → Validate → API) กับข้อมูลที่มีอยู่"""
        if not self.api_key_var.get().strip() or not self.gemini_key_var.get().strip():
            messagebox.showerror("Error", "กรุณากรอก API Key และ Gemini Key")
            return

        self.running = True
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self._set_step(1, "กำลังรัน pipeline กับข้อมูลที่มีอยู่...")

        thread = threading.Thread(target=self._run_pipeline_thread, daemon=True)
        thread.start()

    def _run_pipeline_thread(self):
        """รัน full pipeline ใน background"""
        import subprocess

        env = {**os.environ}
        env["API_BASE_URL"] = self.api_url_var.get().strip()
        env["BOT_API_KEY"] = self.api_key_var.get().strip()
        env["GEMINI_API_KEY"] = self.gemini_key_var.get().strip()

        cmd = [
            sys.executable, str(self.script_dir / "run.py"),
            "pipeline", "--api",
        ]

        self.root.after(0, lambda: self._log("=== รัน Pipeline (LLM → Validate → API) ==="))

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

                if "[Pipeline 1/" in line or "LLM" in line:
                    self.root.after(0, lambda: self._set_step(1))
                    self.root.after(0, lambda: self.progress_var.set(20))
                elif "[Pipeline 2/" in line or "Normalize" in line:
                    self.root.after(0, lambda: self._set_step(2))
                    self.root.after(0, lambda: self.progress_var.set(40))
                elif "[Pipeline 3/" in line or "Validate" in line:
                    self.root.after(0, lambda: self._set_step(3))
                    self.root.after(0, lambda: self.progress_var.set(55))
                elif "DB Ingest" in line or "[Pipeline 4/" in line:
                    self.root.after(0, lambda: self._set_step(4))
                    self.root.after(0, lambda: self.progress_var.set(70))
                elif "Face Ingest" in line or "[Pipeline 5/" in line:
                    self.root.after(0, lambda: self._set_step(5))
                    self.root.after(0, lambda: self.progress_var.set(85))

            process.wait()

            if process.returncode == 0:
                self.root.after(0, lambda: self.progress_var.set(100))
                self.root.after(0, lambda: self.step_var.set("เสร็จสิ้น!"))
                self.root.after(0, lambda: self.counter_var.set("ส่งข้อมูลเข้าระบบแล้ว"))
                self.root.after(0, lambda: self.status_var.set(""))
                self.root.after(0, lambda: self._log("เสร็จสิ้น! ข้อมูลเข้าระบบแล้ว"))

        except Exception as e:
            self.root.after(0, lambda: self._log(f"ERROR: {e}"))

        finally:
            self.root.after(0, self._on_done)


def main():
    # Ensure we're in the correct directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    root = tk.Tk()
    app = CollectorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
