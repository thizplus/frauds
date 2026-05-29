# Phase 2: Bot Collector - Checklist

Python Clean Architecture + DrissionPage
อ้างอิง pattern จาก `bot_supjav` + PLAN.md

---

## โครงสร้าง Project

```
fraud-collector/
├── domain/                                # Domain Layer (ไม่พึ่ง framework)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── fraud_record.py               # FraudRecord entity
│   │   ├── raw_post.py                   # RawPost value object
│   │   ├── category_config.py            # CategoryConfig (จาก yaml)
│   │   └── enums.py                      # RecordStatus
│   └── ports/
│       ├── __init__.py
│       ├── scraper_port.py               # ScraperPort (ABC)
│       ├── parser_port.py                # ParserPort (ABC)
│       ├── storage_port.py               # StoragePort (ABC)
│       ├── dedup_port.py                 # DedupPort (ABC)
│       ├── notifier_port.py              # NotifierPort (ABC)
│       └── scheduler_port.py             # SchedulerPort (ABC)
│
├── application/                           # Application Layer (Use Cases)
│   ├── __init__.py
│   └── usecases/
│       ├── __init__.py
│       ├── collect_fraud.py              # CollectFraudUseCase (หลัก)
│       └── login_browser.py              # LoginBrowserUseCase
│
├── infrastructure/                        # Infrastructure Layer (Adapters)
│   ├── __init__.py
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── scrapers/
│   │   │   ├── __init__.py
│   │   │   ├── facebook_group_scraper.py # เข้ากลุ่ม → scroll → ดึงโพสต์
│   │   │   └── facebook_search_scraper.py# FB Search → พิมพ์ keyword → ดึงผล
│   │   ├── parsers/
│   │   │   ├── __init__.py
│   │   │   ├── base_thai_parser.py       # regex กลาง (เบอร์/บัญชี/ชื่อ/บัตร)
│   │   │   ├── loan_parser.py            # keyword เฉพาะเงินกู้
│   │   │   ├── share_parser.py           # keyword เฉพาะวงแชร์
│   │   │   └── generic_parser.py         # parser กลาง (ใช้ได้ทุกหมวด)
│   │   ├── storage/
│   │   │   ├── __init__.py
│   │   │   ├── api_storage.py            # POST ไป Go API
│   │   │   └── jsonl_storage.py          # เก็บ JSONL backup
│   │   ├── dedup/
│   │   │   ├── __init__.py
│   │   │   ├── api_dedup.py              # เช็คซ้ำผ่าน API
│   │   │   └── local_dedup.py            # เช็คซ้ำ in-memory
│   │   ├── notifiers/
│   │   │   ├── __init__.py
│   │   │   ├── telegram_notifier.py      # Telegram Bot API
│   │   │   └── log_notifier.py           # Log to console/file
│   │   └── schedulers/
│   │       ├── __init__.py
│   │       └── apscheduler_adapter.py    # APScheduler
│   ├── browser/
│   │   ├── __init__.py
│   │   └── browser_helper.py             # BrowserHelper (DrissionPage)
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py                   # Settings (pydantic-settings)
│   │   └── category_loader.py            # โหลด categories.yaml
│   └── di/
│       ├── __init__.py
│       └── container.py                  # DI Container
│
├── interface/                             # Interface Layer (Entry Point)
│   ├── __init__.py
│   └── cli/
│       ├── __init__.py
│       └── commands.py                   # Typer CLI
│
├── categories.yaml                        # Category config (เพิ่มหมวดที่นี่)
├── requirements.txt
├── .env
├── .env.example
├── Dockerfile
└── README.md
```

---

## Checklist

### 1. Project Setup

- [ ] สร้างโฟลเดอร์ทั้งหมด + `__init__.py`
- [ ] `requirements.txt`
  ```
  DrissionPage>=4.0.0
  beautifulsoup4>=4.12.0
  lxml>=5.0.0
  requests>=2.31.0
  httpx>=0.26.0
  pydantic>=2.5.0
  pydantic-settings>=2.1.0
  typer>=0.9.0
  rich>=13.7.0
  apscheduler>=3.10.0
  pyyaml>=6.0.0
  ```
- [ ] `.env.example` + `.env`
- [ ] `Dockerfile`

### 2. Domain Layer - Models

- [ ] **domain/models/enums.py**
  ```python
  class RecordStatus(str, Enum):
      PENDING = "pending"
      SENT = "sent"
      DUPLICATE = "duplicate"
      ERROR = "error"
  ```

- [ ] **domain/models/raw_post.py**
  ```python
  class RawPost(BaseModel):
      text: str
      post_url: str | None = None
      author: str | None = None
      posted_at: str | None = None
      source_url: str = ""
  ```

- [ ] **domain/models/fraud_record.py**
  ```python
  class FraudRecord(BaseModel):
      id: str | None = None
      category: str = ""
      fraud_type: str | None = None
      name: str | None = None
      phone: str | None = None
      bank_account: str | None = None
      bank_name: str | None = None
      id_card: str | None = None
      description: str | None = None
      amount: float | None = None
      extra_data: dict | None = None
      source_url: str = ""
      source_type: str = ""
      raw_text: str | None = None
      status: str = "pending"
      scraped_at: str | None = None

      def has_any_data(self) -> bool
      def is_complete(self) -> bool
  ```

- [ ] **domain/models/category_config.py**
  ```python
  class CategoryConfig(BaseModel):
      id: str
      name: str
      parser: str               # "loan", "share", "generic"
      groups: list[str] = []
      search_keywords: list[str] = []
      fraud_keywords: list[str] = []
      enabled: bool = True
      scrape_interval_minutes: int = 15
  ```

### 3. Domain Layer - Ports (6 interfaces)

- [ ] **domain/ports/scraper_port.py** - ScraperPort
  ```python
  scrape(target: str, **kwargs) -> list[RawPost]
  get_type() -> str    # "group" หรือ "search"
  ```

- [ ] **domain/ports/parser_port.py** - ParserPort
  ```python
  parse(raw_text: str) -> FraudRecord
  is_fraud_post(raw_text: str, fraud_keywords: list[str]) -> bool
  ```

- [ ] **domain/ports/storage_port.py** - StoragePort
  ```python
  save(record: FraudRecord) -> bool
  save_batch(records: list[FraudRecord]) -> int
  ```

- [ ] **domain/ports/dedup_port.py** - DedupPort
  ```python
  is_duplicate(record: FraudRecord) -> bool
  mark_seen(record: FraudRecord) -> None
  ```

- [ ] **domain/ports/notifier_port.py** - NotifierPort
  ```python
  notify(message: str, level: str = "info") -> bool
  notify_new_frauds(records: list[FraudRecord]) -> bool
  ```

- [ ] **domain/ports/scheduler_port.py** - SchedulerPort
  ```python
  schedule(func, interval_minutes: int, job_id: str) -> None
  start() -> None
  stop() -> None
  ```

### 4. Infrastructure - Config

- [ ] **infrastructure/config/settings.py** - pydantic-settings
  ```python
  class Settings(BaseSettings):
      api_base_url: str = "http://localhost:3000/api/v1"
      api_key: str = ""
      browser_headless: bool = False
      browser_user_data_dir: str = "./chrome_data"
      active_categories: str = "loan_fraud,share_fraud"
      max_scroll_rounds: int = 20
      scrape_interval_minutes: int = 15
      scroll_delay_min: float = 2.0
      scroll_delay_max: float = 5.0
      telegram_bot_token: str = ""
      telegram_chat_id: str = ""
      log_level: str = "INFO"
      log_file_path: str = "logs/collector.log"
  ```

- [ ] **infrastructure/config/category_loader.py**
  ```python
  def load_categories(path: str = "categories.yaml") -> list[CategoryConfig]
  ```

- [ ] **categories.yaml** - category config
  ```yaml
  categories:
    loan_fraud:
      name: "โกงเงินกู้"
      parser: "loan"
      groups: []              # ใส่ FB Group URLs จริง
      search_keywords:
        - "โกงเงินกู้"
        - "โดนโกง ค่าดำเนินการ"
      fraud_keywords:
        - "โดนโกง"
        - "หลอก"
        - "ค่าดำเนินการ"
    share_fraud:
      name: "โกงวงแชร์"
      parser: "share"
      groups: []
      search_keywords:
        - "โกงวงแชร์"
        - "ท้าวแชร์หนี"
      fraud_keywords:
        - "เล่นไม่จ่าย"
        - "ล้มแชร์"
  ```

### 5. Infrastructure - Browser

- [ ] **infrastructure/browser/browser_helper.py** (pattern จาก bot_supjav)
  ```python
  class BrowserHelper:
      __init__(instance_id, headless, user_data_dir)
      get_browser() -> ChromiumPage
      wait_for_facebook_login(timeout) -> bool
      close()
      __enter__ / __exit__  (context manager)
  ```
  - DrissionPage ChromiumPage
  - disable-blink-features=AutomationControlled
  - auto_port(True)
  - user_data_dir สำหรับ FB session

### 6. Infrastructure - Adapters (Scrapers)

- [ ] **adapters/scrapers/facebook_group_scraper.py**
  ```
  - implements ScraperPort
  - get_type() = "group"
  - scrape(group_url):
    1. browser.get(group_url)
    2. เช็ค login (ถ้า redirect → wait_for_facebook_login)
    3. scroll loop (max_scrolls รอบ)
    4. BeautifulSoup parse div[role="article"]
    5. extract text + permalink
    6. return list[RawPost]
  - random delay ระหว่าง scroll (2-5 วินาที)
  ```

- [ ] **adapters/scrapers/facebook_search_scraper.py**
  ```
  - implements ScraperPort
  - get_type() = "search"
  - scrape(keyword):
    1. browser.get(f"https://www.facebook.com/search/posts/?q={keyword}")
    2. scroll loop (max_scrolls รอบ, ช้ากว่า group)
    3. BeautifulSoup parse div[role="article"]
    4. return list[RawPost]
  - random delay ระหว่าง scroll (3-7 วินาที, ช้ากว่า group)
  ```

### 7. Infrastructure - Adapters (Parsers)

- [ ] **adapters/parsers/base_thai_parser.py** - regex กลางที่ทุก parser ใช้
  ```
  PHONE_PATTERNS:      0[689]X-XXX-XXXX
  BANK_ACCOUNT_PATTERNS: 10-15 หลัก + ชื่อธนาคาร
  BANK_NAMES:          กสิกร, กรุงเทพ, ไทยพาณิชย์, กรุงไทย, ออมสิน, ...
  ID_CARD_PATTERNS:    13 หลัก (X-XXXX-XXXXX-XX-X)
  NAME_PATTERNS:       นาย/นาง/น.ส. + ชื่อ นามสกุล
  AMOUNT_PATTERN:      ตัวเลข + บาท

  _extract_phone(text) -> str | None
  _extract_bank_account(text) -> str | None
  _extract_bank_name(text) -> str | None
  _extract_id_card(text) -> str | None
  _extract_name(text) -> str | None
  _extract_amount(text) -> float | None
  ```

- [ ] **adapters/parsers/loan_parser.py** - เฉพาะเงินกู้
  ```
  - extends BaseThaiParser, implements ParserPort
  - FRAUD_KEYWORDS: โดนโกง, ค่าดำเนินการ, แอปปลอม, ดอกโหด, ...
  - is_fraud_post(): เช็คว่ามี keyword (กรองโฆษณาออก)
  - parse(): base extract + detect loan_type (advance_fee, fake_app, ...)
  - extra_data: {loan_amount, fee_paid}
  ```

- [ ] **adapters/parsers/share_parser.py** - เฉพาะวงแชร์
  ```
  - extends BaseThaiParser, implements ParserPort
  - FRAUD_KEYWORDS: เล่นไม่จ่าย, ล้มแชร์, หนีแชร์, ...
  - SHARE_PATTERNS: มือที่ X, X งวด, วงแชร์ X บาท
  - extra_data: {share_hand, share_amount, overdue_rounds, host_name}
  ```

- [ ] **adapters/parsers/generic_parser.py** - ใช้ได้ทุกหมวด
  ```
  - extends BaseThaiParser, implements ParserPort
  - is_fraud_post(): ใช้ fraud_keywords จาก config
  - parse(): base extract เท่านั้น (ไม่มี extra_data)
  ```

### 8. Infrastructure - Adapters (Storage)

- [ ] **adapters/storage/api_storage.py**
  ```
  - implements StoragePort
  - POST http://api:3000/api/v1/bot/frauds (Header: X-API-Key)
  - POST .../bot/frauds/batch
  - ใช้ httpx async client
  ```

- [ ] **adapters/storage/jsonl_storage.py** (pattern จาก bot_supjav)
  ```
  - implements StoragePort
  - บันทึกลง scraped_data/*.jsonl
  - เป็น backup กรณี API ล่ม
  ```

### 9. Infrastructure - Adapters (Dedup)

- [ ] **adapters/dedup/api_dedup.py**
  ```
  - implements DedupPort
  - GET /bot/frauds/check?phone=xxx&bankAccount=xxx
  - ถ้า exists → duplicate
  ```

- [ ] **adapters/dedup/local_dedup.py**
  ```
  - implements DedupPort
  - เก็บ seen set ใน memory (phone + bank_account)
  - fallback กรณี API ล่ม
  ```

### 10. Infrastructure - Adapters (Notifier + Scheduler)

- [ ] **adapters/notifiers/log_notifier.py**
  ```
  - implements NotifierPort
  - print/log เมื่อเจอข้อมูลใหม่ (ใช้ Rich console)
  ```

- [ ] **adapters/notifiers/telegram_notifier.py** (optional)
  ```
  - implements NotifierPort
  - Telegram Bot API (sendMessage)
  - ส่งแจ้งเตือนเมื่อเจอข้อมูลใหม่
  - รองรับ Markdown format
  - สร้าง bot ผ่าน @BotFather → ได้ token
  - ดึง chat_id จาก getUpdates
  ```

- [ ] **adapters/schedulers/apscheduler_adapter.py**
  ```
  - implements SchedulerPort
  - APScheduler AsyncIOScheduler
  - schedule(): add_job interval
  - start() / stop()
  ```

### 11. Application Layer - Use Cases

- [ ] **application/usecases/collect_fraud.py** - CollectFraudUseCase
  ```python
  __init__(group_scraper, search_scraper, parsers, storage, dedup, notifier)

  execute(category: CategoryConfig) -> CollectResult:
      1. เลือก parser จาก category.parser
      2. Scrape FB Groups (วิธีที่ 1) → list[RawPost]
      3. Scrape FB Search (วิธีที่ 2) → list[RawPost]
      4. รวม raw_posts
      5. แต่ละ post:
         - parser.is_fraud_post() → กรองโฆษณา
         - parser.parse() → FraudRecord
         - dedup.is_duplicate() → ข้ามซ้ำ
         - storage.save() → บันทึก
      6. notifier.notify_new_frauds()
      7. return CollectResult(stats)
  ```

- [ ] **application/usecases/login_browser.py** - LoginBrowserUseCase
  ```python
  execute():
      1. เปิด Chrome → ไป facebook.com
      2. รอ user login ด้วยมือ
      3. session ถูกเก็บใน chrome_data/
  ```

### 12. Infrastructure - DI Container

- [ ] **infrastructure/di/container.py**
  ```python
  class Container:
      __init__(settings, categories):
          # Browser (shared)
          self._browser = BrowserHelper(...)

          # Scrapers
          self._group_scraper = FacebookGroupScraper(browser)
          self._search_scraper = FacebookSearchScraper(browser)

          # Parsers (register ทั้งหมด)
          self._parsers = {
              "loan": LoanParser(),
              "share": ShareParser(),
              "generic": GenericParser(),
          }

          # Storage, Dedup, Notifier
          self._storage = ApiStorage(api_url, api_key)  # หรือ JsonlStorage
          self._dedup = ApiDedup(api_url, api_key)       # หรือ LocalDedup
          self._notifier = LogNotifier()                  # หรือ TelegramNotifier

      get_collect_usecase() -> CollectFraudUseCase
      get_active_categories() -> list[CategoryConfig]
      close()
  ```

### 13. Interface Layer - CLI

- [ ] **interface/cli/commands.py**
  ```python
  app = typer.Typer(name="fraud-collector")

  @app.command()
  def scrape(category, method, once, instance):
      """Scrape Facebook ตามหมวด"""
      # category="all" / "loan_fraud" / "share_fraud"
      # method="all" / "group" / "search"
      # once=True → ครั้งเดียว, False → 24/7 scheduler

  @app.command()
  def login(instance):
      """เปิด Chrome เพื่อ login Facebook"""

  @app.command()
  def categories():
      """แสดงหมวดจาก categories.yaml"""

  @app.command()
  def status():
      """แสดงสถิติ"""
  ```

### 14. Docker + docker-compose

- [ ] **Dockerfile**
  ```
  - Python 3.12
  - ติดตั้ง Chrome/Chromium (สำหรับ DrissionPage)
  - ⚠️ DrissionPage ต้อง Chrome จริง ไม่ใช่ headless-only
  - อาจต้องใช้ noVNC สำหรับ login ครั้งแรก
  ```

- [ ] อัพเดต **docker-compose.yml** (root)
  ```yaml
  collector:
    build: ./fraud-collector
    volumes:
      - ./fraud-collector/chrome_data:/app/chrome_data   # เก็บ FB session
      - ./fraud-collector/scraped_data:/app/scraped_data
      - ./fraud-collector/categories.yaml:/app/categories.yaml
    environment:
      - API_BASE_URL=http://api:3000/api/v1
      - API_KEY=dev-bot-api-key-12345
      - BROWSER_HEADLESS=true
    depends_on:
      - api
  ```

### 15. .env.example

```env
# Go API
API_BASE_URL=http://localhost:3000/api/v1
API_KEY=dev-bot-api-key-12345

# Browser
BROWSER_HEADLESS=false
BROWSER_USER_DATA_DIR=./chrome_data

# Scraping
ACTIVE_CATEGORIES=loan_fraud,share_fraud
MAX_SCROLL_ROUNDS=20
SCRAPE_INTERVAL_MINUTES=15
SCROLL_DELAY_MIN=2.0
SCROLL_DELAY_MAX=5.0

# Telegram Notification (optional)
# สร้าง bot: พิมพ์ /newbot ใน @BotFather → ได้ token
# ดึง chat_id: ส่งข้อความหา bot แล้วเปิด https://api.telegram.org/bot<TOKEN>/getUpdates
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Logging
LOG_LEVEL=INFO
LOG_FILE_PATH=logs/collector.log
```

---

## ลำดับการทำงาน

```
1.  Project setup (folders, requirements, .env)
2.  domain/models        → FraudRecord, RawPost, CategoryConfig, enums
3.  domain/ports         → 6 port interfaces (ABC)
4.  infrastructure/config → Settings + category_loader + categories.yaml
5.  infrastructure/browser → BrowserHelper (DrissionPage)
6.  adapters/parsers     → BaseThaiParser + LoanParser + GenericParser
7.  adapters/scrapers    → FacebookGroupScraper + FacebookSearchScraper
8.  adapters/storage     → ApiStorage + JsonlStorage
9.  adapters/dedup       → ApiDedup + LocalDedup
10. adapters/notifiers   → LogNotifier
11. adapters/schedulers  → APSchedulerAdapter
12. application/usecases → CollectFraudUseCase + LoginBrowserUseCase
13. infrastructure/di    → Container (wire ทุกอย่าง)
14. interface/cli        → Typer commands
15. Dockerfile + อัพเดต docker-compose.yml
16. ทดสอบ: login → scrape --once → ดูข้อมูลใน API
```

---

## ข้อควรระวัง

### Facebook Scraping
- **ต้อง login ครั้งแรกด้วยมือ** → `python -m interface.cli.commands login`
- Session เก็บใน `chrome_data/` → ครั้งต่อไปไม่ต้อง login
- อาจโดน **checkpoint** ถ้า:
  - scroll เร็วเกิน → ใช้ random delay (2-7 วินาที)
  - ใช้ IP ใหม่ → ใช้ IP เดิมเสมอ
  - headless mode → ใช้ headed mode ก่อน

### DrissionPage ใน Docker
- ต้องติดตั้ง Chromium ใน container
- Login ครั้งแรกอาจต้อง:
  - รันบนเครื่องจริง (ไม่ใช่ Docker) แล้ว copy chrome_data/ ไป container
  - หรือใช้ noVNC ดูหน้าจอ Chrome ใน container
- หลัง login แล้ว → headless=true ได้

### Parser Accuracy
- Regex อาจไม่ครบ 100% → ค่อยเพิ่ม pattern จาก data จริง
- โพสต์โฆษณา vs โพสต์แจ้งโกง → ต้อง tune fraud_keywords
- ชื่อคนไทยมีหลาย format → เริ่มจาก นาย/นาง/น.ส. ก่อน
