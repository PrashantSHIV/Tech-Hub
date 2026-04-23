package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
)

func CreateInteraction(c *gin.Context) {
	var inter models.Interaction
	if err := c.ShouldBindJSON(&inter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var status string
	err := database.DB.QueryRow("SELECT status FROM documents WHERE id = $1", inter.DocID).Scan(&status)
	if err == sql.ErrNoRows || status != "PUBLISHED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Document is not publicly available"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate document"})
		return
	}

	inter.ID = uuid.New().String()
	inter.IPAddress = c.ClientIP()
	if inter.Type == "suggestion" {
		inter.IsApproved = false
	}

	_, err = database.DB.Exec(`
		INSERT INTO interactions (id, doc_id, stars, comment, type, is_approved, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, inter.ID, inter.DocID, inter.Stars, inter.Comment, inter.Type, inter.IsApproved, inter.IPAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Submitted successfully"})
}

func ApproveComment(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.CurrentUserID(c)

	_, err := database.DB.Exec("UPDATE interactions SET is_approved = TRUE WHERE id = $1 AND type = 'comment'", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve"})
		return
	}

	middleware.LogAction(userID, "APPROVE_COMMENT", "Approved comment: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Approved"})
}

func GetPublicComments(c *gin.Context) {
	docID := c.Param("id")
	rows, err := database.DB.Query(`
		SELECT i.stars, i.comment, i.created_at
		FROM interactions i
		INNER JOIN documents d ON d.id = i.doc_id
		WHERE i.doc_id = $1 AND i.is_approved = TRUE AND i.type = 'comment' AND d.status = 'PUBLISHED'
		ORDER BY i.created_at DESC
	`, docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var comments []gin.H
	for rows.Next() {
		var stars int
		var comment string
		var createdAt string
		rows.Scan(&stars, &comment, &createdAt)
		comments = append(comments, gin.H{"stars": stars, "comment": comment, "created_at": createdAt})
	}

	c.JSON(http.StatusOK, comments)
}
