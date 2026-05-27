"""DI Container - wire ทุก port -> adapter"""
from domain.models.category_config import CategoryConfig
from domain.ports.dedup_port import DedupPort
from domain.ports.notifier_port import NotifierPort
from domain.ports.ocr_port import OcrPort
from domain.ports.storage_port import StoragePort

from infrastructure.adapters.scrapers.facebook_group_scraper import FacebookGroupScraper
from infrastructure.adapters.scrapers.facebook_search_scraper import FacebookSearchScraper
from infrastructure.adapters.parsers.loan_parser import LoanParser
from infrastructure.adapters.parsers.share_parser import ShareParser
from infrastructure.adapters.parsers.generic_parser import GenericParser
from infrastructure.adapters.storage.api_storage import ApiStorage
from infrastructure.adapters.storage.jsonl_storage import JsonlStorage
from infrastructure.adapters.dedup.api_dedup import ApiDedup
from infrastructure.adapters.dedup.local_dedup import LocalDedup
from infrastructure.adapters.notifiers.log_notifier import LogNotifier
from infrastructure.adapters.notifiers.telegram_notifier import TelegramNotifier
from infrastructure.adapters.schedulers.apscheduler_adapter import APSchedulerAdapter
from infrastructure.browser.browser_helper import BrowserHelper
from infrastructure.config.settings import Settings

from application.usecases.collect_fraud import CollectFraudUseCase
from application.usecases.login_browser import LoginBrowserUseCase


class Container:

    def __init__(self, settings: Settings, categories: list[CategoryConfig]):
        self.settings = settings
        self.categories = categories

        # Browser (shared)
        self._browser = BrowserHelper(
            headless=settings.browser_headless,
            user_data_dir=settings.browser_user_data_dir,
        )

        # Scrapers
        self._group_scraper = FacebookGroupScraper(
            self._browser,
            scroll_delay=(settings.scroll_delay_min, settings.scroll_delay_max),
        )
        self._search_scraper = FacebookSearchScraper(
            self._browser,
            scroll_delay=(settings.scroll_delay_min + 1, settings.scroll_delay_max + 2),
        )

        # Parsers
        self._parsers = {
            "loan": LoanParser(),
            "share": ShareParser(),
            "generic": GenericParser(),
        }

        # Storage
        self._storage: StoragePort = self._build_storage()

        # Dedup
        self._dedup: DedupPort = self._build_dedup()

        # Notifier
        self._notifier: NotifierPort = self._build_notifier()

        # OCR
        self._ocr: OcrPort | None = self._build_ocr()

        # Scheduler
        self._scheduler = APSchedulerAdapter()

    def _build_storage(self) -> StoragePort:
        if self.settings.api_base_url and self.settings.api_key:
            return ApiStorage(self.settings.api_base_url, self.settings.api_key)
        return JsonlStorage()

    def _build_dedup(self) -> DedupPort:
        if self.settings.api_base_url and self.settings.api_key:
            return ApiDedup(self.settings.api_base_url, self.settings.api_key)
        return LocalDedup()

    def _build_ocr(self) -> OcrPort | None:
        engine = self.settings.ocr_engine.lower()
        if engine == "easyocr":
            from infrastructure.adapters.ocr.easyocr_adapter import EasyOcrAdapter
            return EasyOcrAdapter(gpu=self.settings.ocr_gpu)
        # อนาคต: "tesseract", "paddleocr", "google_vision"
        return None

    def _build_notifier(self) -> NotifierPort:
        if self.settings.telegram_bot_token and self.settings.telegram_chat_id:
            return TelegramNotifier(
                self.settings.telegram_bot_token,
                self.settings.telegram_chat_id,
            )
        return LogNotifier()

    def get_collect_usecase(self) -> CollectFraudUseCase:
        return CollectFraudUseCase(
            group_scraper=self._group_scraper,
            search_scraper=self._search_scraper,
            parsers=self._parsers,
            storage=self._storage,
            dedup=self._dedup,
            notifier=self._notifier,
            ocr=self._ocr,
        )

    def get_login_usecase(self) -> LoginBrowserUseCase:
        return LoginBrowserUseCase(self._browser)

    def get_active_categories(self) -> list[CategoryConfig]:
        active_ids = [c.strip() for c in self.settings.active_categories.split(",")]
        return [c for c in self.categories if c.enabled and c.id in active_ids]

    def get_scheduler(self) -> APSchedulerAdapter:
        return self._scheduler

    def close(self):
        self._browser.close()
