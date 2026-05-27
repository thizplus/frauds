"""Facebook Search Scraper - พิมพ์ keyword ในช่องค้นหา FB -> ดึงผล"""
import random
import time
from urllib.parse import quote

from bs4 import BeautifulSoup

from domain.models.raw_post import RawPost
from domain.ports.scraper_port import ScraperPort
from infrastructure.browser.browser_helper import BrowserHelper


class FacebookSearchScraper(ScraperPort):

    def __init__(self, browser: BrowserHelper, scroll_delay: tuple[float, float] = (3.0, 7.0)):
        self.browser = browser
        self.scroll_delay = scroll_delay

    def get_type(self) -> str:
        return "search"

    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        """
        target = search keyword เช่น "โกงเงินกู้"
        kwargs: max_scrolls (default 10)
        """
        max_scrolls = kwargs.get("max_scrolls", 10)
        browser = self.browser.get_browser()

        search_url = f"https://www.facebook.com/search/posts/?q={quote(target)}"
        print(f"  [SearchScraper] Searching: {target}")
        browser.get(search_url)
        time.sleep(4)

        # เช็ค login
        url = browser.url or ""
        if "login" in url or "checkpoint" in url:
            print("  [SearchScraper] Facebook login required...")
            if not self.browser.wait_for_facebook_login():
                return []
            browser.get(search_url)
            time.sleep(4)

        posts = []
        seen = set()

        for scroll_num in range(max_scrolls):
            html = browser.html
            new_posts = self._extract_posts(html, search_url, seen)
            posts.extend(new_posts)

            browser.scroll.to_bottom()
            delay = random.uniform(*self.scroll_delay)
            time.sleep(delay)

            if scroll_num > 0 and scroll_num % 3 == 0:
                print(f"  [SearchScraper] Scroll {scroll_num}/{max_scrolls} - {len(posts)} posts")

        print(f"  [SearchScraper] Done - {len(posts)} posts for '{target}'")
        return posts

    def _extract_posts(self, html: str, source_url: str, seen: set) -> list[RawPost]:
        posts = []
        soup = BeautifulSoup(html, "lxml")

        for article in soup.find_all('div', attrs={'role': 'article'}):
            text = article.get_text(separator='\n', strip=True)
            if not text or len(text) < 20:
                continue

            text_hash = hash(text[:200])
            if text_hash in seen:
                continue
            seen.add(text_hash)

            posts.append(RawPost(
                text=text[:3000],
                source_url=source_url,
            ))

        return posts
