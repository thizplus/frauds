"""Face Store Port — store + search interface"""
from abc import ABC, abstractmethod
from domain.models.face_models import FaceEmbedding, SearchMatch


class FaceStorePort(ABC):

    @abstractmethod
    def store(self, face: FaceEmbedding) -> str:
        """Store embedding → return face_id"""
        pass

    @abstractmethod
    def search(self, embedding: list[float], top_k: int = 5, threshold: float = 0.65) -> list[SearchMatch]:
        """Search similar faces → return matches sorted by similarity DESC"""
        pass

    @abstractmethod
    def delete_by_source(self, source_type: str, source_id: str) -> int:
        """Delete embeddings by source → return count deleted"""
        pass

    @abstractmethod
    def count(self) -> int:
        """Count total embeddings"""
        pass
