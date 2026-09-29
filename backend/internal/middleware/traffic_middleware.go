package middleware

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"earnminiapp/internal/db"
	"github.com/gin-gonic/gin"
)

// TrafficTrackingMiddleware records live requests per second, per minute, and DAU in Redis
func TrafficTrackingMiddleware(redis *db.RedisService) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if redis == nil || !redis.IsConnected() {
			return
		}

		go func(path string, status int, userIDVal any) {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			now := time.Now().UTC()
			secKey := fmt.Sprintf("traffic:sec:%d", now.Unix())
			minKey := fmt.Sprintf("traffic:min:%d", now.Unix()/60)
			hourKey := fmt.Sprintf("traffic:hour:%s", now.Format("2006-01-02-15"))
			dayKey := fmt.Sprintf("traffic:day:%s", now.Format("2006-01-02"))
			monthKey := fmt.Sprintf("traffic:month:%s", now.Format("2006-01"))

			dauKey := fmt.Sprintf("traffic:dau:%s", now.Format("2006-01-02"))
			mauKey := fmt.Sprintf("traffic:mau:%s", now.Format("2006-01"))

			// 1. Increment Second Counter (TTL 120 seconds)
			_, _ = redis.Incr(ctx, secKey)
			_ = redis.Expire(ctx, secKey, 120*time.Second)

			// 2. Increment Minute Counter (TTL 24 hours)
			_, _ = redis.Incr(ctx, minKey)
			_ = redis.Expire(ctx, minKey, 24*time.Hour)

			// 3. Increment Hour Counter (TTL 30 days)
			_, _ = redis.Incr(ctx, hourKey)
			_ = redis.Expire(ctx, hourKey, 30*24*time.Hour)

			// 4. Increment Daily Counter (TTL 90 days)
			_, _ = redis.Incr(ctx, dayKey)
			_ = redis.Expire(ctx, dayKey, 90*24*time.Hour)

			// 5. Increment Monthly Counter (TTL 365 days)
			_, _ = redis.Incr(ctx, monthKey)
			_ = redis.Expire(ctx, monthKey, 365*24*time.Hour)

			// 6. Track Daily & Monthly Active Users via HyperLogLog if authenticated
			if userIDVal != nil {
				var uidStr string
				switch v := userIDVal.(type) {
				case int64:
					uidStr = strconv.FormatInt(v, 10)
				case string:
					uidStr = v
				}
				if uidStr != "" {
					_, _ = redis.PFAdd(ctx, dauKey, uidStr)
					_ = redis.Expire(ctx, dauKey, 90*24*time.Hour)

					_, _ = redis.PFAdd(ctx, mauKey, uidStr)
					_ = redis.Expire(ctx, mauKey, 365*24*time.Hour)
				}
			}
		}(c.Request.URL.Path, c.Writer.Status(), c.Value("user_id"))
	}
}
