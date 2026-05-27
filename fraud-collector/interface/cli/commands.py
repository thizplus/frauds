"""CLI Entry Point - Typer commands"""
import sys
from pathlib import Path

# เพิ่ม project root เข้า path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import typer
from rich.console import Console
from rich.table import Table

from infrastructure.config.settings import Settings
from infrastructure.config.category_loader import load_categories
from infrastructure.di.container import Container

app = typer.Typer(name="fraud-collector", add_completion=False)
console = Console()


@app.command()
def scrape(
    category: str = typer.Option("all", "--category", "-c",
        help="หมวด: loan_fraud, share_fraud, all"),
    method: str = typer.Option("all", "--method", "-m",
        help="วิธี: group, search, all"),
    once: bool = typer.Option(False, "--once",
        help="Scrape ครั้งเดียวแล้วหยุด"),
    instance: int = typer.Option(0, "--instance", "-i",
        help="Browser instance ID"),
):
    """Scrape Facebook ตามหมวด"""
    settings = Settings()
    categories_config = load_categories()
    container = Container(settings, categories_config)

    targets = (
        container.get_active_categories()
        if category == "all"
        else [c for c in categories_config if c.id == category]
    )

    if not targets:
        console.print(f"[red]ไม่พบหมวด '{category}'[/red]")
        raise typer.Exit(1)

    usecase = container.get_collect_usecase()

    def run_once():
        console.print(f"\n[bold blue]--- Scrape Round ---[/bold blue]")
        for cat in targets:
            console.print(f"\n[cyan][{cat.id}] {cat.name}[/cyan]")
            console.print(f"  groups={len(cat.groups)} keywords={len(cat.search_keywords)}")

            result = usecase.execute(cat, method=method, wait_antibot=once)

            console.print(
                f"  [green]group_posts={result.group_posts} "
                f"search_posts={result.search_posts} "
                f"saved={result.saved} "
                f"dup={result.skipped_duplicate}[/green]"
            )

    try:
        if once:
            run_once()
        else:
            # รอบแรกทำเลย
            run_once()
            # ตั้ง scheduler
            scheduler = container.get_scheduler()
            scheduler.schedule(
                run_once,
                settings.scrape_interval_minutes,
                "collect",
            )
            console.print(
                f"\n[bold]Scheduler started - ทุก {settings.scrape_interval_minutes} นาที[/bold]"
            )
            scheduler.start()  # block forever
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping...[/yellow]")
    finally:
        container.close()


@app.command()
def login(
    instance: int = typer.Option(0, "--instance", "-i",
        help="Browser instance ID"),
):
    """เปิด Chrome เพื่อ login Facebook (ครั้งแรก)"""
    settings = Settings()
    categories_config = load_categories()
    container = Container(settings, categories_config)

    try:
        usecase = container.get_login_usecase()
        usecase.execute()
    finally:
        container.close()


@app.command(name="collect-raw")
def collect_raw(
    category: str = typer.Option("loan_fraud", "--category", "-c"),
):
    """เก็บ raw data ลง disk (RAW FIRST, PARSE LATER)"""
    from application.usecases.collect_raw import CollectRawUseCase

    settings = Settings()
    categories_config = load_categories()
    container = Container(settings, categories_config)

    targets = [c for c in categories_config if c.id == category]
    if not targets:
        console.print(f"[red]ไม่พบหมวด '{category}'[/red]")
        raise typer.Exit(1)

    cat = targets[0]
    console.print(f"\n[cyan][{cat.id}] {cat.name}[/cyan]")

    usecase = CollectRawUseCase(
        group_scraper=container._group_scraper,
        ocr=container._ocr,
        raw_dir="raw",
    )

    try:
        result = usecase.execute(cat, wait_antibot=True)
        console.print(f"\n[green]Done! posts={result.saved_posts} imgs={result.images_downloaded} ocr={result.ocr_success}[/green]")
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped[/yellow]")
    finally:
        container.close()


@app.command(name="categories")
def list_categories():
    """แสดงหมวดทั้งหมดจาก categories.yaml"""
    cats = load_categories()

    if not cats:
        console.print("[yellow]ไม่พบ categories.yaml[/yellow]")
        return

    table = Table(title="Categories")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="white")
    table.add_column("Parser", style="magenta")
    table.add_column("Groups", style="green")
    table.add_column("Keywords", style="blue")
    table.add_column("Enabled", style="yellow")

    for c in cats:
        table.add_row(
            c.id,
            c.name,
            c.parser,
            str(len(c.groups)),
            str(len(c.search_keywords)),
            "ON" if c.enabled else "OFF",
        )

    console.print(table)


if __name__ == "__main__":
    app()
