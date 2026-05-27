"""APScheduler Adapter"""
from typing import Callable

from apscheduler.schedulers.blocking import BlockingScheduler

from domain.ports.scheduler_port import SchedulerPort


class APSchedulerAdapter(SchedulerPort):

    def __init__(self):
        self._scheduler = BlockingScheduler()

    def schedule(self, func: Callable, interval_minutes: int, job_id: str) -> None:
        self._scheduler.add_job(
            func,
            'interval',
            minutes=interval_minutes,
            id=job_id,
            max_instances=1,
        )
        print(f"  [Scheduler] Job '{job_id}' scheduled every {interval_minutes} minutes")

    def start(self) -> None:
        print("  [Scheduler] Starting... (Ctrl+C to stop)")
        try:
            self._scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            print("  [Scheduler] Stopped")

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        print("  [Scheduler] Stopped")
