package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
)

type categoryPayload struct {
	Name string `json:"name" binding:"required"`
}

func ListManagedCategories(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT
			categories.id,
			categories.name,
			categories.created_by,
			users.username,
			categories.created_at,
			categories.updated_at,
			COUNT(documents.id) AS doc_count
		FROM categories
		JOIN users ON categories.created_by = users.id
		LEFT JOIN documents ON documents.category = categories.name
		GROUP BY categories.id, categories.name, categories.created_by, users.username, categories.created_at, categories.updated_at
		ORDER BY LOWER(categories.name) ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list categories"})
		return
	}
	defer rows.Close()

	currentUserID := middleware.CurrentUserID(c)
	currentRole := middleware.CurrentUserRole(c)

	categories := []models.Category{}
	for rows.Next() {
		var category models.Category
		if err := rows.Scan(
			&category.ID,
			&category.Name,
			&category.CreatedBy,
			&category.CreatedByName,
			&category.CreatedAt,
			&category.UpdatedAt,
			&category.DocCount,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan categories"})
			return
		}
		category.CanManage = canManageCategory(currentRole, currentUserID, category.CreatedBy)
		categories = append(categories, category)
	}

	c.JSON(http.StatusOK, categories)
}

func CreateCategory(c *gin.Context) {
	var input categoryPayload
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := normalizeCategoryName(input.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category name is required"})
		return
	}

	categoryID := uuid.New().String()
	_, err := database.DB.Exec(`
		INSERT INTO categories (id, name, created_by)
		VALUES ($1, $2, $3)
	`, categoryID, name, middleware.CurrentUserID(c))
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "category already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "CREATE_CATEGORY", "Created category: "+name)
	c.JSON(http.StatusCreated, gin.H{"id": categoryID, "message": "Category created successfully"})
}

func UpdateCategory(c *gin.Context) {
	var input categoryPayload
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category, err := fetchCategoryByID(c.Param("id"))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load category"})
		return
	}

	if !canManageCategory(middleware.CurrentUserRole(c), middleware.CurrentUserID(c), category.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only manage your own categories"})
		return
	}

	name := normalizeCategoryName(input.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category name is required"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start category update"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		UPDATE categories
		SET name = $1, updated_at = NOW()
		WHERE id = $2
	`, name, category.ID); err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "category already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	if _, err := tx.Exec(`
		UPDATE documents
		SET category = $1, updated_at = NOW()
		WHERE category = $2
	`, name, category.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync linked documents"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize category update"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "UPDATE_CATEGORY", "Updated category: "+category.Name+" -> "+name)
	c.JSON(http.StatusOK, gin.H{"message": "Category updated successfully"})
}

func DeleteCategory(c *gin.Context) {
	category, err := fetchCategoryByID(c.Param("id"))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load category"})
		return
	}

	if !canManageCategory(middleware.CurrentUserRole(c), middleware.CurrentUserID(c), category.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only manage your own categories"})
		return
	}

	var docCount int
	if err := database.DB.QueryRow(`
		SELECT COUNT(*)
		FROM documents
		WHERE category = $1
	`, category.Name).Scan(&docCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to inspect linked documents"})
		return
	}

	if docCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "category cannot be deleted while linked documents exist"})
		return
	}

	if _, err := database.DB.Exec(`DELETE FROM categories WHERE id = $1`, category.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "DELETE_CATEGORY", "Deleted category: "+category.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted successfully"})
}

func resolveCategorySelection(name string) (string, error) {
	normalized := normalizeCategoryName(name)
	if normalized == "" {
		return "", nil
	}

	var resolved string
	err := database.DB.QueryRow(`
		SELECT name
		FROM categories
		WHERE LOWER(name) = LOWER($1)
		LIMIT 1
	`, normalized).Scan(&resolved)
	if err != nil {
		return "", err
	}
	return resolved, nil
}

func normalizeCategoryName(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func canManageCategory(currentRole, currentUserID, createdBy string) bool {
	return currentRole == "ADMIN" || currentUserID == createdBy
}

func fetchCategoryByID(id string) (*models.Category, error) {
	var category models.Category
	err := database.DB.QueryRow(`
		SELECT categories.id, categories.name, categories.created_by, users.username, categories.created_at, categories.updated_at
		FROM categories
		JOIN users ON categories.created_by = users.id
		WHERE categories.id = $1
	`, id).Scan(
		&category.ID,
		&category.Name,
		&category.CreatedBy,
		&category.CreatedByName,
		&category.CreatedAt,
		&category.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &category, nil
}
