package middleware

import (
	"strings"

	"earnminiapp/pkg/jwt"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

const (
	CtxUserIDKey     = "userID"
	CtxTelegramIDKey = "telegramID"
	CtxUsernameKey   = "username"
)

func AuthMiddleware(jwtManager *jwt.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Authorization header required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			response.Unauthorized(c, "Invalid authorization header format (Bearer <token>)")
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := jwtManager.ValidateToken(tokenString)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired session token")
			c.Abort()
			return
		}

		c.Set(CtxUserIDKey, claims.UserID)
		c.Set(CtxTelegramIDKey, claims.TelegramID)
		c.Set(CtxUsernameKey, claims.Username)

		c.Next()
	}
}

// OptionalAuthMiddleware attaches user info if token is valid, but allows unauthenticated requests
func OptionalAuthMiddleware(jwtManager *jwt.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				if claims, err := jwtManager.ValidateToken(parts[1]); err == nil {
					c.Set(CtxUserIDKey, claims.UserID)
					c.Set(CtxTelegramIDKey, claims.TelegramID)
					c.Set(CtxUsernameKey, claims.Username)
				}
			}
		}
		c.Next()
	}
}

func GetUserID(c *gin.Context) int64 {
	val, exists := c.Get(CtxUserIDKey)
	if !exists {
		return 0
	}
	id, ok := val.(int64)
	if !ok {
		return 0
	}
	return id
}
