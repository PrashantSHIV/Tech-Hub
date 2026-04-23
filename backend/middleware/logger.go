package middleware

import (
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
)

func LogAction(userID, action, details string) {
	id := uuid.New().String()
	_, err := database.DB.Exec(
		"INSERT INTO logs (id, user_id, action, details) VALUES ($1, $2, $3, $4)",
		id, userID, action, details,
	)
	if err != nil {
		println("Failed to log action:", err.Error())
	}
}
