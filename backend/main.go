package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/handlers"
	"github.com/user/doc-platform/middleware"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

func main() {
	database.InitDB()
	seedWriter()

	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Rate limiters
	docLimiter := middleware.NewIPRateLimiter(rate.Limit(30), 30)          // 30 req/sec
	commentLimiter := middleware.NewIPRateLimiter(rate.Limit(3.0/60.0), 3) // 3 req/min

	// Public Routes
	public := r.Group("/api")
	{
		public.GET("/docs", middleware.RateLimitMiddleware(docLimiter), handlers.GetDocuments)
		public.GET("/docs/:id", handlers.GetDocument)
		public.GET("/docs/:id/comments", middleware.RateLimitMiddleware(docLimiter), handlers.GetPublicComments)
		public.GET("/categories", handlers.GetCategories)
		public.POST("/interactions", middleware.RateLimitMiddleware(commentLimiter), handlers.CreateInteraction)
		public.POST("/login", handlers.Login)
	}

	// Protected Routes (Writers only)
	protected := r.Group("/api/admin")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.POST("/docs", handlers.CreateDocument)
		protected.PUT("/docs/:id", handlers.UpdateDocument)
		protected.DELETE("/docs/:id", handlers.DeleteDocument)
		protected.POST("/comments/:id/approve", handlers.ApproveComment)
		// Action logs can be added here
	}

	log.Println("Server starting on :8080")
	r.Run(":8080")
}

func seedWriter() {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM writers").Scan(&count)
	if count == 0 {
		id := uuid.New().String()
		password, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		_, err := database.DB.Exec("INSERT INTO writers (id, email, password) VALUES (?, ?, ?)", id, "admin@example.com", string(password))
		if err != nil {
			log.Println("Failed to seed writer:", err)
		} else {
			log.Println("Seeded default writer: admin@example.com / admin123")

			// Seed sample documents
			docs := []map[string]interface{}{
				{
					"title":       "Google OAuth 2.0 Integration",
					"description": "Learn how to implement Google Login in your web application using the OAuth 2.0 protocol.",
					"author":      "Aarav Mehta",
					"category":    "Authentication",
					"tags":        "Authentication",
					"image":       "tech_minimalist_art.png",
					"read_time":   "10 min read",
					"content":     "Full content about OAuth 2.0...",
				},
				{
					"title":       "How Access & Refresh Tokens Work",
					"description": "A deep dive into token-based authentication, expiration, and silent renewal strategies.",
					"author":      "Riya Sharma",
					"category":    "Security",
					"tags":        "Security",
					"image":       "abstract_architecture_clean.png",
					"read_time":   "8 min read",
					"content":     "Full content about tokens...",
				},
				{
					"title":       "Firebase Cloud Messaging Setup",
					"description": "Complete guide to setting up push notifications for your web and mobile users.",
					"author":      "Kabir Nanda",
					"category":    "Cloud",
					"tags":        "Cloud",
					"image":       "nature_productivity_serene.png",
					"read_time":   "9 min read",
					"content":     "Full content about Firebase...",
				},
			}

			for _, doc := range docs {
				docID := uuid.New().String()
				_, err := database.DB.Exec(
					"INSERT INTO documents (id, title, description, content, author_id, author, category, tags, image, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					docID, doc["title"], doc["description"], doc["content"], id, doc["author"], doc["category"], doc["tags"], doc["image"], doc["read_time"],
				)
				if err != nil {
					log.Println("Failed to seed document:", err)
				}
			}
		}
	}
}
