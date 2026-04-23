package models

import "time"

type Writer struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type Document struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Content     string    `json:"content"`
	AuthorID    string    `json:"author_id"`
	Author      string    `json:"author"`
	Tags        string    `json:"tags"`
	Category    string    `json:"category"`
	Image       string    `json:"image"`
	ReadTime    string    `json:"readTime"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

type Log struct {
	ID        string    `json:"id"`
	WriterID  string    `json:"writer_id"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

type Interaction struct {
	ID         string    `json:"id"`
	DocID      string    `json:"doc_id"`
	Stars      int       `json:"stars"`
	Comment    string    `json:"comment"`
	Type       string    `json:"type"` // 'suggestion' or 'comment'
	IsApproved bool      `json:"is_approved"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}
