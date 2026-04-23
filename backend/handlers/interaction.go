package handlers

import (
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

	inter.ID = uuid.New().String()
	inter.IPAddress = c.ClientIP()
	
	// Default: suggestions are never approved for public, 
	// comments need approval.
	if inter.Type == "suggestion" {
		inter.IsApproved = false
	}

	_, err := database.DB.Exec("INSERT INTO interactions (id, doc_id, stars, comment, type, is_approved, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
		inter.ID, inter.DocID, inter.Stars, inter.Comment, inter.Type, inter.IsApproved, inter.IPAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Submitted successfully"})
}

func ApproveComment(c *gin.Context) {
	id := c.Param("id")
	writerID := c.MustGet("writer_id").(string)

	_, err := database.DB.Exec("UPDATE interactions SET is_approved=TRUE WHERE id=? AND type='comment'", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve"})
		return
	}

	middleware.LogAction(writerID, "APPROVE_COMMENT", "Approved comment: "+id)
	c.JSON(http.StatusOK, gin.H{"message": "Approved"})
}

func GetPublicComments(c *gin.Context) {
	docID := c.Param("doc_id")
	rows, err := database.DB.Query("SELECT stars, comment, created_at FROM interactions WHERE doc_id=? AND is_approved=TRUE AND type='comment' ORDER BY created_at DESC", docID)
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
