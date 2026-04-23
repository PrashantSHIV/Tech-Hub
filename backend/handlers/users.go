package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
	"golang.org/x/crypto/bcrypt"
)

func ListUsers(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, username, email, password_hash, role, selected_avatar_id, is_active, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.Role, &user.SelectedAvatarID, &user.IsActive, &user.CreatedAt, &user.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan users"})
			return
		}
		users = append(users, user)
	}

	c.JSON(http.StatusOK, users)
}

func CreateUser(c *gin.Context) {
	var input struct {
		Username         string  `json:"username" binding:"required"`
		Email            string  `json:"email" binding:"required"`
		Password         string  `json:"password" binding:"required"`
		Role             string  `json:"role" binding:"required"`
		SelectedAvatarID *string `json:"selected_avatar_id"`
		IsActive         *bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := strings.ToUpper(strings.TrimSpace(input.Role))
	if role != "ADMIN" && role != "MEMBER" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be ADMIN or MEMBER"})
		return
	}

	if input.SelectedAvatarID != nil {
		if err := validateAvatarSelection(*input.SelectedAvatarID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "selected avatar does not exist"})
			return
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	userID := uuid.New().String()
	_, err = database.DB.Exec(`
		INSERT INTO users (id, username, email, password_hash, role, selected_avatar_id, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, userID, strings.TrimSpace(input.Username), strings.TrimSpace(input.Email), string(passwordHash), role, input.SelectedAvatarID, isActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user: " + err.Error()})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "CREATE_USER", "Created user: "+strings.TrimSpace(input.Email))
	c.JSON(http.StatusCreated, gin.H{"id": userID, "message": "User created successfully"})
}

func UpdateUser(c *gin.Context) {
	userID := c.Param("id")
	var input struct {
		Username         string  `json:"username" binding:"required"`
		Email            string  `json:"email" binding:"required"`
		Password         string  `json:"password"`
		Role             string  `json:"role" binding:"required"`
		SelectedAvatarID *string `json:"selected_avatar_id"`
		IsActive         *bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := strings.ToUpper(strings.TrimSpace(input.Role))
	if role != "ADMIN" && role != "MEMBER" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be ADMIN or MEMBER"})
		return
	}

	if input.SelectedAvatarID != nil {
		if err := validateAvatarSelection(*input.SelectedAvatarID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "selected avatar does not exist"})
			return
		}
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	if strings.TrimSpace(input.Password) != "" {
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		_, err = database.DB.Exec(`
			UPDATE users
			SET username = $1, email = $2, password_hash = $3, role = $4, selected_avatar_id = $5, is_active = $6, updated_at = NOW()
			WHERE id = $7
		`, strings.TrimSpace(input.Username), strings.TrimSpace(input.Email), string(passwordHash), role, input.SelectedAvatarID, isActive, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}
	} else {
		_, err := database.DB.Exec(`
			UPDATE users
			SET username = $1, email = $2, role = $3, selected_avatar_id = $4, is_active = $5, updated_at = NOW()
			WHERE id = $6
		`, strings.TrimSpace(input.Username), strings.TrimSpace(input.Email), role, input.SelectedAvatarID, isActive, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}
	}

	middleware.LogAction(middleware.CurrentUserID(c), "UPDATE_USER", "Updated user: "+userID)
	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

func DeleteUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == middleware.CurrentUserID(c) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot delete your own account"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "DELETE_USER", "Deleted user: "+userID)
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

func UpdateMyAvatar(c *gin.Context) {
	var input struct {
		SelectedAvatarID string `json:"selected_avatar_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := validateAvatarSelection(input.SelectedAvatarID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "selected avatar does not exist"})
		return
	}

	_, err := database.DB.Exec(`
		UPDATE users SET selected_avatar_id = $1, updated_at = NOW() WHERE id = $2
	`, input.SelectedAvatarID, middleware.CurrentUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update avatar selection"})
		return
	}

	middleware.LogAction(middleware.CurrentUserID(c), "SELECT_AVATAR", "Updated avatar selection")
	c.JSON(http.StatusOK, gin.H{"message": "Avatar updated successfully"})
}

func validateAvatarSelection(avatarID string) error {
	var exists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM avatar_library WHERE id = $1)", avatarID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("avatar not found")
	}
	return nil
}
