package database

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite", "./platform.db")
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	createTables := `
	CREATE TABLE IF NOT EXISTS writers (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS documents (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT,
		content TEXT NOT NULL,
		author_id TEXT NOT NULL,
		author TEXT,
		category TEXT,
		tags TEXT,
		image TEXT,
		read_time TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (author_id) REFERENCES writers(id)
	);

	CREATE TABLE IF NOT EXISTS logs (
		id TEXT PRIMARY KEY,
		writer_id TEXT NOT NULL,
		action TEXT NOT NULL,
		details TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (writer_id) REFERENCES writers(id)
	);

	CREATE TABLE IF NOT EXISTS interactions (
		id TEXT PRIMARY KEY,
		doc_id TEXT NOT NULL,
		stars INTEGER,
		comment TEXT,
		type TEXT NOT NULL, -- 'suggestion' or 'comment'
		is_approved BOOLEAN DEFAULT FALSE,
		ip_address TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (doc_id) REFERENCES documents(id)
	);

	CREATE TABLE IF NOT EXISTS categories (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`

	_, err = DB.Exec(createTables)
	if err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	// Simple migrations to ensure columns exist
	migrations := []string{
		"ALTER TABLE documents ADD COLUMN author TEXT",
		"ALTER TABLE documents ADD COLUMN category TEXT",
		"ALTER TABLE documents ADD COLUMN tags TEXT",
		"ALTER TABLE documents ADD COLUMN image TEXT",
		"ALTER TABLE documents ADD COLUMN read_time TEXT",
		"ALTER TABLE documents ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
	}

	for _, m := range migrations {
		_, _ = DB.Exec(m) // Ignore error if column already exists
	}
}
