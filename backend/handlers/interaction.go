package handlers

import (
	"database/sql"
	"net/http"
	"strings"

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
	inter.CommenterName = strings.TrimSpace(inter.CommenterName)
	if inter.CommenterName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "commenter name is required"})
		return
	}
	if inter.Type == "suggestion" {
		inter.IsApproved = false
	}

	_, err = database.DB.Exec(`
		INSERT INTO interactions (id, doc_id, commenter_name, stars, comment, type, is_approved, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, inter.ID, inter.DocID, inter.CommenterName, inter.Stars, inter.Comment, inter.Type, inter.IsApproved, inter.IPAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Submitted successfully"})
}

func ApproveComment(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.CurrentUserID(c)

	var docOwnerID string
	err := database.DB.QueryRow(`
		SELECT d.author_id
		FROM interactions i
		INNER JOIN documents d ON d.id = i.doc_id
		WHERE i.id = $1 AND i.type = 'comment'
	`, id).Scan(&docOwnerID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load comment"})
		return
	}

	if docOwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the content owner can approve comments"})
		return
	}

	_, err = database.DB.Exec("UPDATE interactions SET is_approved = TRUE WHERE id = $1 AND type = 'comment'", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve"})
		return
	}

	middleware.LogAction(userID, "APPROVE_COMMENT", "Approved comment: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Approved"})
}

func GetOwnedInteractions(c *gin.Context) {
	docID := c.Param("id")
	userID := middleware.CurrentUserID(c)

	var ownerID string
	err := database.DB.QueryRow("SELECT author_id FROM documents WHERE id = $1", docID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load document"})
		return
	}

	if ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the content owner can view feedback"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT id, doc_id, commenter_name, stars, comment, type, is_approved, created_at
		FROM interactions
		WHERE doc_id = $1
		ORDER BY created_at DESC
	`, docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load feedback"})
		return
	}
	defer rows.Close()

	feedback := []gin.H{}
	for rows.Next() {
		var item models.Interaction
		if err := rows.Scan(&item.ID, &item.DocID, &item.CommenterName, &item.Stars, &item.Comment, &item.Type, &item.IsApproved, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan feedback"})
			return
		}

		feedback = append(feedback, gin.H{
			"id":             item.ID,
			"doc_id":         item.DocID,
			"commenter_name": item.CommenterName,
			"stars":          item.Stars,
			"comment":        item.Comment,
			"type":           item.Type,
			"is_approved":    item.IsApproved,
			"created_at":     item.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, feedback)
}

func GetPublicComments(c *gin.Context) {
	docID := c.Param("id")
	rows, err := database.DB.Query(`
		SELECT i.commenter_name, i.stars, i.comment, i.created_at
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
		var commenterName string
		var stars int
		var comment string
		var createdAt string
		rows.Scan(&commenterName, &stars, &comment, &createdAt)
		comments = append(comments, gin.H{"commenter_name": commenterName, "stars": stars, "comment": comment, "created_at": createdAt})
	}

	c.JSON(http.StatusOK, comments)
}
