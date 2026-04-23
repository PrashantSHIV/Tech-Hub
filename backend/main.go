package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/user/doc-platform/database"
	"github.com/user/doc-platform/handlers"
	"github.com/user/doc-platform/middleware"
	"golang.org/x/time/rate"
)

func main() {
	database.InitDB()

	r := gin.Default()
	r.MaxMultipartMemory = 8 << 20

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

	r.Static("/assets/avatars", "./assets/avatars")

	docLimiter := middleware.NewIPRateLimiter(rate.Limit(30), 30)
	commentLimiter := middleware.NewIPRateLimiter(rate.Limit(3.0/60.0), 3)

	public := r.Group("/api")
	{
		public.GET("/docs", middleware.RateLimitMiddleware(docLimiter), handlers.GetDocuments)
		public.GET("/docs/:id", handlers.GetDocument)
		public.GET("/docs/:id/comments", middleware.RateLimitMiddleware(docLimiter), handlers.GetPublicComments)
		public.GET("/categories", handlers.GetCategories)
		public.POST("/interactions", middleware.RateLimitMiddleware(commentLimiter), handlers.CreateInteraction)
		public.POST("/login", handlers.Login)
		public.POST("/password-reset/request", handlers.RequestPasswordReset)
		public.POST("/password-reset/verify", handlers.VerifyPasswordResetOTP)
		public.POST("/password-reset/confirm", handlers.ConfirmPasswordReset)
	}

	authed := r.Group("/api")
	authed.Use(middleware.AuthMiddleware())
	{
		authed.GET("/avatars", handlers.ListAvatars)
		authed.PUT("/me/avatar", handlers.UpdateMyAvatar)
	}

	adminDocs := r.Group("/api/admin")
	adminDocs.Use(middleware.AuthMiddleware())
	{
		adminDocs.GET("/docs", handlers.GetManagedDocuments)
		adminDocs.GET("/docs/:id", handlers.GetManagedDocument)
		adminDocs.POST("/docs", handlers.CreateDocument)
		adminDocs.PUT("/docs/:id", handlers.UpdateDocument)
		adminDocs.DELETE("/docs/:id", handlers.DeleteDocument)
		adminDocs.POST("/comments/:id/approve", middleware.RequireRole("ADMIN"), handlers.ApproveComment)
	}

	adminOnly := r.Group("/api/admin")
	adminOnly.Use(middleware.AuthMiddleware(), middleware.RequireRole("ADMIN"))
	{
		adminOnly.GET("/users", handlers.ListUsers)
		adminOnly.POST("/users", handlers.CreateUser)
		adminOnly.PUT("/users/:id", handlers.UpdateUser)
		adminOnly.DELETE("/users/:id", handlers.DeleteUser)

		adminOnly.GET("/avatars", handlers.ListAvatars)
		adminOnly.POST("/avatars", handlers.UploadAvatar)
		adminOnly.DELETE("/avatars/:id", handlers.DeleteAvatar)
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
