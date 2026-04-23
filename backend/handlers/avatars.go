package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
)

func ListAvatars(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, path, name, uploaded_by, created_at
		FROM avatar_library
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list avatars"})
		return
	}
	defer rows.Close()

	avatars := []models.AvatarLibrary{}
	for rows.Next() {
		var avatar models.AvatarLibrary
		if err := rows.Scan(&avatar.ID, &avatar.Path, &avatar.Name, &avatar.UploadedBy, &avatar.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan avatars"})
			return
		}
		avatars = append(avatars, avatar)
	}

	c.JSON(http.StatusOK, avatars)
}

func UploadAvatar(c *gin.Context) {
	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar file is required"})
		return
	}

	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
	}

	avatarID := uuid.New().String()
	filename := avatarID + "_" + sanitizeFilename(file.Filename)
	relativePath := filepath.ToSlash(filepath.Join("assets", "avatars", filename))
	absolutePath := filepath.Join("assets", "avatars", filename)

	if err := c.SaveUploadedFile(file, absolutePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded avatar"})
		return
	}

	_, err = database.DB.Exec(`
		INSERT INTO avatar_library (id, path, name, uploaded_by)
		VALUES ($1, $2, $3, $4)
	`, avatarID, "/"+relativePath, name, middleware.CurrentUserID(c))
	if err != nil {
		_ = os.Remove(absolutePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist avatar metadata"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "UPLOAD_AVATAR", "Uploaded avatar: "+name)
	c.JSON(http.StatusCreated, gin.H{
		"id":   avatarID,
		"path": "/" + relativePath,
		"name": name,
	})
}

func DeleteAvatar(c *gin.Context) {
	avatarID := c.Param("id")

	var path string
	err := database.DB.QueryRow("SELECT path FROM avatar_library WHERE id = $1", avatarID).Scan(&path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Avatar not found"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to begin avatar deletion"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("UPDATE users SET selected_avatar_id = NULL WHERE selected_avatar_id = $1", avatarID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear avatar references"})
		return
	}

	if _, err := tx.Exec("DELETE FROM avatar_library WHERE id = $1", avatarID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete avatar metadata"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit avatar deletion"})
		return
	}

	_ = os.Remove(strings.TrimPrefix(path, "/"))
	middleware.LogAction(middleware.CurrentUserID(c), "DELETE_AVATAR", "Deleted avatar: "+avatarID)
	c.JSON(http.StatusOK, gin.H{"message": "Avatar deleted successfully"})
}

func sanitizeFilename(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "..", "")
	name = strings.ReplaceAll(name, "/", "")
	name = strings.ReplaceAll(name, "\\", "")
	if name == "" {
		return "avatar.png"
	}
	return name
}
