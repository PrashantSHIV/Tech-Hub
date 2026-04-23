package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-very-secret-key")

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := ParseClaimsFromRequest(c.GetHeader("Authorization"))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		c.Set("user_id", claims.Subject)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentRole := CurrentUserRole(c)
		for _, role := range roles {
			if currentRole == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

func ParseClaimsFromRequest(authHeader string) (*Claims, error) {
	if authHeader == "" {
		return nil, errors.New("authorization header required")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if !(len(parts) == 2 && parts[0] == "Bearer") {
		return nil, errors.New("authorization header format must be Bearer {token}")
	}

	token, err := jwt.ParseWithClaims(parts[1], &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || claims.Subject == "" || claims.Role == "" {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

func CurrentUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

func CurrentUserRole(c *gin.Context) string {
	return c.GetString("user_role")
}
