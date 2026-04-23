package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID               string    `json:"id"`
	Username         string    `json:"username"`
	Email            string    `json:"email"`
	PasswordHash     string    `json:"-"`
	Role             string    `json:"role"`
	SelectedAvatarID *string   `json:"selected_avatar_id,omitempty"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AvatarLibrary struct {
	ID         string    `json:"id"`
	Path       string    `json:"path"`
	Name       string    `json:"name"`
	UploadedBy *string   `json:"uploaded_by,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type PasswordResetOTP struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	OTPCode   string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Document struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Content     string          `json:"content,omitempty"`
	ContentJSON json.RawMessage `json:"content_json,omitempty"`
	AuthorID    string          `json:"author_id,omitempty"`
	Author      string          `json:"author"`
	Tags        string          `json:"tags"`
	Category    string          `json:"category"`
	Image       string          `json:"image"`
	ReadTime    string          `json:"readTime"`
	Status      string          `json:"status,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type Log struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

type Interaction struct {
	ID         string    `json:"id"`
	DocID      string    `json:"doc_id"`
	Stars      int       `json:"stars"`
	Comment    string    `json:"comment"`
	Type       string    `json:"type"`
	IsApproved bool      `json:"is_approved"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}
