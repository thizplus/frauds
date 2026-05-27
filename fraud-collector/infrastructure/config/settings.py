from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Go API
    api_base_url: str = "http://localhost:3000/api/v1"
    api_key: str = ""

    # Browser (DrissionPage)
    browser_headless: bool = False
    browser_user_data_dir: str = "./chrome_data"

    # Scraping
    active_categories: str = "loan_fraud,share_fraud"
    max_scroll_rounds: int = 20

    # OCR
    ocr_engine: str = "easyocr"       # easyocr / none
    ocr_gpu: bool = False
    scrape_interval_minutes: int = 15
    scroll_delay_min: float = 2.0
    scroll_delay_max: float = 5.0

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Logging
    log_level: str = "INFO"
    log_file_path: str = "logs/collector.log"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
