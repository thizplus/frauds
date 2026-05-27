"""BrowserHelper - DrissionPage Chrome controller (pattern จาก bot_supjav)"""
import time
from typing import Optional

from DrissionPage import ChromiumPage, ChromiumOptions


class BrowserHelper:
    def __init__(self, headless: bool = False, user_data_dir: str = "./chrome_data", instance_id: int = 0):
        self.headless = headless
        self.user_data_dir = user_data_dir
        self.instance_id = instance_id
        self._browser: Optional[ChromiumPage] = None

    def get_browser(self) -> ChromiumPage:
        """Get or create browser instance"""
        if self._browser is None:
            options = ChromiumOptions()
            options.set_argument('--disable-popup-blocking')

            if self.user_data_dir:
                data_dir = f"{self.user_data_dir}_{self.instance_id}"
                options.set_user_data_path(data_dir)
                print(f"  [Browser {self.instance_id}] User data: {data_dir}")

            if self.headless:
                options.headless()

            options.auto_port(True)
            print(f"  [Browser {self.instance_id}] Starting Chrome...")
            self._browser = ChromiumPage(options)

        return self._browser

    def wait_for_facebook_login(self, timeout: int = 0) -> bool:
        """
        รอจนกว่า user จะ login Facebook เสร็จ
        timeout=0 → รอไม่มี timeout
        """
        browser = self.get_browser()
        start_time = time.time()
        shown_waiting = False

        while timeout == 0 or (time.time() - start_time < timeout):
            url = browser.url or ""

            if "facebook.com" in url and "login" not in url and "checkpoint" not in url:
                if shown_waiting:
                    print(f"  [Browser {self.instance_id}] Facebook login OK")
                return True

            if not shown_waiting:
                print(f"  [Browser {self.instance_id}] กรุณา login Facebook ในหน้าต่าง Chrome...")
                shown_waiting = True

            elapsed = int(time.time() - start_time)
            if elapsed > 0 and elapsed % 30 == 0:
                print(f"  [Browser {self.instance_id}] ยังรอ login อยู่... ({elapsed}s)")

            time.sleep(3)

        print(f"  [Browser {self.instance_id}] Login timeout")
        return False

    def close(self):
        if self._browser:
            try:
                self._browser.quit()
            except Exception:
                pass
            self._browser = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
