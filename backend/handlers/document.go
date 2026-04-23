package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
)

func CreateDocument(c *gin.Context) {
	var doc models.Document
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	writerID := c.MustGet("writer_id").(string)
	doc.ID = uuid.New().String()
	doc.AuthorID = writerID

	// Sync categories and tags to the new schema
	ensureCategoryExists(doc.Category)
	for _, tag := range strings.Split(doc.Tags, ",") {
		ensureCategoryExists(strings.TrimSpace(tag))
	}

	_, err := database.DB.Exec("INSERT INTO documents (id, title, description, content, author_id, author, category, tags, image, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		doc.ID, doc.Title, doc.Description, doc.Content, doc.AuthorID, doc.Author, doc.Category, doc.Tags, doc.Image, doc.ReadTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create document: " + err.Error()})
		return
	}

	middleware.LogAction(writerID, "CREATE_DOC", "Created document: "+doc.Title)
	c.JSON(http.StatusCreated, doc)
}

func GetDocuments(c *gin.Context) {
	// Get query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "6")
	category := c.Query("category")
	searchQuery := c.Query("q")

	// Parse page and limit
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 6
	}
	if limit > 100 {
		limit = 100 // Max limit to prevent abuse
	}

	offset := (page - 1) * limit

	// Build query
	countQuery := "SELECT COUNT(*) FROM documents WHERE 1=1"
	dataQuery := "SELECT id, title, description, author_id, author, category, tags, image, read_time, created_at, updated_at FROM documents WHERE 1=1"
	args := []interface{}{}

	if category != "" && category != "All" {
		normalizedCategory := strings.ToLower(strings.TrimSpace(category))
		categoryTagPattern := "%," + normalizedCategory + ",%"
		countQuery += " AND (LOWER(category) = ? OR LOWER(',' || REPLACE(IFNULL(tags, ''), ', ', ',') || ',') LIKE ?)"
		dataQuery += " AND (LOWER(category) = ? OR LOWER(',' || REPLACE(IFNULL(tags, ''), ', ', ',') || ',') LIKE ?)"
		args = append(args, normalizedCategory, categoryTagPattern)
	}

	if searchQuery != "" {
		normalizedSearch := strings.ToLower(strings.TrimSpace(searchQuery))
		searchPattern := "%" + normalizedSearch + "%"
		countQuery += " AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(category) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(description) LIKE ?)"
		dataQuery += " AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(category) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(description) LIKE ?)"
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	// Get total count
	var total int
	if err := database.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error (count): " + err.Error()})
		return
	}

	// Get paginated results
	dataQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, limit, offset)

	rows, err := database.DB.Query(dataQuery, queryArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error (query): " + err.Error()})
		return
	}
	defer rows.Close()

	var docs []models.Document
	for rows.Next() {
		var doc models.Document
		if err := rows.Scan(&doc.ID, &doc.Title, &doc.Description, &doc.AuthorID, &doc.Author, &doc.Category, &doc.Tags, &doc.Image, &doc.ReadTime, &doc.CreatedAt, &doc.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error (scan): " + err.Error()})
			return
		}
		docs = append(docs, doc)
	}

	totalPages := (total + limit - 1) / limit // Ceiling division

	c.JSON(http.StatusOK, gin.H{
		"docs":        docs,
		"page":        page,
		"limit":       limit,
		"total":       total,
		"totalPages":  totalPages,
		"hasNextPage": page < totalPages,
	})
}

func UpdateDocument(c *gin.Context) {
	id := c.Param("id")
	var doc models.Document
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	writerID := c.MustGet("writer_id").(string)
	
	// Sync categories and tags
	ensureCategoryExists(doc.Category)
	for _, tag := range strings.Split(doc.Tags, ",") {
		ensureCategoryExists(strings.TrimSpace(tag))
	}

	_, err := database.DB.Exec("UPDATE documents SET title=?, description=?, content=?, author=?, category=?, tags=?, image=?, read_time=?, updated_at=? WHERE id=?",
		doc.Title, doc.Description, doc.Content, doc.Author, doc.Category, doc.Tags, doc.Image, doc.ReadTime, time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update document"})
		return
	}

	middleware.LogAction(writerID, "UPDATE_DOC", "Updated document: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

func DeleteDocument(c *gin.Context) {
	id := c.Param("id")
	writerID := c.MustGet("writer_id").(string)

	_, err := database.DB.Exec("DELETE FROM documents WHERE id=?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete document"})
		return
	}

	middleware.LogAction(writerID, "DELETE_DOC", "Deleted document: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func GetDocument(c *gin.Context) {
	id := c.Param("id")
	var doc models.Document
	err := database.DB.QueryRow("SELECT id, title, description, content, author_id, author, category, tags, image, read_time, created_at, updated_at FROM documents WHERE id = ?", id).
		Scan(&doc.ID, &doc.Title, &doc.Description, &doc.Content, &doc.AuthorID, &doc.Author, &doc.Category, &doc.Tags, &doc.Image, &doc.ReadTime, &doc.CreatedAt, &doc.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, doc)
}

func GetCategories(c *gin.Context) {
	rows, err := database.DB.Query("SELECT name FROM categories ORDER BY name ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	categories := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		categories = append(categories, name)
	}

	c.JSON(http.StatusOK, categories)
}

func ensureCategoryExists(name string) {
	if name == "" {
		return
	}
	var id string
	err := database.DB.QueryRow("SELECT id FROM categories WHERE name = ?", name).Scan(&id)
	if err == sql.ErrNoRows {
		newID := uuid.New().String()
		_, _ = database.DB.Exec("INSERT INTO categories (id, name) VALUES (?, ?)", newID, name)
	}
}
