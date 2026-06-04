package mappers

import (
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

func ArticleToResponse(a *models.Article) *dto.ArticleResponse {
	if a == nil {
		return nil
	}

	resp := &dto.ArticleResponse{
		ID:         a.ID.String(),
		Title:      a.Title,
		Slug:       a.Slug,
		Excerpt:    a.Excerpt,
		CoverImage: a.CoverImage,
		Status:     string(a.Status),
		Tags:       []string(a.Tags),
		ViewCount:  a.ViewCount,
		IsFeatured: a.IsFeatured,
		CreatedAt:  a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  a.UpdatedAt.Format(time.RFC3339),
	}

	if resp.Tags == nil {
		resp.Tags = []string{}
	}

	if a.CategoryID != nil {
		resp.CategoryID = a.CategoryID.String()
	}
	if a.Category != nil {
		resp.CategoryName = a.Category.Name
	}
	resp.AuthorName = a.Author.Name
	if a.PublishedAt != nil {
		resp.PublishedAt = a.PublishedAt.Format(time.RFC3339)
	}

	return resp
}

func ArticleToDetailResponse(a *models.Article) *dto.ArticleDetailResponse {
	if a == nil {
		return nil
	}

	base := ArticleToResponse(a)
	return &dto.ArticleDetailResponse{
		ArticleResponse: *base,
		Content:         a.Content,
		MetaTitle:       a.MetaTitle,
		MetaDescription: a.MetaDescription,
	}
}

func ArticlesToResponses(articles []models.Article) []dto.ArticleResponse {
	responses := make([]dto.ArticleResponse, 0, len(articles))
	for i := range articles {
		resp := ArticleToResponse(&articles[i])
		if resp != nil {
			responses = append(responses, *resp)
		}
	}
	return responses
}

func ArticleToSitemapItem(a *models.Article) dto.ArticleSitemapItem {
	return dto.ArticleSitemapItem{
		Slug:      a.Slug,
		UpdatedAt: a.UpdatedAt.Format(time.RFC3339),
	}
}

func ArticleCategoryToResponse(cat *models.ArticleCategory, count int64) *dto.ArticleCategoryResponse {
	if cat == nil {
		return nil
	}
	return &dto.ArticleCategoryResponse{
		ID:           cat.ID.String(),
		Name:         cat.Name,
		Slug:         cat.Slug,
		Description:  cat.Description,
		SortOrder:    cat.SortOrder,
		ArticleCount: count,
	}
}

func ArticleCategoriesToResponses(cats []models.ArticleCategory, counts map[string]int64) []dto.ArticleCategoryResponse {
	responses := make([]dto.ArticleCategoryResponse, 0, len(cats))
	for i := range cats {
		count := counts[cats[i].ID.String()]
		resp := ArticleCategoryToResponse(&cats[i], count)
		if resp != nil {
			responses = append(responses, *resp)
		}
	}
	return responses
}
