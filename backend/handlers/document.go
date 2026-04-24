package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
)

type documentPayload struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Content     string          `json:"content"`
	ContentJSON json.RawMessage `json:"content_json"`
	Category    string          `json:"category"`
	Tags        string          `json:"tags"`
	Image       string          `json:"image"`
	ReadTime    string          `json:"readTime"`
	Status      string          `json:"status"`
}

func CreateDocument(c *gin.Context) {
	var payload documentPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(payload.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	contentJSON, legacyContent, err := normalizeContent(payload.ContentJSON, payload.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category, err := resolveCategorySelection(payload.Category)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "selected category does not exist"})
		return
	}

	status, err := normalizeStatus(payload.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	currentUser, err := getCurrentUser(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve current user"})
		return
	}

	doc := models.Document{
		ID:          uuid.New().String(),
		Title:       strings.TrimSpace(payload.Title),
		Description: strings.TrimSpace(payload.Description),
		Content:     legacyContent,
		ContentJSON: contentJSON,
		AuthorID:    currentUser.ID,
		Author:      currentUser.Username,
		Tags:        normalizeCSV(payload.Tags),
		Category:    category,
		Image:       strings.TrimSpace(payload.Image),
		ReadTime:    strings.TrimSpace(payload.ReadTime),
		Status:      status,
	}

	_, err = database.DB.Exec(`
		INSERT INTO documents (
			id, title, description, author_id, author_name, category, tags, content_json, status, image, read_time
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
	`,
		doc.ID, doc.Title, doc.Description, doc.AuthorID, doc.Author, doc.Category, doc.Tags, string(doc.ContentJSON), doc.Status, doc.Image, doc.ReadTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create document: " + err.Error()})
		return
	}

	middleware.LogAction(currentUser.ID, "CREATE_DOC", "Created document: "+doc.Title)
	c.JSON(http.StatusCreated, doc)
}

func GetDocuments(c *gin.Context) {
	docs, total, totalPages, page, limit, err := queryDocuments(documentQueryOptions{
		Category:      c.Query("category"),
		SearchQuery:   c.Query("q"),
		Status:        "PUBLISHED",
		Page:          c.DefaultQuery("page", "1"),
		Limit:         c.DefaultQuery("limit", "6"),
		IncludeBlocks: false,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"docs":        docs,
		"page":        page,
		"limit":       limit,
		"total":       total,
		"totalPages":  totalPages,
		"hasNextPage": page < totalPages,
	})
}

func GetManagedDocuments(c *gin.Context) {
	options := documentQueryOptions{
		Category:      c.Query("category"),
		SearchQuery:   c.Query("q"),
		Status:        c.Query("status"),
		Page:          c.DefaultQuery("page", "1"),
		Limit:         c.DefaultQuery("limit", "20"),
		IncludeBlocks: false,
	}

	if middleware.CurrentUserRole(c) != "ADMIN" || c.Query("scope") != "all" {
		options.AuthorID = middleware.CurrentUserID(c)
	}

	docs, total, totalPages, page, limit, err := queryDocuments(options)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
	var payload documentPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := fetchDocumentByID(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load document"})
		return
	}

	if err := enforceDocumentAccess(c, existing.AuthorID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(payload.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	contentJSON, legacyContent, err := normalizeContent(payload.ContentJSON, payload.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	statusInput := payload.Status
	if strings.TrimSpace(statusInput) == "" {
		statusInput = existing.Status
	}

	status, err := normalizeStatus(statusInput)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category, err := resolveCategorySelection(payload.Category)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "selected category does not exist"})
		return
	}

	if _, err := database.DB.Exec(`
		UPDATE documents
		SET title = $1,
			description = $2,
			category = $3,
			tags = $4,
			content_json = $5::jsonb,
			status = $6,
			image = $7,
			read_time = $8,
			updated_at = $9
		WHERE id = $10
	`,
		strings.TrimSpace(payload.Title),
		strings.TrimSpace(payload.Description),
		category,
		normalizeCSV(payload.Tags),
		string(contentJSON),
		status,
		strings.TrimSpace(payload.Image),
		strings.TrimSpace(payload.ReadTime),
		time.Now(),
		id,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update document"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "UPDATE_DOC", "Updated document: "+id)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Updated successfully",
		"content":      legacyContent,
		"content_json": json.RawMessage(contentJSON),
		"status":       status,
	})
}

func DeleteDocument(c *gin.Context) {
	id := c.Param("id")
	existing, err := fetchDocumentByID(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load document"})
		return
	}

	if err := enforceDocumentAccess(c, existing.AuthorID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if _, err := database.DB.Exec("DELETE FROM documents WHERE id = $1", id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete document"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "DELETE_DOC", "Deleted document: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func GetDocument(c *gin.Context) {
	id := c.Param("id")
	doc, err := fetchDocumentByID(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	if doc.Status != "PUBLISHED" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	doc.Status = ""
	doc.AuthorID = ""
	c.JSON(http.StatusOK, doc)
}

func GetManagedDocument(c *gin.Context) {
	id := c.Param("id")
	doc, err := fetchDocumentByID(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	if err := enforceDocumentAccess(c, doc.AuthorID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, doc)
}

func GetCategories(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT category
		FROM documents
		WHERE status = 'PUBLISHED'
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	categorySet := map[string]struct{}{}
	for rows.Next() {
		var category sql.NullString
		if err := rows.Scan(&category); err != nil {
			continue
		}

		if category.Valid && strings.TrimSpace(category.String) != "" {
			categorySet[strings.TrimSpace(category.String)] = struct{}{}
		}
	}

	categories := make([]string, 0, len(categorySet))
	for name := range categorySet {
		categories = append(categories, name)
	}
	c.JSON(http.StatusOK, categories)
}

type documentQueryOptions struct {
	AuthorID      string
	Category      string
	SearchQuery   string
	Status        string
	Page          string
	Limit         string
	IncludeBlocks bool
}

func queryDocuments(options documentQueryOptions) ([]models.Document, int, int, int, int, error) {
	page, limit := parsePagination(options.Page, options.Limit, 6)
	offset := (page - 1) * limit

	countQuery := "SELECT COUNT(*) FROM documents WHERE 1=1"
	dataQuery := `
		SELECT documents.id, documents.title, documents.description, documents.author_id, documents.author_name, COALESCE(avatar_library.path, '') AS author_avatar, documents.category, documents.tags, documents.content_json, documents.status, documents.image, documents.read_time, documents.created_at, documents.updated_at
		FROM documents
		LEFT JOIN users ON documents.author_id = users.id
		LEFT JOIN avatar_library ON users.selected_avatar_id = avatar_library.id
		WHERE 1=1
	`
	args := []interface{}{}
	index := 1

	addFilter := func(condition string, values ...interface{}) {
		countQuery += " AND " + condition
		dataQuery += " AND " + condition
		args = append(args, values...)
		index += len(values)
	}

	if options.AuthorID != "" {
		addFilter(fmt.Sprintf("author_id = $%d", index), options.AuthorID)
	}

	if strings.TrimSpace(options.Status) != "" {
		addFilter(fmt.Sprintf("status = $%d", index), strings.TrimSpace(options.Status))
	}

	if category := strings.TrimSpace(options.Category); category != "" && category != "All" {
		normalized := strings.ToLower(category)
		pattern := "%," + normalized + ",%"
		addFilter(
			fmt.Sprintf("(LOWER(category) = $%d OR LOWER(',' || REPLACE(COALESCE(tags, ''), ', ', ',') || ',') LIKE $%d)", index, index+1),
			normalized, pattern,
		)
	}

	if search := strings.TrimSpace(options.SearchQuery); search != "" {
		pattern := "%" + strings.ToLower(search) + "%"
		addFilter(
			fmt.Sprintf(`(
				LOWER(title) LIKE $%d OR
				LOWER(author_name) LIKE $%d OR
				LOWER(category) LIKE $%d OR
				LOWER(tags) LIKE $%d OR
				LOWER(description) LIKE $%d
			)`, index, index+1, index+2, index+3, index+4),
			pattern, pattern, pattern, pattern, pattern,
		)
	}

	var total int
	if err := database.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, 0, page, limit, fmt.Errorf("database error (count): %w", err)
	}

	dataQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", index, index+1)
	queryArgs := append(args, limit, offset)

	rows, err := database.DB.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, 0, 0, page, limit, fmt.Errorf("database error (query): %w", err)
	}
	defer rows.Close()

	docs := []models.Document{}
	for rows.Next() {
		doc, err := scanDocument(rows)
		if err != nil {
			return nil, 0, 0, page, limit, fmt.Errorf("database error (scan): %w", err)
		}

		if !options.IncludeBlocks {
			doc.ContentJSON = nil
		}

		docs = append(docs, doc)
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}

	return docs, total, totalPages, page, limit, nil
}

func fetchDocumentByID(id string) (models.Document, error) {
	row := database.DB.QueryRow(`
		SELECT documents.id, documents.title, documents.description, documents.author_id, documents.author_name, COALESCE(avatar_library.path, '') AS author_avatar, documents.category, documents.tags, documents.content_json, documents.status, documents.image, documents.read_time, documents.created_at, documents.updated_at
		FROM documents
		LEFT JOIN users ON documents.author_id = users.id
		LEFT JOIN avatar_library ON users.selected_avatar_id = avatar_library.id
		WHERE documents.id = $1
	`, id)

	return scanDocument(row)
}

type documentScanner interface {
	Scan(dest ...interface{}) error
}

func scanDocument(scanner documentScanner) (models.Document, error) {
	var doc models.Document
	err := scanner.Scan(
		&doc.ID,
		&doc.Title,
		&doc.Description,
		&doc.AuthorID,
		&doc.Author,
		&doc.AuthorAvatar,
		&doc.Category,
		&doc.Tags,
		&doc.ContentJSON,
		&doc.Status,
		&doc.Image,
		&doc.ReadTime,
		&doc.CreatedAt,
		&doc.UpdatedAt,
	)
	if err != nil {
		return doc, err
	}

	doc.Content = deriveLegacyContent(doc.ContentJSON)
	return doc, nil
}

func normalizeContent(contentJSON json.RawMessage, legacyContent string) (json.RawMessage, string, error) {
	if len(strings.TrimSpace(string(contentJSON))) == 0 {
		contentJSON = buildTextBlockJSON(strings.TrimSpace(legacyContent))
	}

	if err := validateContentBlocks(contentJSON); err != nil {
		return nil, "", err
	}

	return contentJSON, deriveLegacyContent(contentJSON), nil
}

func buildTextBlockJSON(content string) json.RawMessage {
	blocks := []map[string]any{}
	if content != "" {
		blocks = append(blocks, map[string]any{
			"type":     "text",
			"markdown": content,
		})
	}

	raw, _ := json.Marshal(blocks)
	return raw
}

func validateContentBlocks(raw json.RawMessage) error {
	var blocks []map[string]any
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return fmt.Errorf("content_json must be a valid JSON array")
	}

	for _, block := range blocks {
		blockType, _ := block["type"].(string)
		switch blockType {
		case "text":
			if markdown, ok := block["markdown"].(string); !ok || strings.TrimSpace(markdown) == "" {
				return fmt.Errorf("text blocks require non-empty markdown")
			}
		case "image_row":
			layout, _ := block["layout"].(string)
			if layout != "single" && layout != "double" {
				return fmt.Errorf("image_row blocks require layout single or double")
			}

			images, ok := block["images"].([]interface{})
			if !ok {
				return fmt.Errorf("image_row blocks require an images array")
			}
			expected := 1
			if layout == "double" {
				expected = 2
			}
			if len(images) != expected {
				return fmt.Errorf("image_row block layout %s requires %d image entries", layout, expected)
			}

			for _, image := range images {
				imageMap, ok := image.(map[string]interface{})
				if !ok {
					return fmt.Errorf("image_row images must be objects")
				}
				url, _ := imageMap["url"].(string)
				if strings.TrimSpace(url) == "" {
					return fmt.Errorf("image_row images require a url")
				}
			}
		default:
			return fmt.Errorf("unsupported block type: %s", blockType)
		}
	}

	return nil
}

func deriveLegacyContent(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var blocks []map[string]any
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return ""
	}

	parts := []string{}
	for _, block := range blocks {
		if block["type"] == "text" {
			if markdown, ok := block["markdown"].(string); ok && strings.TrimSpace(markdown) != "" {
				parts = append(parts, markdown)
			}
		}
	}

	return strings.Join(parts, "\n\n")
}

func normalizeStatus(status string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(status))
	if normalized == "" {
		return "DRAFT", nil
	}
	if normalized != "DRAFT" && normalized != "PUBLISHED" {
		return "", fmt.Errorf("status must be DRAFT or PUBLISHED")
	}
	return normalized, nil
}

func normalizeCSV(value string) string {
	parts := strings.Split(value, ",")
	normalized := []string{}
	seen := map[string]struct{}{}
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		lowered := strings.ToLower(trimmed)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[lowered]; exists {
			continue
		}
		seen[lowered] = struct{}{}
		normalized = append(normalized, trimmed)
	}

	return strings.Join(normalized, ", ")
}

func parsePagination(pageStr, limitStr string, defaultLimit int) (int, int) {
	page := 1
	limit := defaultLimit
	if _, err := fmt.Sscanf(pageStr, "%d", &page); err != nil || page < 1 {
		page = 1
	}
	if _, err := fmt.Sscanf(limitStr, "%d", &limit); err != nil || limit < 1 {
		limit = defaultLimit
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}

func getCurrentUser(c *gin.Context) (models.User, error) {
	var user models.User
	err := database.DB.QueryRow(`
		SELECT id, username, email, password_hash, role, selected_avatar_id, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
	`, middleware.CurrentUserID(c)).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.SelectedAvatarID,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	return user, err
}

func enforceDocumentAccess(c *gin.Context, authorID string) error {
	if middleware.CurrentUserRole(c) == "ADMIN" {
		return nil
	}
	if middleware.CurrentUserID(c) != authorID {
		return fmt.Errorf("you can only manage your own documentation")
	}
	return nil
}
