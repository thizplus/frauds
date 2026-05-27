from abc import ABC, abstractmethod

from domain.models.raw_post import RawPost


class ScraperPort(ABC):
    """Port: ดึงโพสต์จากแหล่งต่างๆ (FB Group / FB Search)"""

    @abstractmethod
    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        """
        target = group URL (GroupScraper) หรือ keyword (SearchScraper)
        """
        pass

    @abstractmethod
    def get_type(self) -> str:
        """'group' หรือ 'search'"""
        pass
