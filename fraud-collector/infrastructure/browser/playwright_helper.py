"""PlaywrightHelper — Browser automation with GraphQL capture

Dumb recorder: เปิดหน้า, scroll, capture raw responses to disk
ไม่ parse GraphQL, ไม่ route per-post, ไม่สร้าง jobs

Usage:
    async with PlaywrightHelper(profile_dir="./pw_chrome_data_001") as pw:
        await pw.goto("https://www.facebook.com/groups/...")
        await pw.start_capture(run_dir)
        await pw.scroll_feed(max_scrolls=15)
        await pw.stop_capture()
"""
import asyncio
import json
import logging
import os
import random
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, Page, BrowserContext, Response

logger = logging.getLogger("playwright_helper")

# --- Config defaults (override via constructor) ---
MAX_GRAPHQL_BODY_MB = 20
CHUNK_SIZE_BYTES = 50 * 1024 * 1024  # 50MB per chunk


class PlaywrightHelper:

    def __init__(
        self,
        profile_dir: str = "./pw_chrome_data",
        headless: bool = False,
        locale: str = "th-TH",
        viewport: dict | None = None,
        max_body_mb: int = MAX_GRAPHQL_BODY_MB,
        chunk_size_bytes: int = CHUNK_SIZE_BYTES,
    ):
        self.profile_dir = profile_dir
        self.headless = headless
        self.locale = locale
        self.viewport = viewport or {"width": 1280, "height": 900}
        self.max_body_bytes = max_body_mb * 1024 * 1024
        self.chunk_size_bytes = chunk_size_bytes

        # Runtime state
        self._playwright = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

        # Capture state
        self._capturing = False
        self._run_dir: Path | None = None
        self._stream_dir: Path | None = None
        self._current_chunk_file = None
        self._current_chunk_num = 0
        self._current_chunk_size = 0
        self._seq = 0
        self._capture_stats = {
            "responses": 0,
            "bytes_total": 0,
            "skipped_too_large": 0,
            "errors": 0,
        }

        # Worker/account metadata (set before capture)
        self.worker_id: str = "worker_0"
        self.account_id: str = "default"
        self.job_type: str = ""
        self.job_id: str = ""

    # --- Lifecycle ---

    async def start(self):
        """Launch browser with persistent context (reuse login session)"""
        self._playwright = await async_playwright().start()

        logger.info("launching_browser", extra={
            "profile": self.profile_dir, "headless": self.headless
        })

        self._context = await self._playwright.chromium.launch_persistent_context(
            self.profile_dir,
            headless=self.headless,
            viewport=self.viewport,
            locale=self.locale,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-popup-blocking",
            ],
        )

        self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()
        self._resources_blocked = False
        logger.info("browser_ready")

    async def block_heavy_resources(self):
        """Block FB images/fonts/video เพื่อลด RAM ระหว่าง scroll"""
        if self._resources_blocked:
            return

        async def _block_handler(route):
            await route.abort()

        # Block FB CDN images (scontent.xx.fbcdn.net) + fonts + video
        await self._page.route("**/scontent*.fbcdn.net/**", _block_handler)
        await self._page.route("**/video*.fbcdn.net/**", _block_handler)
        await self._page.route("**/*.{woff,woff2,ttf,otf}", _block_handler)

        # ซ่อน comments + reactions ลด DOM size
        await self._page.add_style_tag(content="""
            ul[role="list"] { display: none !important; }
            form[role="presentation"] { display: none !important; }
            [aria-label*="comment" i] { display: none !important; }
            [aria-label*="Comment" i] { display: none !important; }
        """)

        self._resources_blocked = True
        logger.info("heavy_resources_blocked (images/video/fonts/comments)")
        print("    (blocked FB images/video/fonts/comments for faster scroll)")

    async def unblock_resources(self):
        """เปิด resources กลับ (สำหรับ download images)"""
        if not self._resources_blocked:
            return
        await self._page.unroute("**/scontent*.fbcdn.net/**")
        await self._page.unroute("**/video*.fbcdn.net/**")
        await self._page.unroute("**/*.{woff,woff2,ttf,otf}")
        self._resources_blocked = False
        logger.info("resources_unblocked")

    async def close(self):
        """Close browser and cleanup"""
        await self.stop_capture()
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
        self._context = None
        self._page = None
        self._playwright = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *args):
        await self.close()

    @property
    def page(self) -> Page:
        if not self._page:
            raise RuntimeError("Browser not started. Call start() first.")
        return self._page

    # --- Navigation ---

    async def goto(self, url: str, wait_until: str = "domcontentloaded"):
        """Navigate to URL"""
        logger.info("navigating", extra={"url": url[:100]})
        await self.page.goto(url, wait_until=wait_until)

    async def wait(self, ms: int):
        await self.page.wait_for_timeout(ms)

    async def check_facebook_login(self) -> bool:
        """Check if logged in to Facebook. Return True if logged in."""
        url = self.page.url
        if "login" in url or "checkpoint" in url:
            return False
        return "facebook.com" in url

    async def wait_for_login(self):
        """Block until user logs in manually"""
        if await self.check_facebook_login():
            logger.info("already_logged_in")
            return

        logger.info("waiting_for_login")
        print("\n  >>> กรุณา Login Facebook ในหน้าต่าง Chrome แล้วกด Enter <<<\n")
        await asyncio.get_event_loop().run_in_executor(None, input)
        await self.wait(3000)

    # --- Capture Layer (Dumb Recorder) ---

    async def start_capture(self, run_dir: str | Path, known_post_ids: set = None, group_id: str = None):
        """Start capturing GraphQL responses to chunked stream files

        Args:
            run_dir: directory to store raw data
            known_post_ids: set of post_ids ที่เก็บแล้ว (สำหรับ smart scroll skip)
            group_id: V6 — เขียน known_ids ไป groups/{gid}/known_post_ids.txt
        """
        self._group_id = group_id
        self._run_dir = Path(run_dir)
        self._stream_dir = self._run_dir / "graphql_stream"
        self._stream_dir.mkdir(parents=True, exist_ok=True)
        (self._run_dir / "html_snapshots").mkdir(exist_ok=True)

        self._seq = 0
        self._current_chunk_num = 0
        self._current_chunk_size = 0
        self._capture_stats = {"responses": 0, "bytes_total": 0, "skipped_too_large": 0, "errors": 0}

        # Smart scroll: track new vs known posts
        self._known_post_ids = known_post_ids or set()
        self._new_post_ids = set()
        self._skipped_post_ids = set()

        self._open_chunk()
        self._capturing = True

        # Register response listener
        self.page.on("response", self._on_response)

        logger.info("capture_started", extra={"run_dir": str(self._run_dir)})

    async def stop_capture(self):
        """Stop capturing and write run_manifest.json"""
        if not self._capturing:
            return

        self._capturing = False

        # Remove listener
        try:
            self.page.remove_listener("response", self._on_response)
        except Exception:
            pass

        # Close current chunk
        self._close_chunk()

        # Write manifest
        manifest = {
            "run_dir": str(self._run_dir),
            "worker_id": self.worker_id,
            "account_id": self.account_id,
            "started_at": self._capture_stats.get("started_at", ""),
            "finished_at": datetime.now().isoformat(),
            "chunks": self._current_chunk_num + 1,
            "graphql_responses": self._capture_stats["responses"],
            "total_bytes": self._capture_stats["bytes_total"],
            "skipped_too_large": self._capture_stats["skipped_too_large"],
            "errors": self._capture_stats["errors"],
        }
        manifest_path = self._run_dir / "run_manifest.json"
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        logger.info("capture_stopped", extra={
            "responses": self._capture_stats["responses"],
            "chunks": self._current_chunk_num + 1,
        })

    async def _on_response(self, response: Response):
        """Intercept GraphQL responses — capture only, no parsing"""
        if not self._capturing:
            return
        if "/api/graphql" not in response.url:
            return

        try:
            body = await response.text()
        except Exception as e:
            self._capture_stats["errors"] += 1
            logger.debug("response_read_error", extra={"error": str(e)})
            return

        body_size = len(body.encode('utf-8'))

        # Memory guard
        if body_size > self.max_body_bytes:
            self._capture_stats["skipped_too_large"] += 1
            logger.warning("response_too_large", extra={
                "size_mb": round(body_size / 1024 / 1024, 1),
                "url": response.url[:100],
            })
            return

        self._seq += 1

        if not self._capture_stats.get("started_at"):
            self._capture_stats["started_at"] = datetime.now().isoformat()

        # Extract request metadata (best effort — ไม่ parse response body)
        operation_name = ""
        variables = {}
        try:
            post_data = response.request.post_data or ""

            # FB ส่ง GraphQL request เป็น form-encoded หรือ JSON
            # Pattern 1: fb_api_req_friendly_name=XXX (form-encoded)
            match = re.search(r'fb_api_req_friendly_name=([^&]+)', post_data)
            if match:
                operation_name = match.group(1)

            # Pattern 2: "operation_name":"XXX" (JSON)
            if not operation_name:
                match = re.search(r'"operation_name"\s*:\s*"([^"]+)"', post_data)
                if match:
                    operation_name = match.group(1)

            # Extract variables (form-encoded: variables=URL_ENCODED_JSON)
            var_match = re.search(r'variables=([^&]+)', post_data)
            if var_match:
                import urllib.parse
                try:
                    var_str = urllib.parse.unquote(var_match.group(1))
                    variables = json.loads(var_str)
                except (json.JSONDecodeError, Exception):
                    pass

            # Fallback: JSON body
            if not variables:
                var_match2 = re.search(r'"variables"\s*:\s*(\{[^}]*\})', post_data)
                if var_match2:
                    try:
                        variables = json.loads(var_match2.group(1))
                    except json.JSONDecodeError:
                        pass
        except Exception:
            pass

        # Smart scroll: parse post_ids จาก response (best effort)
        if self.job_type == "feed" and self._known_post_ids is not None:
            try:
                from infrastructure.utils.graphql_parser import split_multiline_response, detect_response_shape
                for json_obj in split_multiline_response(body):
                    shape = detect_response_shape(json_obj)
                    if shape.type in ("feed_posts", "story_node"):
                        for node in shape.nodes:
                            pid = node.get("post_id", "")
                            if pid:
                                if pid in self._known_post_ids:
                                    self._skipped_post_ids.add(pid)
                                elif pid not in self._new_post_ids:
                                    self._new_post_ids.add(pid)
                                    self._known_post_ids.add(pid)
                                    # Append known_ids ทันที — resume ได้ถ้าพัง
                                    try:
                                        if getattr(self, '_group_id', None):
                                            from pathlib import Path as _P
                                            _kp = _P(f"groups/{self._group_id}/known_post_ids.txt")
                                            _kp.parent.mkdir(parents=True, exist_ok=True)
                                        else:
                                            _kp = "known_post_ids.txt"
                                        with open(_kp, "a") as _f:
                                            _f.write(pid + "\n")
                                    except Exception:
                                        pass
            except Exception:
                pass  # parse fail → ไม่เป็นไร ยังเก็บ raw เหมือนเดิม

        # Build capture line (ไม่ json.loads response body — เก็บ raw text)
        capture_line = json.dumps({
            "_capture": {
                "seq": self._seq,
                "captured_at": datetime.now().isoformat(),
                "url": response.url[:200],
                "status": response.status,
                "content_type": response.headers.get("content-type", ""),
                "size_bytes": body_size,
                "worker_id": self.worker_id,
                "account_id": self.account_id,
                "job_type": self.job_type,
                "job_id": self.job_id,
            },
            "request": {
                "method": response.request.method,
                "operation_name": operation_name,
                "variables": variables,
            },
            "response_text": body,
        }, ensure_ascii=False)

        # Append to current chunk
        self._write_to_chunk(capture_line + "\n")

        self._capture_stats["responses"] += 1
        self._capture_stats["bytes_total"] += body_size

        # Log progress
        if self._capture_stats["responses"] % 10 == 0:
            logger.info("capture_progress", extra={
                "responses": self._capture_stats["responses"],
                "chunk": self._current_chunk_num,
            })

    def _open_chunk(self):
        """Open a new chunk file for writing"""
        chunk_path = self._stream_dir / f"chunk_{self._current_chunk_num:04d}.jsonl"
        self._current_chunk_file = open(chunk_path, 'a', encoding='utf-8')
        self._current_chunk_size = 0

    def _close_chunk(self):
        """Close current chunk file"""
        if self._current_chunk_file:
            self._current_chunk_file.flush()
            self._current_chunk_file.close()
            self._current_chunk_file = None

    def _write_to_chunk(self, line: str):
        """Write line to current chunk, rotate if needed"""
        if not self._current_chunk_file:
            self._open_chunk()

        self._current_chunk_file.write(line)
        self._current_chunk_file.flush()
        self._current_chunk_size += len(line.encode('utf-8'))

        # Chunk rotation
        if self._current_chunk_size >= self.chunk_size_bytes:
            self._close_chunk()
            self._current_chunk_num += 1
            self._open_chunk()
            logger.info("chunk_rotated", extra={"new_chunk": self._current_chunk_num})

    # --- Scroll (Feed + Comments) ---

    async def scroll_feed(self, max_scrolls: int = 15, max_posts: int = 0):
        """Scroll group feed with human-like delays

        Args:
            max_scrolls: จำนวน scroll สูงสุด (fallback ถ้าไม่ระบุ max_posts)
            max_posts: หยุดเมื่อได้ครบ X posts (0 = ใช้ max_scrolls แทน)
        """
        mode = f"max_posts={max_posts}" if max_posts > 0 else f"max_scrolls={max_scrolls}"
        logger.info("scroll_feed_start", extra={"mode": mode})

        scroll_count = 0
        stale_count = 0
        prev_graphql_new = 0
        prev_graphql_skip = 0

        while True:
            scroll_count += 1

            # กด "ดูเพิ่มเติม" / "See more"
            await self._click_see_more()

            # Scroll
            await self.page.evaluate("window.scrollBy(0, window.innerHeight * 2)")
            delay = human_delay()
            await self.wait(int(delay * 1000))

            # Human-like pause
            if scroll_count % random.randint(10, 20) == 0:
                pause = random.uniform(3, 7)
                logger.info("human_pause", extra={"seconds": round(pause, 1)})
                await self.wait(int(pause * 1000))

            # เช็ค stale จาก GraphQL activity (ไม่ใช่ DOM count)
            curr_new = len(self._new_post_ids)
            curr_skip = len(self._skipped_post_ids)
            has_graphql_activity = (curr_new > prev_graphql_new) or (curr_skip > prev_graphql_skip)

            if has_graphql_activity:
                stale_count = 0
                prev_graphql_new = curr_new
                prev_graphql_skip = curr_skip
            else:
                stale_count += 1

            # ลบ DOM เก่า ทุก 5 scrolls (ลด RAM แต่ไม่ทำ feed พัง)
            if scroll_count % 5 == 0:
                try:
                    cleanup_result = await self.page.evaluate("""
                        () => {
                            let removed = 0;
                            const before = document.querySelectorAll('div').length;

                            // ลบ content ข้างใน feed children เก่า (เก็บ container ไว้ให้ FB scroll ต่อได้)
                            const feed = document.querySelector('[role="feed"]');
                            if (feed) {
                                const children = [...feed.children];
                                const keep = 20;
                                if (children.length > keep) {
                                    for (let i = 0; i < children.length - keep; i++) {
                                        // ลบ content ข้างใน แต่เก็บ div เปล่าไว้
                                        children[i].innerHTML = '';
                                        children[i].style.height = '1px';
                                        children[i].style.overflow = 'hidden';
                                        removed++;
                                    }
                                }
                            }

                            // ลบ sidebar
                            document.querySelectorAll('[role="complementary"]').forEach(el => { el.remove(); removed++; });

                            const after = document.querySelectorAll('div').length;
                            const feedChildren = feed ? feed.children.length : -1;
                            return {
                                removed: removed,
                                feed_children: feedChildren,
                                divs_before: before,
                                divs_after: after
                            };
                        }
                    """)
                    r = cleanup_result or {}
                    print(f"    DOM: divs {r.get('divs_before',0)} -> {r.get('divs_after',0)} | feed: {r.get('feed_children',-1)} | cleaned: {r.get('removed',0)}")
                except Exception as e:
                    print(f"    DOM cleanup ERROR: {e}")

            # Count จาก GraphQL tracking
            new_count = len(self._new_post_ids)
            skip_count = len(self._skipped_post_ids)

            # Log progress
            if scroll_count % 5 == 0:
                logger.info("scroll_progress", extra={
                    "scroll": scroll_count,
                    "new_posts": new_count,
                    "skipped": skip_count,
                    "captured": self._capture_stats["responses"],
                })
                if skip_count > 0:
                    print(f"    scroll {scroll_count} | new: {new_count} skip: {skip_count} | captured: {self._capture_stats['responses']}")
                else:
                    print(f"    scroll {scroll_count} | posts: {new_count} | captured: {self._capture_stats['responses']}")

            # หยุดเมื่อ: ครบ posts ใหม่ / ครบ scrolls / stale 30 ครั้ง (หมด feed)
            if max_posts > 0 and new_count >= max_posts:
                logger.info("scroll_feed_done_by_posts", extra={"new": new_count, "skipped": skip_count, "scrolls": scroll_count})
                print(f"    ✓ ครบ {new_count} posts ใหม่ (ข้าม {skip_count} ซ้ำ, scroll {scroll_count} ครั้ง)")
                break
            if max_posts == 0 and scroll_count >= max_scrolls:
                break
            if stale_count >= 30:
                logger.info("scroll_feed_done_by_stale", extra={"new": new_count, "skip": skip_count, "scrolls": scroll_count})
                print(f"    ✓ หมด feed (new: {new_count}, skip: {skip_count}, stale {stale_count} ครั้ง)")
                break

        logger.info("scroll_feed_done", extra={"new": len(self._new_post_ids), "skip": len(self._skipped_post_ids), "scrolls": scroll_count, "captured": self._capture_stats["responses"]})

    async def scroll_comments(self, max_rounds: int = 50, stale_limit: int = 8,
                              budget_seconds: int = 300):
        """Scroll + click to load all comments — expand first + hybrid stop.

        Stop conditions (hybrid — ไม่พึ่งอันเดียว):
        1. stale_rounds >= stale_limit (ไม่มี content ใหม่)
        2. elapsed >= budget_seconds (timeout)
        3. rounds >= max_rounds (safety limit)
        """
        import time as _time
        logger.info("scroll_comments_start", extra={
            "max_rounds": max_rounds, "stale_limit": stale_limit, "budget_seconds": budget_seconds,
        })

        start_time = _time.time()
        prev_responses = self._capture_stats["responses"]
        stale_count = 0
        stop_reason = "budget"

        for i in range(max_rounds):
            # Timeout check
            elapsed = _time.time() - start_time
            if elapsed >= budget_seconds:
                stop_reason = "timeout"
                break

            # Step 1: EXPAND — กดปุ่ม View more / View hidden
            clicked = await self._click_comment_buttons()
            if clicked:
                await self.wait(3000)

            # Step 2: SCROLL ลงจนสุด — FB load comments เพิ่มเมื่อ scroll ถึงก้น
            # scroll หลายครั้งติดกันเพื่อให้ถึงก้นเร็ว
            for _ in range(5):
                await self._smart_scroll(800)
                await self.wait(500)

            # Step 3: รอให้ FB load content ใหม่ (สำคัญ!)
            await self.wait(3000)

            # Step 4: EXPAND อีกรอบ — ปุ่มใหม่อาจโผล่หลัง load
            await self._click_comment_buttons()
            await self.wait(1000)

            # Progress check
            current = self._capture_stats["responses"]
            if current > prev_responses:
                stale_count = 0
                prev_responses = current
            else:
                stale_count += 1

            if (i + 1) % 5 == 0:
                logger.info("comment_progress", extra={
                    "round": i + 1, "captured": current,
                    "stale": stale_count, "elapsed": int(elapsed),
                })

            # Stale check
            if stale_count >= stale_limit:
                # Last try: scroll to top then bottom
                await self._smart_scroll(-99999)
                await self.wait(2000)
                await self._smart_scroll(99999)
                await self.wait(3000)
                clicked = await self._click_comment_buttons()
                if not clicked:
                    stop_reason = "stale"
                    break
                stale_count = 0

        else:
            stop_reason = "budget"

        elapsed = _time.time() - start_time
        logger.info("scroll_comments_done", extra={
            "captured": self._capture_stats["responses"],
            "rounds": i + 1,
            "elapsed_seconds": int(elapsed),
            "stop_reason": stop_reason,
        })

    async def save_html_snapshot(self, post_id: str):
        """Save DOM snapshot of comment area for HTML extraction later"""
        if not self._run_dir:
            return

        snapshot_path = self._run_dir / "html_snapshots" / f"post_{post_id}_initial.html"

        html = await self.page.evaluate("""
        () => {
            // หา comment area
            const articles = document.querySelectorAll('[role="article"]');
            const parts = [];
            for (const a of articles) {
                parts.push(a.outerHTML);
            }
            return parts.join('\\n');
        }
        """)

        if html:
            with open(snapshot_path, 'w', encoding='utf-8') as f:
                f.write(html)
            logger.info("html_snapshot_saved", extra={"post_id": post_id, "size": len(html)})

    # --- Image Download ---

    async def download_image(self, url: str, save_path: str) -> dict:
        """Download image ผ่าน browser context (มี FB cookies)
        ใช้ page.goto() + response.body() — ทดสอบแล้วว่า work กับ FB CDN
        """
        try:
            resp = await self.page.goto(url)
            if not resp or resp.status != 200:
                return {"ok": False, "error": f"http_{resp.status if resp else 'no_response'}"}

            body = await resp.body()
            if not body or len(body) < 1000:
                return {"ok": False, "error": "empty_or_too_small"}

            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(body)

            return {"ok": True, "size": len(body)}
        except Exception as e:
            return {"ok": False, "error": str(e)[:100]}

    # --- Private helpers ---

    async def _click_see_more(self):
        """Click 'ดูเพิ่มเติม' / 'See more' buttons"""
        try:
            await self.page.evaluate("""
            () => {
                document.querySelectorAll('div[role="button"]').forEach(el => {
                    const t = (el.innerText || '').trim();
                    if (t === 'ดูเพิ่มเติม' || t === 'See more' || t === 'เพิ่มเติม') el.click();
                });
            }
            """)
        except Exception:
            pass

    async def _click_comment_buttons(self) -> bool:
        """Click top-level comment buttons ONLY — ไม่กด View replies

        กดแค่:
        - "View more comments" / "ดูความคิดเห็นเพิ่มเติม" → โหลด top-level เพิ่ม
        - "View hidden comments" / "ดูความคิดเห็นที่ซ่อน" → โหลด hidden top-level
        - "All comments" / "ความคิดเห็นทั้งหมด" → เปลี่ยน filter

        ไม่กด:
        - "View X replies" → ข้าม (ไม่สน nested replies)
        """
        try:
            clicked = await self.page.evaluate("""
            () => {
                const clicked = [];
                const els = document.querySelectorAll('[role="button"], span');
                for (const el of els) {
                    const text = (el.innerText || '').trim().toLowerCase();
                    if (!text || text.length > 80) continue;

                    // TOP-LEVEL ONLY — ไม่กด replies
                    const isBtn =
                        text.includes('view more comment') ||
                        text.includes('ดูความคิดเห็นเพิ่มเติม') ||
                        text.includes('view hidden comment') ||
                        text.includes('ดูความคิดเห็นที่ซ่อน') ||
                        (text.includes('view all') && text.includes('comment')) ||
                        (text.includes('ดูทั้งหมด') && text.includes('ความคิดเห็น')) ||
                        text === 'all comments' ||
                        text === 'ความคิดเห็นทั้งหมด';

                    // SKIP replies — ไม่กด
                    // "view X replies", "view all X replies", "ดู X การตอบกลับ"

                    if (isBtn && el.offsetParent !== null) {
                        el.click();
                        clicked.push(text.substring(0, 40));
                    }
                }
                return clicked;
            }
            """)
            if clicked:
                for btn in clicked:
                    logger.debug("clicked_button", extra={"text": btn})
            return len(clicked) > 0
        except Exception:
            return False

    async def _smart_scroll(self, distance: int):
        """Scroll ใน modal หรือ window — detect อัตโนมัติ

        Priority:
        1. Scrollable child ใน dialog (FB ใส่ overflow:auto ใน div ข้างใน)
        2. Dialog เอง (ถ้า scrollable)
        3. Window (fullpage)
        """
        await self.page.evaluate(f"""
        () => {{
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {{
                // Strategy 1: หา scrollable child ใน dialog (สำคัญที่สุด!)
                // FB ใส่ overflow:auto ใน div ข้างใน ไม่ใช่ dialog เอง
                const divs = dialog.querySelectorAll('div');
                for (const d of divs) {{
                    const style = getComputedStyle(d);
                    const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll')
                        && d.scrollHeight > d.clientHeight + 100;
                    if (isScrollable) {{
                        d.scrollBy(0, {distance});
                        return;
                    }}
                }}
                // Strategy 2: dialog เอง
                if (dialog.scrollHeight > dialog.clientHeight + 200) {{
                    dialog.scrollBy(0, {distance});
                    return;
                }}
            }}
            // Strategy 3: window (fullpage)
            window.scrollBy(0, {distance});
        }}
        """)


def human_delay() -> float:
    """Weighted delay — เร็วเพราะ DOM เล็ก (cleanup ทุก 5 scrolls)"""
    roll = random.random()
    if roll < 0.80:
        return random.uniform(1, 3)     # 80% = เลื่อนเร็ว
    elif roll < 0.95:
        return random.uniform(3, 6)     # 15% = หยุดดูโพส
    else:
        return random.uniform(6, 10)    # 5% = พักนิด
