# Fraud Checker - ระบบเช็กคนโกง (Multi-Category)

## Overview

ระบบเช็คและรวบรวมข้อมูลคนโกง **รองรับหมวดหมู่ไม่จำกัด** เพิ่มหัวข้อใหม่ได้ผ่าน Config ไม่ต้องแก้ code

**ฟรีทั้งหมด ไม่มีค่าใช้จ่าย** รันในเครื่องตัวเอง

ทุกส่วนเป็น **Clean Architecture + Port/Adapter**

---

## หัวใจของระบบ: Category = Config ไม่ใช่ Code

### หมวดหมู่ไม่จำกัด (เพิ่มผ่าน config)

```
ปัจจุบัน:
  - loan_fraud    (โกงเงินกู้)
  - share_fraud   (โกงวงแชร์)

อนาคต (เพิ่มเมื่อไหร่ก็ได้):
  - online_scam       (โกงซื้อขาย)
  - investment_fraud   (โกงลงทุน)
  - romance_scam       (โกงความรัก)
  - job_scam           (หลอกสมัครงาน)
  - ...ไม่จำกัด
```

### แต่ละหมวดมี 2 วิธีเก็บข้อมูลจาก Facebook

```
┌─────────────────────────────────────────────────────────┐
│  หมวด "โกงเงินกู้" (loan_fraud)                          │
│                                                          │
│  วิธีที่ 1: Facebook Group Scraper                       │
│  ├─ เข้ากลุ่ม FB เงินกู้ → scroll → ดึงโพสต์              │
│  ├─ กลุ่ม A: https://fb.com/groups/xxx                   │
│  └─ กลุ่ม B: https://fb.com/groups/yyy                   │
│                                                          │
│  วิธีที่ 2: Facebook Search Scraper                      │
│  ├─ พิมพ์ค้นหาใน FB Search → ดึงผลลัพธ์                  │
│  ├─ keyword: "โกงเงินกู้"                                 │
│  ├─ keyword: "โดนโกง ค่าดำเนินการ"                        │
│  └─ keyword: "แอปเงินกู้ หลอก"                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  หมวด "โกงวงแชร์" (share_fraud)                          │
│                                                          │
│  วิธีที่ 1: Facebook Group Scraper                       │
│  ├─ เข้ากลุ่ม FB แชร์ → scroll → ดึงโพสต์                 │
│  ├─ กลุ่ม A: https://fb.com/groups/aaa                   │
│  └─ กลุ่ม B: https://fb.com/groups/bbb                   │
│                                                          │
│  วิธีที่ 2: Facebook Search Scraper                      │
│  ├─ keyword: "โกงวงแชร์"                                  │
│  ├─ keyword: "ท้าวแชร์หนี"                                │
│  └─ keyword: "แชร์ล้ม เล่นไม่จ่าย"                        │
└─────────────────────────────────────────────────────────┘

→ เพิ่มหมวดใหม่ = เพิ่ม config ใน .env + สร้าง parser
→ ทั้ง 2 วิธีเป็น Adapter ของ ScraperPort เดียวกัน
```

### Config-Driven Category (ไม่ hardcode)

```yaml
# categories.yaml (หรือ .env - ตัวอย่าง)
categories:
  loan_fraud:
    name: "โกงเงินกู้"
    parser: "loan"
    groups:
      - "https://fb.com/groups/xxx"
      - "https://fb.com/groups/yyy"
    search_keywords:
      - "โกงเงินกู้"
      - "โดนโกง ค่าดำเนินการ"
      - "แอปเงินกู้ หลอก"
    fraud_keywords:      # ใช้กรองว่าโพสต์นี้เป็นแจ้งโกงจริง
      - "โดนโกง"
      - "หลอก"
      - "ค่าดำเนินการ"

  share_fraud:
    name: "โกงวงแชร์"
    parser: "share"
    groups:
      - "https://fb.com/groups/aaa"
    search_keywords:
      - "โกงวงแชร์"
      - "ท้าวแชร์หนี"
    fraud_keywords:
      - "เล่นไม่จ่าย"
      - "ล้มแชร์"

  # เพิ่มหมวดใหม่ แค่เพิ่ม block นี้ ไม่ต้องแก้ code
  online_scam:
    name: "โกงซื้อขาย"
    parser: "generic"           # ใช้ parser กลางก็ได้ ถ้าไม่มีเฉพาะ
    groups:
      - "https://fb.com/groups/ccc"
    search_keywords:
      - "โอนแล้วไม่ส่งของ"
      - "โดนโกง ซื้อของออนไลน์"
    fraud_keywords:
      - "โกง"
      - "ไม่ส่งของ"
      - "block"
```

---

## Clean Architecture ภาพรวม

```
ทุก Bot + Backend ใช้โครงสร้างเดียวกัน:

┌─────────────────────────────────────────────┐
│  Domain Layer (ชั้นใน - ไม่พึ่ง framework)    │
│  ├─ models/     Entity, Value Objects        │
│  ├─ ports/      Interface ทั้งหมด (ABC)      │
│  └─ services/   Business Logic (interface)   │
├─────────────────────────────────────────────┤
│  Application Layer (Use Cases)               │
│  └─ usecases/   Orchestrate ports + logic    │
├─────────────────────────────────────────────┤
│  Infrastructure Layer (ชั้นนอก - ต่อของจริง)  │
│  ├─ adapters/    Implement ports             │
│  ├─ config/      Settings, .env              │
│  └─ di/          Dependency Injection        │
├─────────────────────────────────────────────┤
│  Interface Layer (Entry Point)               │
│  └─ cli/         Typer CLI commands          │
└─────────────────────────────────────────────┘

กฎ: ชั้นใน ห้ามรู้จักชั้นนอก (Dependency Rule)
    Domain ไม่ import Infrastructure
    Use Case เรียก Port (interface) ไม่เรียก Adapter ตรง
```

---

## System Architecture

```
                    Facebook
         ┌────────────┼────────────┐
         │            │            │
    FB Groups    FB Search    FB Groups
    (เงินกู้)    (เงินกู้)     (แชร์)    ...ไม่จำกัดหมวด
         │            │            │
         ▼            ▼            ▼
┌──────────────────────────────────────────────────┐
│  Bot Collector (Python - Clean Architecture)      │
│                                                   │
│  ScraperPort (interface)                          │
│  ├─ FacebookGroupScraper  (เข้ากลุ่ม → scroll)    │
│  └─ FacebookSearchScraper (พิมพ์ค้นหา → ดึงผล)   │
│                                                   │
│  ParserPort (interface)                           │
│  ├─ LoanParser   (keyword เงินกู้)                │
│  ├─ ShareParser  (keyword แชร์)                   │
│  └─ GenericParser (ใช้ได้ทุกหมวด)                  │
│                                                   │
│  CategoryConfig (จาก .yaml/.env)                  │
│  → แต่ละหมวดกำหนด groups + keywords + parser      │
│  → เพิ่มหมวด = เพิ่ม config                        │
│                                                   │
│  UseCase: CollectFraudUseCase                     │
│  → loop ทุกหมวด → scrape (group + search) →       │
│  → parse → dedup → save → notify                  │
└───────────────────┬──────────────────────────────┘
                    │ POST /api/v1/frauds
                    ▼
┌──────────────────────────────────────────────────┐
│  Go Fiber API (Go - Clean Architecture)           │
│                                                   │
│  ├─ Fraud CRUD (multi-category)                   │
│  ├─ Search API (ค้นหาข้ามหมวด/เฉพาะหมวด)         │
│  ├─ Category Management                           │
│  └─ PostgreSQL + pg_trgm                          │
│                                                   │
│  ◄── Frontend (React) ค้นหา + Admin               │
└───────────────────┬──────────────────────────────┘
                    │ GET /frauds/incomplete
                    ▼
┌──────────────────────────────────────────────────┐
│  Bot Enricher (Python - Clean Architecture)       │
│                                                   │
│  SearchPort (interface)                           │
│  ├─ DuckDuckGoSearch    (ฟรี, เร็ว)              │
│  └─ GoogleChromeSearch  (ฟรี, ช้า)               │
│                                                   │
│  ScraperPort (interface)                          │
│  ├─ PantipScraper                                │
│  └─ ScamSiteScraper                              │
└──────────────────────────────────────────────────┘
```

---

## Part 1: Bot Collector (Python - Clean Architecture)

### Project Structure

```
fraud-collector/
├── domain/
│   ├── models/
│   │   ├── fraud_record.py            # FraudRecord entity
│   │   ├── raw_post.py                # RawPost value object
│   │   ├── category_config.py         # CategoryConfig value object
│   │   └── enums.py                   # RecordStatus
│   └── ports/
│       ├── scraper_port.py            # ScraperPort
│       ├── parser_port.py             # ParserPort
│       ├── storage_port.py            # StoragePort
│       ├── dedup_port.py              # DedupPort
│       ├── notifier_port.py           # NotifierPort
│       └── scheduler_port.py          # SchedulerPort
│
├── application/
│   └── usecases/
│       ├── collect_fraud.py           # CollectFraudUseCase
│       ├── login_browser.py           # LoginBrowserUseCase
│       └── send_pending.py            # SendPendingUseCase
│
├── infrastructure/
│   ├── adapters/
│   │   ├── scrapers/
│   │   │   ├── facebook_group_scraper.py    # เข้ากลุ่ม → scroll → ดึงโพสต์
│   │   │   └── facebook_search_scraper.py   # พิมพ์ค้นหาใน FB → ดึงผลลัพธ์
│   │   ├── parsers/
│   │   │   ├── base_thai_parser.py          # regex กลาง (เบอร์/บัญชี/ชื่อ)
│   │   │   ├── loan_parser.py               # keyword/regex เฉพาะเงินกู้
│   │   │   ├── share_parser.py              # keyword/regex เฉพาะวงแชร์
│   │   │   └── generic_parser.py            # parser กลาง (หมวดที่ไม่มีเฉพาะ)
│   │   ├── storage/
│   │   │   ├── api_storage.py               # POST ไป Go API
│   │   │   └── jsonl_storage.py             # เก็บ JSONL (backup)
│   │   ├── dedup/
│   │   │   ├── api_dedup.py                 # เช็คซ้ำผ่าน API
│   │   │   └── local_dedup.py               # เช็คซ้ำจาก memory/JSONL
│   │   ├── notifiers/
│   │   │   ├── telegram_notifier.py      # Telegram Bot API
│   │   │   └── log_notifier.py
│   │   └── schedulers/
│   │       └── apscheduler_adapter.py
│   ├── browser/
│   │   └── browser_helper.py                # BrowserHelper (DrissionPage)
│   ├── config/
│   │   ├── settings.py                      # Settings (pydantic-settings)
│   │   └── category_loader.py               # โหลด category config จาก yaml/env
│   └── di/
│       └── container.py                     # DI Container
│
├── interface/
│   └── cli/
│       └── commands.py                      # Typer CLI
│
├── categories.yaml                          # Category config file
├── requirements.txt
├── .env
└── README.md
```

### Domain - Category Config (ไม่ hardcode)

```python
# domain/models/category_config.py
class CategoryConfig(BaseModel):
    """
    Config ของแต่ละหมวด - โหลดจาก yaml/env
    เพิ่มหมวดใหม่ = เพิ่ม entry ในไฟล์ config ไม่ต้องแก้ code
    """
    id: str                          # "loan_fraud", "share_fraud"
    name: str                        # "โกงเงินกู้", "โกงวงแชร์"
    parser: str                      # "loan", "share", "generic"

    # วิธีที่ 1: Facebook Groups
    groups: list[str] = []           # FB Group URLs

    # วิธีที่ 2: Facebook Search
    search_keywords: list[str] = []  # คำค้นหาใน FB Search

    # กรองโพสต์
    fraud_keywords: list[str] = []   # keyword ที่บ่งบอกว่าเป็นโพสต์แจ้งโกง

    # ตั้งค่าเฉพาะหมวด
    enabled: bool = True
    scrape_interval_minutes: int = 15
```

### Domain - Ports

```python
# domain/ports/scraper_port.py
class ScraperPort(ABC):
    """
    Port: ดึงโพสต์จาก Facebook
    มี 2 Adapter:
    - FacebookGroupScraper  (เข้ากลุ่ม → scroll)
    - FacebookSearchScraper (ช่องค้นหา → พิมพ์ keyword)
    """

    @abstractmethod
    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        """
        target = group URL (สำหรับ GroupScraper)
        target = search keyword (สำหรับ SearchScraper)
        """
        pass

    @abstractmethod
    def get_type(self) -> str:
        """'group' หรือ 'search'"""
        pass


# domain/ports/parser_port.py
class ParserPort(ABC):
    """
    Port: parse ข้อความ → extract ข้อมูลคนโกง
    แต่ละหมวดมี parser เฉพาะ (keyword ต่างกัน)
    หมวดที่ไม่มีเฉพาะ → ใช้ GenericParser
    """

    @abstractmethod
    def parse(self, raw_text: str) -> FraudRecord:
        pass

    @abstractmethod
    def is_fraud_post(self, raw_text: str, fraud_keywords: list[str]) -> bool:
        """เช็คว่าเป็นโพสต์แจ้งโกง โดยใช้ keywords จาก config"""
        pass


# domain/ports/storage_port.py
class StoragePort(ABC):
    @abstractmethod
    def save(self, record: FraudRecord) -> bool: pass

    @abstractmethod
    def save_batch(self, records: list[FraudRecord]) -> int: pass

    @abstractmethod
    def get_pending(self, limit: int = 100) -> list[FraudRecord]: pass

    @abstractmethod
    def update_status(self, record_id: str, status: str) -> bool: pass


# domain/ports/dedup_port.py
class DedupPort(ABC):
    @abstractmethod
    def is_duplicate(self, record: FraudRecord) -> bool: pass

    @abstractmethod
    def mark_seen(self, record: FraudRecord) -> None: pass


# domain/ports/notifier_port.py
class NotifierPort(ABC):
    @abstractmethod
    def notify(self, message: str, level: str = "info") -> bool: pass

    @abstractmethod
    def notify_new_frauds(self, records: list[FraudRecord]) -> bool: pass


# domain/ports/scheduler_port.py
class SchedulerPort(ABC):
    @abstractmethod
    def schedule(self, func, interval_minutes: int, job_id: str) -> None: pass

    @abstractmethod
    def start(self) -> None: pass

    @abstractmethod
    def stop(self) -> None: pass
```

### Scraper Adapters (2 วิธี)

```python
# infrastructure/adapters/scrapers/facebook_group_scraper.py
class FacebookGroupScraper(ScraperPort):
    """
    วิธีที่ 1: เข้ากลุ่ม Facebook → scroll → ดึงโพสต์

    target = group URL เช่น "https://fb.com/groups/xxx"
    """

    def __init__(self, browser: BrowserHelper):
        self.browser = browser

    def get_type(self) -> str:
        return "group"

    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        max_scrolls = kwargs.get("max_scrolls", 20)
        browser = self.browser.get_browser()
        browser.get(target)
        time.sleep(3)

        posts = []
        seen = set()

        for _ in range(max_scrolls):
            html = browser.html
            soup = BeautifulSoup(html, "lxml")

            for article in soup.find_all('div', attrs={'role': 'article'}):
                text = article.get_text(separator='\n', strip=True)
                text_hash = hash(text[:200])
                if text_hash in seen:
                    continue
                seen.add(text_hash)

                posts.append(RawPost(
                    text=text,
                    post_url=self._extract_permalink(article),
                    source_url=target,
                ))

            browser.scroll.to_bottom()
            time.sleep(random.uniform(2, 5))

        return posts


# infrastructure/adapters/scrapers/facebook_search_scraper.py
class FacebookSearchScraper(ScraperPort):
    """
    วิธีที่ 2: พิมพ์ค้นหาใน Facebook Search → ดึงผลลัพธ์

    target = search keyword เช่น "โกงเงินกู้"

    Flow:
    1. ไป facebook.com/search/posts/?q=xxx
    2. scroll ดึงผลลัพธ์
    3. ดึงข้อความจากแต่ละโพสต์
    """

    def __init__(self, browser: BrowserHelper):
        self.browser = browser

    def get_type(self) -> str:
        return "search"

    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        max_scrolls = kwargs.get("max_scrolls", 10)
        browser = self.browser.get_browser()

        # Facebook search URL
        search_url = f"https://www.facebook.com/search/posts/?q={target}"
        browser.get(search_url)
        time.sleep(3)

        posts = []
        seen = set()

        for _ in range(max_scrolls):
            html = browser.html
            soup = BeautifulSoup(html, "lxml")

            for article in soup.find_all('div', attrs={'role': 'article'}):
                text = article.get_text(separator='\n', strip=True)
                text_hash = hash(text[:200])
                if text_hash in seen:
                    continue
                seen.add(text_hash)

                posts.append(RawPost(
                    text=text,
                    post_url=self._extract_permalink(article),
                    source_url=search_url,
                ))

            browser.scroll.to_bottom()
            time.sleep(random.uniform(3, 7))  # ช้ากว่า group (ระวัง detect)

        return posts
```

### UseCase: CollectFraudUseCase (รองรับ multi-category + 2 วิธี)

```python
# application/usecases/collect_fraud.py
class CollectFraudUseCase:
    """
    Use Case: เก็บข้อมูลคนโกงจาก Facebook

    รับ CategoryConfig → ใช้ทั้ง 2 วิธี (group + search) → parse → dedup → save
    ไม่ผูกกับหมวดใดหมวดหนึ่ง ทำงานได้กับทุกหมวดที่ config กำหนด
    """

    def __init__(
        self,
        group_scraper: ScraperPort,       # FacebookGroupScraper
        search_scraper: ScraperPort,      # FacebookSearchScraper
        parsers: dict[str, ParserPort],   # {"loan": LoanParser, "share": ShareParser, "generic": GenericParser}
        storage: StoragePort,
        dedup: DedupPort,
        notifier: NotifierPort,
    ):
        self.group_scraper = group_scraper
        self.search_scraper = search_scraper
        self.parsers = parsers
        self.storage = storage
        self.dedup = dedup
        self.notifier = notifier

    def execute(self, category: CategoryConfig) -> CollectResult:
        """
        เก็บข้อมูลสำหรับ 1 หมวด (เรียกซ้ำได้ทุกหมวด)

        Flow:
        1. Scrape จาก FB Groups (วิธีที่ 1)
        2. Scrape จาก FB Search (วิธีที่ 2)
        3. รวม raw posts ทั้งหมด
        4. Parse → Filter → Dedup → Save → Notify
        """
        stats = CollectResult(category=category.id)

        # เลือก parser (ถ้าไม่มีเฉพาะ → ใช้ generic)
        parser = self.parsers.get(category.parser, self.parsers["generic"])

        # === วิธีที่ 1: Facebook Groups ===
        raw_posts = []
        for group_url in category.groups:
            posts = self.group_scraper.scrape(group_url)
            raw_posts.extend(posts)
            stats.group_posts += len(posts)

        # === วิธีที่ 2: Facebook Search ===
        for keyword in category.search_keywords:
            posts = self.search_scraper.scrape(keyword)
            raw_posts.extend(posts)
            stats.search_posts += len(posts)

        # === Process ทุก post ===
        new_records = []
        for post in raw_posts:
            # Filter - เป็นโพสต์แจ้งโกงจริงไหม
            if not parser.is_fraud_post(post.text, category.fraud_keywords):
                stats.skipped_not_fraud += 1
                continue

            # Parse
            record = parser.parse(post.text)
            if not record.has_any_data():
                stats.skipped_no_data += 1
                continue

            # Tag category + source
            record.category = category.id
            record.source_url = post.post_url or post.source_url
            record.source_type = "facebook"
            record.raw_text = post.text[:2000]

            # Dedup
            if self.dedup.is_duplicate(record):
                stats.skipped_duplicate += 1
                continue

            # Save
            if self.storage.save(record):
                self.dedup.mark_seen(record)
                new_records.append(record)
                stats.saved += 1

        # Notify
        if new_records:
            self.notifier.notify_new_frauds(new_records)

        return stats


class CollectResult(BaseModel):
    category: str = ""
    group_posts: int = 0        # โพสต์จาก FB Groups
    search_posts: int = 0       # โพสต์จาก FB Search
    skipped_not_fraud: int = 0
    skipped_no_data: int = 0
    skipped_duplicate: int = 0
    saved: int = 0
```

### DI Container

```python
# infrastructure/di/container.py
class Container:
    def __init__(self, settings: Settings, categories: list[CategoryConfig]):
        self.settings = settings
        self.categories = categories

        # Browser (shared ทั้ง 2 scraper)
        self._browser = BrowserHelper(
            headless=settings.browser_headless,
            user_data_dir=settings.browser_user_data_dir,
        )

        # 2 Scraper Adapters
        self._group_scraper = FacebookGroupScraper(self._browser)
        self._search_scraper = FacebookSearchScraper(self._browser)

        # Parsers (register ทั้งหมด)
        self._parsers: dict[str, ParserPort] = {
            "loan": LoanParser(),
            "share": ShareParser(),
            "generic": GenericParser(),
            # เพิ่ม parser ใหม่ที่นี่ (ถ้าหมวดต้องการ parser เฉพาะ)
        }

        # Storage, Dedup, Notifier
        self._storage = self._build_storage()
        self._dedup = self._build_dedup()
        self._notifier = self._build_notifier()
        self._scheduler = APSchedulerAdapter()

    def get_collect_usecase(self) -> CollectFraudUseCase:
        """UseCase เดียว ใช้ได้ทุกหมวด"""
        return CollectFraudUseCase(
            group_scraper=self._group_scraper,
            search_scraper=self._search_scraper,
            parsers=self._parsers,
            storage=self._storage,
            dedup=self._dedup,
            notifier=self._notifier,
        )

    def get_active_categories(self) -> list[CategoryConfig]:
        """หมวดที่ enabled"""
        return [c for c in self.categories if c.enabled]
```

### CLI

```python
# interface/cli/commands.py
app = typer.Typer(name="fraud-collector", add_completion=False)

@app.command()
def scrape(
    category: str = typer.Option("all", "--category", "-c",
        help="หมวด: loan_fraud, share_fraud, all"),
    method: str = typer.Option("all", "--method", "-m",
        help="วิธี: group, search, all"),
    once: bool = typer.Option(False, "--once"),
):
    """Scrape Facebook ตามหมวด"""
    categories_config = load_categories("categories.yaml")
    container = Container(settings, categories_config)
    usecase = container.get_collect_usecase()

    targets = (
        container.get_active_categories()
        if category == "all"
        else [c for c in categories_config if c.id == category]
    )

    def run_once():
        for cat in targets:
            # เลือกวิธี scrape
            if method == "group":
                cat_copy = cat.model_copy()
                cat_copy.search_keywords = []  # ไม่ทำ search
            elif method == "search":
                cat_copy = cat.model_copy()
                cat_copy.groups = []  # ไม่ทำ group
            else:
                cat_copy = cat

            result = usecase.execute(cat_copy)
            console.print(
                f"  [{cat.id}] group={result.group_posts} "
                f"search={result.search_posts} saved={result.saved}"
            )

    if once:
        run_once()
    else:
        scheduler = container.get_scheduler()
        scheduler.schedule(run_once, settings.scrape_interval_minutes, "collect")
        scheduler.start()

@app.command()
def login():
    """เปิด Chrome เพื่อ login Facebook"""

@app.command()
def categories():
    """แสดงหมวดทั้งหมดจาก config"""
    cats = load_categories("categories.yaml")
    for c in cats:
        status = "ON" if c.enabled else "OFF"
        console.print(
            f"  [{status}] {c.id}: {c.name} "
            f"| groups={len(c.groups)} keywords={len(c.search_keywords)}"
        )
```

```bash
# ใช้งาน
python -m app.main login                                   # login FB ครั้งแรก
python -m app.main scrape                                  # ทุกหมวด ทุกวิธี 24/7
python -m app.main scrape --category loan_fraud            # เฉพาะเงินกู้
python -m app.main scrape --method group                   # เฉพาะเข้ากลุ่ม
python -m app.main scrape --method search                  # เฉพาะค้นหา FB
python -m app.main scrape --category share_fraud --once    # แชร์ ครั้งเดียว
python -m app.main categories                              # ดูหมวดทั้งหมด
```

### วิธีเพิ่มหมวดใหม่

```
ตัวอย่าง: เพิ่ม "โกงซื้อขายออนไลน์"

กรณี 1: ใช้ Generic Parser (ง่ายสุด)
──────────────────────────────
แก้ไฟล์เดียว: categories.yaml

  online_scam:
    name: "โกงซื้อขาย"
    parser: "generic"                    # ← ใช้ parser กลาง
    groups:
      - "https://fb.com/groups/ccc"
    search_keywords:
      - "โอนแล้วไม่ส่งของ"
      - "โกงซื้อของออนไลน์"
    fraud_keywords:
      - "โกง"
      - "ไม่ส่งของ"
      - "block"

→ เสร็จ! ไม่ต้องแก้ code เลย


กรณี 2: ต้องการ Parser เฉพาะ (extract ข้อมูลพิเศษ)
──────────────────────────────
1. สร้าง infrastructure/adapters/parsers/online_scam_parser.py
   class OnlineScamParser(ParserPort):
       # extract: สินค้า, tracking no, ร้านค้า, etc.

2. Register ใน container.py:
   self._parsers["online_scam"] = OnlineScamParser()

3. แก้ categories.yaml:
   online_scam:
     parser: "online_scam"     # ← ชี้ไป parser ใหม่

→ เสร็จ! code เก่าไม่กระทบ
```

---

## Part 2: Bot Enricher (Python - Clean Architecture)

### Project Structure

```
fraud-enricher/
├── domain/
│   ├── models/
│   │   ├── enrich_result.py
│   │   └── search_result.py
│   └── ports/
│       ├── search_port.py             # SearchPort: search engine
│       ├── scraper_port.py            # ScraperPort: scrape หน้าเว็บ
│       ├── extractor_port.py          # ExtractorPort: extract จาก HTML
│       ├── storage_port.py            # StoragePort: API client
│       └── query_builder_port.py      # QueryBuilderPort: สร้าง query ตามหมวด
│
├── application/
│   └── usecases/
│       ├── enrich_fraud.py            # EnrichFraudUseCase
│       └── batch_enrich.py            # BatchEnrichUseCase
│
├── infrastructure/
│   ├── adapters/
│   │   ├── search/
│   │   │   ├── duckduckgo_search.py   # ฟรี, เร็ว
│   │   │   └── google_chrome_search.py # ฟรี, ช้า
│   │   ├── scrapers/
│   │   │   ├── pantip_scraper.py
│   │   │   ├── scam_site_scraper.py
│   │   │   └── general_scraper.py
│   │   ├── extractors/
│   │   │   └── thai_extractor.py
│   │   ├── storage/
│   │   │   └── api_storage.py
│   │   └── query_builders/
│   │       ├── loan_query_builder.py
│   │       ├── share_query_builder.py
│   │       └── generic_query_builder.py
│   ├── browser/
│   │   └── browser_helper.py
│   ├── config/
│   │   └── settings.py
│   └── di/
│       └── container.py
│
├── interface/
│   └── cli/
│       └── commands.py
├── requirements.txt
└── .env
```

Enricher ก็รองรับ multi-category เช่นกัน:
- `QueryBuilderPort` สร้าง search query ตามหมวด
- หมวดที่ไม่มี builder เฉพาะ → ใช้ `GenericQueryBuilder`
- เพิ่ม builder ใหม่ = สร้าง 1 ไฟล์ + register ใน container

---

## Part 3: Backend API (Go Fiber)

(โครงสร้างเหมือนเดิม - รองรับ multi-category อยู่แล้ว)

### Key Endpoints

```
GET    /api/v1/categories                        # ดึงหมวดทั้งหมด
POST   /api/v1/frauds                            # เพิ่มรายชื่อ (ส่ง categoryId)
POST   /api/v1/frauds/batch                      # เพิ่มหลายรายการ
GET    /api/v1/frauds/check?phone=xxx            # เช็คซ้ำ
GET    /api/v1/frauds/incomplete                  # ข้อมูลไม่ครบ
PATCH  /api/v1/frauds/:id/enrich                  # อัพเดตจาก enricher
GET    /api/v1/search?q=xxx&category=xxx          # ค้นหา (ทุกหมวด/เฉพาะหมวด)
GET    /api/v1/search/phone?q=xxx                 # ค้นหาเบอร์
GET    /api/v1/search/bank?q=xxx                  # ค้นหาบัญชี
POST   /api/v1/reports                            # รายงาน (เลือกหมวด)
GET    /api/v1/admin/stats                        # สถิติ
POST   /api/v1/admin/categories                   # เพิ่มหมวดใหม่
```

### Database (Key Tables)

```sql
-- หมวดหมู่ (เพิ่มไม่จำกัด)
CREATE TABLE fraud_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ข้อมูลคนโกง (ทุกหมวดอยู่ตารางเดียว filter ด้วย category_id)
CREATE TABLE frauds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) REFERENCES fraud_categories(id),
    fraud_type VARCHAR(50),
    name VARCHAR(255),
    phone VARCHAR(20),
    bank_account VARCHAR(50),
    bank_name VARCHAR(100),
    id_card VARCHAR(13),
    description TEXT,
    amount BIGINT,              -- satang
    extra_data JSONB,           -- ข้อมูลเฉพาะหมวด
    source_url TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    raw_text TEXT,
    report_count INT DEFAULT 1,
    verified BOOLEAN DEFAULT FALSE,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 4: Frontend (React + TypeScript)

```
src/features/
├── search/              # ค้นหา + CategoryFilter
├── fraud-detail/        # รายละเอียด + ExtraDataPanel
├── report/              # ฟอร์มรายงาน (เลือกหมวด)
└── admin/               # Dashboard + สถิติต่อหมวด + CategoryManager
```

Frontend ดึง categories จาก API → แสดงอัตโนมัติ ไม่ต้องแก้ code เมื่อเพิ่มหมวด

---

## Port/Adapter Summary

### Bot Collector

| Port | หน้าที่ | Adapters |
|------|---------|----------|
| `ScraperPort` | ดึงโพสต์จาก FB | `FacebookGroupScraper`, `FacebookSearchScraper` |
| `ParserPort` | parse ข้อความ | `LoanParser`, `ShareParser`, `GenericParser`, ...เพิ่มได้ |
| `StoragePort` | บันทึก | `ApiStorage`, `JsonlStorage` |
| `DedupPort` | เช็คซ้ำ | `ApiDedup`, `LocalDedup` |
| `NotifierPort` | แจ้งเตือน | `LineNotifier`, `LogNotifier` |
| `SchedulerPort` | ตั้งเวลา | `APSchedulerAdapter` |

### Bot Enricher

| Port | หน้าที่ | Adapters |
|------|---------|----------|
| `SearchPort` | search engine | `DuckDuckGoSearch`, `GoogleChromeSearch` |
| `ScraperPort` | scrape เว็บ | `PantipScraper`, `ScamSiteScraper`, `GeneralScraper` |
| `ExtractorPort` | extract จาก HTML | `ThaiExtractor` |
| `StoragePort` | API client | `ApiStorage` |
| `QueryBuilderPort` | สร้าง query | `LoanBuilder`, `ShareBuilder`, `GenericBuilder` |

---

## Phase Plan

### Phase 1: Backend API (Go Fiber)
- fraud_categories + frauds CRUD
- Search API + Category Management
- API Key middleware

### Phase 2: Bot Collector
- Clean Architecture + all ports
- FacebookGroupScraper + FacebookSearchScraper
- LoanParser + GenericParser
- categories.yaml config
- DI Container + CLI + Scheduler

### Phase 3: เพิ่มหมวดวงแชร์
- ShareParser
- เพิ่ม config ใน categories.yaml
- ทดสอบ multi-category

### Phase 4: Frontend
- Search + CategoryFilter + Report + Admin

### Phase 5: Bot Enricher
- Clean Architecture + all ports
- DuckDuckGo + Google Chrome + Pantip + ScamSite
- QueryBuilders per category
