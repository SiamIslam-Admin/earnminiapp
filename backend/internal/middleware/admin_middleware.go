package middleware

import (
	"strings"

	"earnminiapp/internal/config"
	"earnminiapp/internal/repository"
	"earnminiapp/pkg/jwt"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

func AdminAuthMiddleware(adminSecretKey string, jwtManager *jwt.JWTManager, cfg *config.Config, subAdminRepo *repository.SubAdminRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check Query Token Auth (e.g. for /admin/export/* download links in browser)
		queryToken := c.Query("token")
		if queryToken == "" {
			queryToken = c.Query("export_token")
		}
		if queryToken != "" && jwtManager != nil {
			// First, test if it is a valid temporary export token
			if err := jwtManager.ValidateExportToken(queryToken, ""); err == nil {
				c.Set("isAdmin", true)
				c.Set("isMainAdmin", true)
				c.Set("role", "main_admin")
				c.Next()
				return
			}

			// Second, test if it is a standard admin session JWT token
			claims, err := jwtManager.ValidateToken(queryToken)
			if err == nil && claims != nil {
				if claims.Username == "admin" || (cfg != nil && cfg.IsAdmin(claims.TelegramID)) {
					c.Set("userID", claims.UserID)
					c.Set("telegramID", claims.TelegramID)
					c.Set("isAdmin", true)
					c.Set("isMainAdmin", true)
					c.Set("role", "main_admin")
					c.Next()
					return
				}
				if subAdminRepo != nil && claims.TelegramID != 0 {
					sa, saErr := subAdminRepo.GetByTelegramID(c.Request.Context(), claims.TelegramID)
					if saErr == nil && sa != nil && sa.IsActive {
						c.Set("userID", claims.UserID)
						c.Set("telegramID", claims.TelegramID)
						c.Set("isAdmin", true)
						c.Set("isMainAdmin", false)
						c.Set("isSubAdmin", true)
						c.Set("subAdminID", sa.ID)
						c.Set("role", sa.Role)
						c.Set("permissions", sa.Permissions)
						c.Next()
						return
					}
				}
			}
		}

		// 2. Check X-Admin-Secret header (for direct CLI/service calls)
		secretHeader := c.GetHeader("X-Admin-Secret")
		if secretHeader != "" && secretHeader == adminSecretKey {
			c.Set("isAdmin", true)
			c.Set("isMainAdmin", true)
			c.Set("role", "main_admin")
			c.Next()
			return
		}

		// 3. Check Authorization Bearer JWT token (issued by POST /api/v1/admin/auth)
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				tokenStr := parts[1]
				claims, err := jwtManager.ValidateToken(tokenStr)
				if err == nil && claims != nil {
					if claims.Username == "admin" || (cfg != nil && cfg.IsAdmin(claims.TelegramID)) {
						c.Set("userID", claims.UserID)
						c.Set("telegramID", claims.TelegramID)
						c.Set("isAdmin", true)
						c.Set("isMainAdmin", true)
						c.Set("role", "main_admin")
						c.Next()
						return
					}
					if subAdminRepo != nil && claims.TelegramID != 0 {
						sa, saErr := subAdminRepo.GetByTelegramID(c.Request.Context(), claims.TelegramID)
						if saErr == nil && sa != nil && sa.IsActive {
							c.Set("userID", claims.UserID)
							c.Set("telegramID", claims.TelegramID)
							c.Set("isAdmin", true)
							c.Set("isMainAdmin", false)
							c.Set("isSubAdmin", true)
							c.Set("subAdminID", sa.ID)
							c.Set("role", sa.Role)
							c.Set("permissions", sa.Permissions)
							c.Next()
							return
						}
					}
				}
			}
		}

		response.Unauthorized(c, "Unauthorized: Admin authorization required. Please login with admin secret key.")
		c.Abort()
	}
}

// RequireMainAdmin ensures only main administrators (env-configured) can access the endpoint
func RequireMainAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		isMainAdmin, _ := c.Get("isMainAdmin")
		if isMainAdmin != true {
			response.Forbidden(c, "Forbidden: Only main administrators can manage sub-admins and system security.")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequirePermission verifies that the user is either a main admin or has the requested permission
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		isMainAdmin, _ := c.Get("isMainAdmin")
		if isMainAdmin == true {
			c.Next()
			return
		}

		permsRaw, exists := c.Get("permissions")
		if exists {
			if perms, ok := permsRaw.([]string); ok {
				for _, p := range perms {
					if p == permission || p == "all" || p == "admin" {
						c.Next()
						return
					}
				}
			}
		}

		response.Forbidden(c, "Forbidden: You do not have sufficient permissions for this operation.")
		c.Abort()
	}
}
