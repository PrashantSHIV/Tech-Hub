package middleware

import (
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
)

func LogAction(writerID, action, details string) {
	id := uuid.New().String()
	_, err := database.DB.Exec("INSERT INTO logs (id, writer_id, action, details) VALUES (?, ?, ?, ?)", id, writerID, action, details)
	if err != nil {
		// Log error to console, but don't stop the request
		println("Failed to log action:", err.Error())
	}
}
