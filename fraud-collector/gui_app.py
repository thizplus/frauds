"""เช็กคนโกง — Collector Bot GUI (V5)

2 ขั้น:
  ขั้น 1: เก็บ posts + images (ไม่ต้อง LLM — ฟรี)
  ขั้น 2: ส่ง LLM + API (เปิด Vast.ai/Ollama ตอนพร้อม)
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
        self.root.geometry("640x800")
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
            "api_key": "",
            "gemini_key": "",
            "ollama_url": "",
            "ollama_token": "",
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
            "ollama_url": self.ollama_url_var.get(),
            "ollama_token": self.ollama_token_var.get(),
            "max_posts": int(self.max_posts_var.get() or 500),
            "skip_keywords": self.skip_keywords_text.get("1.0", "end").strip(),
        }
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)

    def _write_skip_keywords(self):
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
        stats_frame = ttk.LabelFrame(self.root, text="ข้อมูลปัจจุบัน", padding=8)
        stats_frame.pack(fill="x", padx=10, pady=(5, 2))
        self.stats_var = tk.StringVar(value="กำลังนับ...")
        ttk.Label(stats_frame, textvariable=self.stats_var, font=("", 10)).pack(anchor="w")

        # === ขั้น 1: เก็บข้อมูล ===
        step1_frame = ttk.LabelFrame(self.root, text="ขั้น 1: เก็บข้อมูล (scroll + images)", padding=10)
        step1_frame.pack(fill="x", padx=10, pady=(5, 2))

        row = 0
        ttk.Label(step1_frame, text="FB Group URL:").grid(row=row, column=0, sticky="w", pady=2)
        self.group_url_var = tk.StringVar(value=self.config.get("group_url", ""))
        ttk.Entry(step1_frame, textvariable=self.group_url_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step1_frame, text="จำนวน Posts:").grid(row=row, column=0, sticky="w", pady=2)
        self.max_posts_var = tk.StringVar(value=str(self.config.get("max_posts", 500)))
        ttk.Entry(step1_frame, textvariable=self.max_posts_var, width=10).grid(row=row, column=1, sticky="w", pady=2)

        row += 1
        self.capture_btn = ttk.Button(step1_frame, text="เก็บข้อมูล", command=self._start_capture)
        self.capture_btn.grid(row=row, column=1, sticky="w", pady=5)

        step1_frame.columnconfigure(1, weight=1)

        # === ขั้น 2: ส่งเข้าระบบ ===
        step2_frame = ttk.LabelFrame(self.root, text="ขั้น 2: ส่งเข้าระบบ (LLM + R2 + API)", padding=10)
        step2_frame.pack(fill="x", padx=10, pady=(2, 5))

        row = 0
        ttk.Label(step2_frame, text="API Key:").grid(row=row, column=0, sticky="w", pady=2)
        self.api_key_var = tk.StringVar(value=self.config.get("api_key", ""))
        ttk.Entry(step2_frame, textvariable=self.api_key_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step2_frame, text="API URL:").grid(row=row, column=0, sticky="w", pady=2)
        self.api_url_var = tk.StringVar(value=self.config.get("api_url", DEFAULT_API_URL))
        ttk.Entry(step2_frame, textvariable=self.api_url_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step2_frame, text="Gemini Key:").grid(row=row, column=0, sticky="w", pady=2)
        self.gemini_key_var = tk.StringVar(value=self.config.get("gemini_key", ""))
        ttk.Entry(step2_frame, textvariable=self.gemini_key_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step2_frame, text="Ollama URL:").grid(row=row, column=0, sticky="w", pady=2)
        self.ollama_url_var = tk.StringVar(value=self.config.get("ollama_url", ""))
        ttk.Entry(step2_frame, textvariable=self.ollama_url_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step2_frame, text="Ollama Token:").grid(row=row, column=0, sticky="w", pady=2)
        self.ollama_token_var = tk.StringVar(value=self.config.get("ollama_token", ""))
        ttk.Entry(step2_frame, textvariable=self.ollama_token_var, width=50).grid(row=row, column=1, sticky="ew", pady=2)

        row += 1
        ttk.Label(step2_frame, text="Ollama Model:").grid(row=row, column=0, sticky="w", pady=2)
        model_frame = ttk.Frame(step2_frame)
        model_frame.grid(row=row, column=1, sticky="ew", pady=2)
        self.ollama_model_var = tk.StringVar(value=self.config.get("ollama_model", "qwen3.5:35b"))
        ttk.Entry(model_frame, textvariable=self.ollama_model_var, width=20).pack(side="left")
        ttk.Button(model_frame, text="ติดตั้ง Model", command=self._pull_ollama_model).pack(side="left", padx=(10, 5))
        ttk.Button(model_frame, text="เช็ค", command=self._check_ollama_model).pack(side="left")

        row += 1
        ttk.Label(step2_frame, text="Skip Keywords:").grid(row=row, column=0, sticky="nw", pady=2)
        self.skip_keywords_text = tk.Text(step2_frame, width=50, height=3, font=("Consolas", 9))
        self.skip_keywords_text.grid(row=row, column=1, sticky="ew", pady=2)
        self.skip_keywords_text.insert("1.0", self.config.get("skip_keywords", DEFAULT_SKIP_KEYWORDS))

        row += 1
        ttk.Label(step2_frame, text="ไม่ส่งเข้าระบบ:").grid(row=row, column=0, sticky="w", pady=2)
        skip_types_frame = ttk.Frame(step2_frame)
        skip_types_frame.grid(row=row, column=1, sticky="w", pady=2)
        self.skip_advertisement = tk.BooleanVar(value=True)
        self.skip_unrelated = tk.BooleanVar(value=False)
        ttk.Checkbutton(skip_types_frame, text="โฆษณา (advertisement)", variable=self.skip_advertisement).pack(side="left", padx=(0, 10))
        ttk.Checkbutton(skip_types_frame, text="ไม่เกี่ยว (unrelated)", variable=self.skip_unrelated).pack(side="left")

        row += 1
        self.pipeline_btn = ttk.Button(step2_frame, text="ส่งเข้าระบบ", command=self._start_pipeline)
        self.pipeline_btn.grid(row=row, column=1, sticky="w", pady=5)

        step2_frame.columnconfigure(1, weight=1)

        # Stop button
        btn_frame = ttk.Frame(self.root, padding=5)
        btn_frame.pack(fill="x", padx=10)

        self.stop_btn = ttk.Button(btn_frame, text="Stop", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", padx=5)

        # Progress
        progress_frame = ttk.LabelFrame(self.root, text="Progress", padding=10)
        progress_frame.pack(fill="x", padx=10, pady=5)
        self.step_var = tk.StringVar(value="พร้อมทำงาน")
        ttk.Label(progress_frame, textvariable=self.step_var, font=("", 10, "bold")).pack(anchor="w")
        self.progress_var = tk.DoubleVar(value=0)
        ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100).pack(fill="x", pady=(5, 2))
        self.counter_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.counter_var, font=("Consolas", 11)).pack(anchor="w")
        self.status_var = tk.StringVar(value="")
        ttk.Label(progress_frame, textvariable=self.status_var, foreground="gray").pack(anchor="w")

        # Log
        log_frame = ttk.LabelFrame(self.root, text="Log", padding=5)
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)
        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, state="disabled", font=("Consolas", 9))
        self.log_text.pack(fill="both", expand=True)

    def _show_existing_stats(self):
        known = 0
        pending = 0

        # V6: scan groups/*/
        groups_dir = self.script_dir / "groups"
        if groups_dir.exists():
            for gdir in groups_dir.iterdir():
                if not gdir.is_dir():
                    continue
                kf = gdir / "known_post_ids.txt"
                if kf.exists():
                    with open(kf, 'r') as f:
                        known += sum(1 for line in f if line.strip())
                pf = gdir / ".process_post_ids"
                if pf.exists():
                    with open(pf, 'r') as f:
                        pending += sum(1 for line in f if line.strip())

        # V5 fallback
        if known == 0:
            known_file = self.script_dir / "known_post_ids.txt"
            if known_file.exists():
                with open(known_file, 'r') as f:
                    known = sum(1 for line in f if line.strip())
            filter_file = self.script_dir / "golden" / ".process_post_ids"
            if filter_file.exists():
                with open(filter_file, 'r') as f:
                    pending = sum(1 for line in f if line.strip())

        if known > 0 or pending > 0:
            self.stats_var.set(f"Posts ที่ scroll แล้ว: {known}  |  รอส่ง LLM: {pending}")
        else:
            self.stats_var.set("ยังไม่มีข้อมูล — กด ขั้น 1 เพื่อเริ่มเก็บ")

    def _log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"[{timestamp}] {msg}\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def _get_ollama_headers(self):
        headers = {}
        token = self.ollama_token_var.get().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _check_ollama_model(self):
        """เช็คว่า Ollama server มี model ไหม"""
        import httpx
        url = self.ollama_url_var.get().strip()
        if not url:
            self._log("กรุณากรอก Ollama URL ก่อน")
            return
        try:
            resp = httpx.get(f"{url}/api/tags", headers=self._get_ollama_headers(), timeout=10)
            models = [m["name"] for m in resp.json().get("models", [])]
            if models:
                self._log(f"Models ที่มี: {', '.join(models)}")
            else:
                self._log("ไม่มี model — กดติดตั้งก่อน")
        except Exception as e:
            self._log(f"เชื่อมต่อ Ollama ไม่ได้: {e}")

    def _pull_ollama_model(self):
        """Pull/ติดตั้ง model บน Ollama server"""
        url = self.ollama_url_var.get().strip()
        model = self.ollama_model_var.get().strip()
        if not url or not model:
            self._log("กรุณากรอก Ollama URL และ Model ก่อน")
            return
        self._log(f"กำลังติดตั้ง {model}... (รอสักครู่)")
        threading.Thread(target=self._pull_ollama_worker, args=(url, model), daemon=True).start()

    def _pull_ollama_worker(self, url: str, model: str):
        import httpx
        try:
            resp = httpx.post(
                f"{url}/api/pull",
                json={"name": model, "stream": False},
                headers=self._get_ollama_headers(),
                timeout=600,
            )
            if resp.status_code == 200:
                self.root.after(0, lambda: self._log(f"ติดตั้ง {model} สำเร็จ!"))
            else:
                self.root.after(0, lambda: self._log(f"ติดตั้งไม่สำเร็จ: HTTP {resp.status_code}"))
        except Exception as e:
            self.root.after(0, lambda: self._log(f"ติดตั้งไม่สำเร็จ: {e}"))

    def _set_running(self, running: bool):
        self.running = running
        state = "disabled" if running else "normal"
        self.capture_btn.config(state=state)
        self.pipeline_btn.config(state=state)
        self.stop_btn.config(state="normal" if running else "disabled")

    def _stop(self):
        self.running = False
        self.status_var.set("กำลังหยุด...")
        self.stop_btn.config(state="disabled")
        self._log("กำลังหยุด...")

    # === ขั้น 1: เก็บข้อมูล ===

    def _start_capture(self):
        if not self.group_url_var.get().strip():
            messagebox.showerror("Error", "กรุณากรอก FB Group URL")
            return
        self._save_config()
        self._set_running(True)
        self.current_posts = 0
        self.progress_var.set(0)
        self.counter_var.set("")
        self.step_var.set("ขั้น 1: เก็บข้อมูล...")
        self.thread = threading.Thread(target=self._run_capture, daemon=True)
        self.thread.start()

    def _run_capture(self):
        import subprocess
        group_url = self.group_url_var.get().strip()
        max_posts = int(self.max_posts_var.get() or 500)

        env = {**os.environ, "PYTHONUNBUFFERED": "1"}

        cmd = [
            sys.executable, str(self.script_dir / "run.py"),
            "collect-v6",
            "--group", group_url,
            "--max-posts", str(max_posts),
        ]

        self.root.after(0, lambda: self._log(f"ขั้น 1: เก็บ {max_posts} posts"))

        try:
            process = subprocess.Popen(
                cmd, cwd=str(self.script_dir), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
            )

            for line in process.stdout:
                if not self.running:
                    process.terminate()
                    break
                line = line.rstrip()
                if not line:
                    continue
                self.root.after(0, lambda l=line: self._log(l))
                self._parse_capture_output(line, max_posts)

            process.wait()

            if self.running:
                self.root.after(0, lambda: self.progress_var.set(100))
                self.root.after(0, lambda: self.step_var.set("ขั้น 1 เสร็จ!"))
                self.root.after(0, lambda: self.counter_var.set(f"เก็บได้ {self.current_posts} posts + images"))
                self.root.after(0, lambda: self.status_var.set("กด ขั้น 2 เพื่อส่ง LLM → API"))
                self.root.after(0, lambda: self._log("ขั้น 1 เสร็จ! กด ขั้น 2 เมื่อพร้อม"))
            else:
                self.root.after(0, lambda: self._log("หยุดโดย user — ข้อมูลไม่หาย"))

        except Exception as e:
            self.root.after(0, lambda: self._log(f"ERROR: {e}"))
        finally:
            self.root.after(0, lambda: self._set_running(False))
            self.root.after(0, self._show_existing_stats)

    def _parse_capture_output(self, line: str, max_posts: int):
        match = re.search(r'(?:new:|posts:)\s*(\d+)', line)
        if match:
            self.current_posts = int(match.group(1))
            pct = min(self.current_posts / max_posts * 80, 80) if max_posts > 0 else 0
            self.root.after(0, lambda: self.progress_var.set(pct))
            self.root.after(0, lambda: self.counter_var.set(f"เก็บ: {self.current_posts} / {max_posts} posts"))

        if "Feed done" in line:
            self.root.after(0, lambda: self.progress_var.set(80))
            self.root.after(0, lambda: self.step_var.set("Extract + Download images..."))

        if "Downloaded:" in line:
            self.root.after(0, lambda: self.progress_var.set(95))

        if "V5" in line and "เสร็จ" in line:
            self.root.after(0, lambda: self.progress_var.set(100))

    # === ขั้น 2: ส่งเข้าระบบ ===

    def _start_pipeline(self):
        api_key = self.api_key_var.get().strip()
        gemini_key = self.gemini_key_var.get().strip()
        ollama_url = self.ollama_url_var.get().strip()

        if not api_key:
            messagebox.showerror("Error", "กรุณากรอก API Key")
            return
        if not gemini_key and not ollama_url:
            messagebox.showerror("Error", "กรุณากรอก Gemini Key หรือ Ollama URL")
            return

        self._save_config()
        self._write_skip_keywords()
        self._set_running(True)
        self.progress_var.set(0)
        self.step_var.set("ขั้น 2: ส่งเข้าระบบ...")
        self.thread = threading.Thread(target=self._run_pipeline, daemon=True)
        self.thread.start()

    def _run_pipeline(self):
        import subprocess
        api_url = self.api_url_var.get().strip()
        api_key = self.api_key_var.get().strip()
        gemini_key = self.gemini_key_var.get().strip()
        ollama_url = self.ollama_url_var.get().strip()
        ollama_token = self.ollama_token_var.get().strip()

        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        env["API_BASE_URL"] = api_url
        env["BOT_API_KEY"] = api_key

        if ollama_url:
            env["LLM_PROVIDER"] = "ollama"
            env["OLLAMA_URL"] = ollama_url
            env["OLLAMA_TOKEN"] = ollama_token
            env["LLM_BATCH_SIZE"] = "1"  # Ollama ไม่ handle batch — ส่งทีละ post
            ollama_model = self.ollama_model_var.get().strip()
            if ollama_model:
                env["LLM_MODEL"] = ollama_model
            self.root.after(0, lambda: self._log(f"LLM: Ollama ({ollama_url}) model={ollama_model}"))
        else:
            env["LLM_PROVIDER"] = "gemini"
            env["GEMINI_API_KEY"] = gemini_key
            self.root.after(0, lambda: self._log("LLM: Gemini API"))

        # Skip types จาก checkbox
        skip_list = []
        if self.skip_advertisement.get():
            skip_list.append("advertisement")
        if self.skip_unrelated.get():
            skip_list.append("unrelated")
        skip_types = ",".join(skip_list) if skip_list else ""

        cmd = [
            sys.executable, str(self.script_dir / "run.py"),
            "pipeline-v6", "--all", "--api",
        ]
        if skip_types:
            cmd += ["--skip-types", skip_types]

        skip_msg = f" (skip: {skip_types})" if skip_types else ""
        self.root.after(0, lambda: self._log(f"ขั้น 2: LLM → Normalize → Validate → API{skip_msg}"))

        try:
            process = subprocess.Popen(
                cmd, cwd=str(self.script_dir), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
            )

            for line in process.stdout:
                if not self.running:
                    process.terminate()
                    break
                line = line.rstrip()
                if not line:
                    continue
                self.root.after(0, lambda l=line: self._log(l))
                self._parse_pipeline_output(line)

            process.wait()

            if self.running:
                self.root.after(0, lambda: self.progress_var.set(100))
                self.root.after(0, lambda: self.step_var.set("ขั้น 2 เสร็จ!"))
                self.root.after(0, lambda: self.status_var.set("ข้อมูลเข้าระบบ pending_review"))
                self.root.after(0, lambda: self._log("เสร็จสิ้น! เข้า admin review ได้เลย"))

        except Exception as e:
            self.root.after(0, lambda: self._log(f"ERROR: {e}"))
        finally:
            self.root.after(0, lambda: self._set_running(False))
            self.root.after(0, self._show_existing_stats)

    def _parse_pipeline_output(self, line: str):
        if "[Pipeline 1/" in line or "LLM" in line:
            self.root.after(0, lambda: self.progress_var.set(20))
            self.root.after(0, lambda: self.step_var.set("LLM วิเคราะห์..."))
        elif "[Pipeline 2/" in line:
            self.root.after(0, lambda: self.progress_var.set(40))
            self.root.after(0, lambda: self.step_var.set("Normalize..."))
        elif "[Pipeline 3/" in line:
            self.root.after(0, lambda: self.progress_var.set(60))
            self.root.after(0, lambda: self.step_var.set("Validate..."))
        elif "[Pipeline 4/" in line or "DB Ingest" in line:
            self.root.after(0, lambda: self.progress_var.set(80))
            self.root.after(0, lambda: self.step_var.set("ส่งเข้าระบบ + R2..."))
        elif "ads skipped" in line:
            match = re.search(r'(\d+) ads skipped', line)
            if match:
                n = match.group(1)
                self.root.after(0, lambda: self.status_var.set(f"กรองโฆษณา {n} โพส"))
        elif "Pipeline done" in line:
            self.root.after(0, lambda: self.progress_var.set(100))


def main():
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    root = tk.Tk()
    app = CollectorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
