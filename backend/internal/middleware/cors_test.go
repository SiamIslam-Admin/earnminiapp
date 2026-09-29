package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"earnminiapp/internal/config"
	"earnminiapp/internal/middleware"
	"earnminiapp/pkg/jwt"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestCORSMiddleware_PreflightOptions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORSMiddleware())

	handlerExecuted := false
	r.POST("/api/v1/test", func(c *gin.Context) {
		handlerExecuted = true
		c.Status(http.StatusOK)
	})

	// 1. Simulate browser preflight OPTIONS request
	req, _ := http.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://brave-kids-wait.loca.lt")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Bypass-Tunnel-Reminder, Authorization, Content-Type")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Preflight should return 204 No Content immediately without executing the downstream route handler
	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.False(t, handlerExecuted)
	assert.Equal(t, "https://brave-kids-wait.loca.lt", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Bypass-Tunnel-Reminder")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "bypass-tunnel-reminder")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "OPTIONS")
}

func TestCORSMiddleware_ActualRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORSMiddleware())

	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest(http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("Origin", "https://t.me")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://t.me", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Bypass-Tunnel-Reminder")
}

func TestAdminAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtManager := jwt.NewJWTManager("test_secret_key_123", 24)
	cfg := &config.Config{
		AdminSecretKey: "secret_123",
		AdminTelegramIDs: []int64{1928631932},
	}

	r := gin.New()
	r.Use(middleware.AdminAuthMiddleware("secret_123", jwtManager, cfg, nil))
	r.GET("/admin/data", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "admin_granted"})
	})

	// 1. Test missing credentials -> 401
	req1, _ := http.NewRequest(http.MethodGet, "/admin/data", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusUnauthorized, w1.Code)

	// 2. Test valid X-Admin-Secret header -> 200
	req2, _ := http.NewRequest(http.MethodGet, "/admin/data", nil)
	req2.Header.Set("X-Admin-Secret", "secret_123")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// 3. Test valid Admin JWT Bearer token -> 200
	adminToken, err := jwtManager.GenerateToken(999, 1928631932, "admin")
	assert.NoError(t, err)
	req3, _ := http.NewRequest(http.MethodGet, "/admin/data", nil)
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusOK, w3.Code)
}

func TestRequireMainAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/main-only", func(c *gin.Context) {
		if c.GetHeader("X-Role") == "main_admin" {
			c.Set("isMainAdmin", true)
		}
		c.Next()
	}, middleware.RequireMainAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Sub-admin or regular user blocked -> 403 Forbidden
	req1, _ := http.NewRequest(http.MethodGet, "/main-only", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusForbidden, w1.Code)

	// Main admin allowed -> 200 OK
	req2, _ := http.NewRequest(http.MethodGet, "/main-only", nil)
	req2.Header.Set("X-Role", "main_admin")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
}

func TestRequirePermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/support-only", func(c *gin.Context) {
		if role := c.GetHeader("X-Role"); role == "main_admin" {
			c.Set("isMainAdmin", true)
		} else if role == "support_sub" {
			c.Set("isMainAdmin", false)
			c.Set("permissions", []string{"support", "users_view"})
		} else if role == "other_sub" {
			c.Set("isMainAdmin", false)
			c.Set("permissions", []string{"contests_manage"})
		}
		c.Next()
	}, middleware.RequirePermission("support"), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Main admin allowed -> 200
	req1, _ := http.NewRequest(http.MethodGet, "/support-only", nil)
	req1.Header.Set("X-Role", "main_admin")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Sub-admin with support permission allowed -> 200
	req2, _ := http.NewRequest(http.MethodGet, "/support-only", nil)
	req2.Header.Set("X-Role", "support_sub")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// Sub-admin without support permission denied -> 403
	req3, _ := http.NewRequest(http.MethodGet, "/support-only", nil)
	req3.Header.Set("X-Role", "other_sub")
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusForbidden, w3.Code)
}
