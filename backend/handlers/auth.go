package handlers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/middleware"
	"github.com/user/doc-platform/models"
	"golang.org/x/crypto/bcrypt"
)

func Login(c *gin.Context) {
	var input struct {
		Identifier string `json:"identifier"`
		Email      string `json:"email"`
		Password   string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	identifier := strings.TrimSpace(input.Identifier)
	if identifier == "" {
		identifier = strings.TrimSpace(input.Email)
	}
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "identifier or email is required"})
		return
	}

	user, err := findUserByIdentifier(identifier)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User account is inactive"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.Claims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	tokenString, err := token.SignedString(middleware.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	middleware.LogAction(user.ID, "LOGIN", "User logged in successfully")
	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":                 user.ID,
			"username":           user.Username,
			"email":              user.Email,
			"role":               user.Role,
			"selected_avatar_id": user.SelectedAvatarID,
			"is_active":          user.IsActive,
		},
	})
}

func RequestPasswordReset(c *gin.Context) {
	var input struct {
		Identifier string `json:"identifier" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := findUserByIdentifier(strings.TrimSpace(input.Identifier))
	if err == nil {
		otp := generateOTPCode()
		expiresAt := time.Now().Add(10 * time.Minute)
		_, dbErr := database.DB.Exec(`
			INSERT INTO password_reset_otps (id, user_id, otp_code, expires_at)
			VALUES ($1, $2, $3, $4)
		`, uuid.New().String(), user.ID, otp, expiresAt)
		if dbErr == nil {
			if emailErr := sendPasswordResetEmail(user.Email, otp); emailErr != nil {
				middleware.LogAction(user.ID, "PASSWORD_RESET_EMAIL_FAILED", emailErr.Error())
			} else {
				middleware.LogAction(user.ID, "PASSWORD_RESET_REQUEST", "OTP generated and emailed to "+user.Email)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the account exists, a reset OTP has been sent to its email address."})
}

func VerifyPasswordResetOTP(c *gin.Context) {
	var input struct {
		Identifier string `json:"identifier" binding:"required"`
		OTP        string `json:"otp" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := findUserByIdentifier(strings.TrimSpace(input.Identifier))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	valid, err := isOTPValid(user.ID, strings.TrimSpace(input.OTP))
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true})
}

func ConfirmPasswordReset(c *gin.Context) {
	var input struct {
		Identifier  string `json:"identifier" binding:"required"`
		OTP         string `json:"otp" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := findUserByIdentifier(strings.TrimSpace(input.Identifier))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	otpID, err := getValidOTPRecordID(user.ID, strings.TrimSpace(input.OTP))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to begin transaction"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", string(passwordHash), user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	if _, err := tx.Exec("UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1", otpID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to consume OTP"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit password reset"})
		return
	}

	middleware.LogAction(user.ID, "PASSWORD_RESET_CONFIRM", "Password reset completed")
	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func findUserByIdentifier(identifier string) (models.User, error) {
	var user models.User
	err := database.DB.QueryRow(`
		SELECT id, username, email, password_hash, role, selected_avatar_id, is_active, created_at, updated_at
		FROM users
		WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
	`, identifier).Scan(
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

func isOTPValid(userID, otp string) (bool, error) {
	_, err := getValidOTPRecordID(userID, otp)
	if err != nil {
		return false, err
	}
	return true, nil
}

func getValidOTPRecordID(userID, otp string) (string, error) {
	var otpID string
	err := database.DB.QueryRow(`
		SELECT id
		FROM password_reset_otps
		WHERE user_id = $1
			AND otp_code = $2
			AND used_at IS NULL
			AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, otp).Scan(&otpID)
	return otpID, err
}

func generateOTPCode() string {
	const digits = "0123456789"
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "000000"
	}

	for i := range buf {
		buf[i] = digits[int(buf[i])%len(digits)]
	}

	return string(buf)
}

func sendPasswordResetEmail(toEmail, otp string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	username := strings.TrimSpace(os.Getenv("SMTP_USER"))
	password := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))

	if host == "" {
		host = "smtp.gmail.com"
	}
	if port == "" {
		port = "587"
	}
	if from == "" {
		from = username
	}
	if username == "" || password == "" || from == "" {
		return fmt.Errorf("SMTP_USER, SMTP_PASS, and SMTP_FROM must be configured")
	}

	envelopeFrom := extractEmailAddress(from)
	auth := smtp.PlainAuth("", username, password, host)
	address := host + ":" + port
	subject := "Tech Hobby password reset OTP"
	body := fmt.Sprintf(
		"Your Tech Hobby password reset OTP is %s.\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.\n",
		otp,
	)
	message := strings.Join([]string{
		"From: " + from,
		"To: " + toEmail,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	return smtp.SendMail(address, auth, envelopeFrom, []string{toEmail}, []byte(message))
}

func extractEmailAddress(value string) string {
	start := strings.LastIndex(value, "<")
	end := strings.LastIndex(value, ">")
	if start >= 0 && end > start {
		return strings.TrimSpace(value[start+1 : end])
	}

	return strings.TrimSpace(value)
}
