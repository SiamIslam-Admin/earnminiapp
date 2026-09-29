package middleware

import (
	"net/http"
	"sync"
	"time"

	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type clientRate struct {
	count     int
	resetTime time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientRate
	maxReq  int
	window  time.Duration
}

func NewRateLimiter(maxReq int, window time.Duration) *RateLimiter {
	limiter := &RateLimiter{
		clients: make(map[string]*clientRate),
		maxReq:  maxReq,
		window:  window,
	}

	// Clean up stale entries every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			limiter.mu.Lock()
			now := time.Now()
			for ip, cr := range limiter.clients {
				if now.After(cr.resetTime) {
					delete(limiter.clients, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

func (l *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admin routes with admin secret are exempt from public rate limiting
		if c.GetHeader("X-Admin-Secret") != "" {
			c.Next()
			return
		}

		ip := c.GetHeader("X-Forwarded-For")
		if ip == "" {
			ip = c.ClientIP()
		}

		l.mu.Lock()
		now := time.Now()
		cr, exists := l.clients[ip]
		if !exists || now.After(cr.resetTime) {
			l.clients[ip] = &clientRate{
				count:     1,
				resetTime: now.Add(l.window),
			}
			l.mu.Unlock()
			c.Next()
			return
		}

		if cr.count >= l.maxReq {
			l.mu.Unlock()
			response.Error(c, http.StatusTooManyRequests, "Too many requests. Please slow down.")
			c.Abort()
			return
		}

		cr.count++
		l.mu.Unlock()
		c.Next()
	}
}
