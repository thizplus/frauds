"""LoginBrowserUseCase - เปิด Chrome ให้ user login Facebook"""
from infrastructure.browser.browser_helper import BrowserHelper


class LoginBrowserUseCase:

    def __init__(self, browser: BrowserHelper):
        self.browser = browser

    def execute(self) -> bool:
        """เปิด Chrome -> ไป facebook.com -> รอ user login"""
        browser = self.browser.get_browser()
        browser.get("https://www.facebook.com")

        print("\n  เปิด Chrome แล้ว กรุณา login Facebook ในหน้าต่างที่เปิดขึ้น")
        print("  Session จะถูกเก็บไว้ ครั้งต่อไปไม่ต้อง login ใหม่\n")

        success = self.browser.wait_for_facebook_login(timeout=0)

        if success:
            print("\n  Login สำเร็จ! ปิดหน้าต่างนี้ได้เลย")
            print("  ใช้คำสั่ง 'scrape' เพื่อเริ่มเก็บข้อมูล\n")
        else:
            print("\n  Login ไม่สำเร็จ\n")

        return success
