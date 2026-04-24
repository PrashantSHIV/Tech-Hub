package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func InitDB() {
	var err error
	databaseURL := getDatabaseURL()
	ensureDatabaseExists(databaseURL)

	DB, err = sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	if err := DB.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	if err := os.MkdirAll(filepath.Join("assets", "avatars"), 0o755); err != nil {
		log.Fatal("Failed to create avatar directory:", err)
	}

	resetLegacySchemaIfNeeded()
	createSchema()
	seedDevData()
}

func getDatabaseURL() string {
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		return dsn
	}

	return "postgres://postgres:postgres@localhost:5432/doc_platform?sslmode=disable"
}

func ensureDatabaseExists(databaseURL string) {
	adminURL, databaseName, err := getAdminConnectionURL(databaseURL)
	if err != nil {
		log.Fatal("Failed to parse database URL:", err)
	}

	adminDB, err := sql.Open("postgres", adminURL)
	if err != nil {
		log.Fatal("Failed to connect to postgres server:", err)
	}
	defer adminDB.Close()

	if err := adminDB.Ping(); err != nil {
		log.Fatal("Failed to reach postgres server:", err)
	}

	var exists bool
	if err := adminDB.QueryRow("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)", databaseName).Scan(&exists); err != nil {
		log.Fatal("Failed to inspect database list:", err)
	}

	if exists {
		return
	}

	if _, err := adminDB.Exec("CREATE DATABASE " + pq.QuoteIdentifier(databaseName)); err != nil {
		log.Fatal("Failed to create database:", err)
	}

	log.Printf("Created PostgreSQL database %q", databaseName)
}

func getAdminConnectionURL(databaseURL string) (string, string, error) {
	if strings.HasPrefix(databaseURL, "postgres://") || strings.HasPrefix(databaseURL, "postgresql://") {
		parsed, err := url.Parse(databaseURL)
		if err != nil {
			return "", "", err
		}

		databaseName := strings.TrimPrefix(parsed.Path, "/")
		if databaseName == "" {
			return "", "", fmt.Errorf("database name is missing from DATABASE_URL")
		}

		parsed.Path = "/postgres"
		return parsed.String(), databaseName, nil
	}

	parts := strings.Fields(databaseURL)
	databaseName := ""
	for index, part := range parts {
		if strings.HasPrefix(part, "dbname=") {
			databaseName = strings.TrimPrefix(part, "dbname=")
			parts[index] = "dbname=postgres"
			break
		}
	}

	if databaseName == "" {
		return "", "", fmt.Errorf("database name is missing from DATABASE_URL")
	}

	return strings.Join(parts, " "), databaseName, nil
}

func resetLegacySchemaIfNeeded() {
	var hasUsers bool
	err := DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'users'
		)
	`).Scan(&hasUsers)
	if err != nil {
		log.Fatal("Failed to inspect schema:", err)
	}

	if hasUsers {
		return
	}

	resetSQL := `
	DROP TABLE IF EXISTS interactions CASCADE;
	DROP TABLE IF EXISTS logs CASCADE;
	DROP TABLE IF EXISTS documents CASCADE;
	DROP TABLE IF EXISTS password_reset_otps CASCADE;
	DROP TABLE IF EXISTS avatar_library CASCADE;
	DROP TABLE IF EXISTS users CASCADE;
	DROP TABLE IF EXISTS categories CASCADE;
	DROP TABLE IF EXISTS writers CASCADE;
	DROP TYPE IF EXISTS document_status CASCADE;
	DROP TYPE IF EXISTS user_role CASCADE;
	`

	if _, err := DB.Exec(resetSQL); err != nil {
		log.Fatal("Failed to reset legacy schema:", err)
	}
}

func createSchema() {
	schema := `
	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
			CREATE TYPE user_role AS ENUM ('ADMIN', 'MEMBER');
		END IF;
	END $$;

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
			CREATE TYPE document_status AS ENUM ('DRAFT', 'PUBLISHED');
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS avatar_library (
		id UUID PRIMARY KEY,
		path TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		uploaded_by UUID,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role user_role NOT NULL,
		selected_avatar_id UUID REFERENCES avatar_library(id) ON DELETE SET NULL,
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS password_reset_otps (
		id UUID PRIMARY KEY,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		otp_code TEXT NOT NULL,
		expires_at TIMESTAMPTZ NOT NULL,
		used_at TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS documents (
		id UUID PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT,
		author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		author_name TEXT NOT NULL,
		category TEXT,
		tags TEXT,
		content_json JSONB NOT NULL DEFAULT '[]'::jsonb,
		status document_status NOT NULL DEFAULT 'DRAFT',
		image TEXT,
		read_time TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS logs (
		id UUID PRIMARY KEY,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		action TEXT NOT NULL,
		details TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS interactions (
		id UUID PRIMARY KEY,
		doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
		commenter_name TEXT NOT NULL DEFAULT 'Anonymous',
		stars INTEGER,
		comment TEXT,
		type TEXT NOT NULL,
		is_approved BOOLEAN NOT NULL DEFAULT FALSE,
		ip_address TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	ALTER TABLE interactions
		ADD COLUMN IF NOT EXISTS commenter_name TEXT NOT NULL DEFAULT 'Anonymous';

	CREATE INDEX IF NOT EXISTS idx_documents_status_created_at ON documents(status, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id);
	CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
	CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id ON password_reset_otps(user_id);
	`

	if _, err := DB.Exec(schema); err != nil {
		log.Fatal("Failed to create schema:", err)
	}
}

func seedDevData() {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		log.Fatal("Failed to inspect users:", err)
	}
	if count > 0 {
		return
	}

	adminID := uuid.New()
	memberID := uuid.New()
	adminPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	memberPassword, _ := bcrypt.GenerateFromPassword([]byte("member123"), bcrypt.DefaultCost)

	_, err := DB.Exec(`
		INSERT INTO users (id, username, email, password_hash, role, is_active)
		VALUES
			($1, $2, $3, $4, 'ADMIN', TRUE),
			($5, $6, $7, $8, 'MEMBER', TRUE)
	`,
		adminID, "admin", "admin@example.com", string(adminPassword),
		memberID, "member", "member@example.com", string(memberPassword),
	)
	if err != nil {
		log.Fatal("Failed to seed users:", err)
	}

	docs := []struct {
		title       string
		description string
		category    string
		tags        string
		image       string
		readTime    string
		status      string
		authorID    uuid.UUID
		authorName  string
		contentJSON []map[string]any
	}{
		{
			title:       "Google OAuth 2.0 Integration",
			description: "Learn how to implement Google Login in your web application using the OAuth 2.0 protocol.",
			category:    "Authentication",
			tags:        "Authentication, OAuth",
			image:       "tech_minimalist_art.png",
			readTime:    "10 min read",
			status:      "PUBLISHED",
			authorID:    adminID,
			authorName:  "admin",
			contentJSON: []map[string]any{{"type": "text", "markdown": "# Google OAuth 2.0 Integration\n\nFull content about OAuth 2.0..."}}},
		{
			title:       "How Access & Refresh Tokens Work",
			description: "A deep dive into token-based authentication, expiration, and silent renewal strategies.",
			category:    "Security",
			tags:        "Security, Tokens",
			image:       "abstract_architecture_clean.png",
			readTime:    "8 min read",
			status:      "PUBLISHED",
			authorID:    memberID,
			authorName:  "member",
			contentJSON: []map[string]any{{"type": "text", "markdown": "# How Access & Refresh Tokens Work\n\nFull content about tokens..."}}},
		{
			title:       "Firebase Cloud Messaging Setup",
			description: "Complete guide to setting up push notifications for your web and mobile users.",
			category:    "Cloud",
			tags:        "Cloud, Firebase",
			image:       "nature_productivity_serene.png",
			readTime:    "9 min read",
			status:      "DRAFT",
			authorID:    memberID,
			authorName:  "member",
			contentJSON: []map[string]any{{"type": "text", "markdown": "# Firebase Cloud Messaging Setup\n\nFull content about Firebase..."}}},
	}

	for _, doc := range docs {
		raw, _ := json.Marshal(doc.contentJSON)
		_, err := DB.Exec(`
			INSERT INTO documents (
				id, title, description, author_id, author_name, category, tags, content_json, status, image, read_time
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
		`,
			uuid.New(), doc.title, doc.description, doc.authorID, doc.authorName, doc.category, doc.tags, string(raw), doc.status, doc.image, doc.readTime,
		)
		if err != nil {
			log.Fatal("Failed to seed documents:", err)
		}
	}

	log.Println(fmt.Sprintf("Seeded default accounts: admin@example.com/admin123 and member@example.com/member123"))
}
