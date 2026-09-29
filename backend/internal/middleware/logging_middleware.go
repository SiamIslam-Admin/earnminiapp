package middleware

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w bodyLogWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// DetailedRequestResponseLogger logs full request and response bodies for development inspection
func DetailedRequestResponseLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		rawQuery := c.Request.URL.RawQuery
		if rawQuery != "" {
			path = path + "?" + rawQuery
		}

		// Don't clutter logs for static assets or health checks unless error
		if strings.HasPrefix(c.Request.URL.Path, "/uploads/") {
			c.Next()
			return
		}

		// 1. Read and restore Request Body
		var reqBodyStr string
		if c.Request.Body != nil {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil {
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				reqBodyStr = strings.TrimSpace(string(bodyBytes))
			}
		}

		// 2. Intercept Response Body
		blw := &bodyLogWriter{
			body:           bytes.NewBufferString(""),
			ResponseWriter: c.Writer,
		}
		c.Writer = blw

		// 3. Process Request
		c.Next()

		// 4. Calculate Duration and Status
		duration := time.Since(start)
		status := c.Writer.Status()
		resBodyStr := strings.TrimSpace(blw.body.String())

		// Compact log for OPTIONS preflight
		if c.Request.Method == http.MethodOptions {
			log.Printf("[CORS] OPTIONS %s -> %d (%v)", path, status, duration)
			return
		}

		// 5. Print Detailed Box to Console
		var statusIcon string
		switch {
		case status >= 200 && status < 300:
			statusIcon = "✅"
		case status >= 300 && status < 400:
			statusIcon = "🔀"
		case status >= 400 && status < 500:
			statusIcon = "⚠️"
		default:
			statusIcon = "❌"
		}

		separator := "──────────────────────────────────────────────────────────────────────"
		fmt.Println("\n" + separator)
		fmt.Printf("📥 [REQUEST]  %s %s\n", c.Request.Method, path)
		if reqBodyStr != "" {
			if len(reqBodyStr) > 1500 {
				fmt.Printf("📦 Request Payload:  %s... [truncated %d bytes]\n", reqBodyStr[:1500], len(reqBodyStr))
			} else {
				fmt.Printf("📦 Request Payload:  %s\n", reqBodyStr)
			}
		} else {
			fmt.Printf("📦 Request Payload:  (empty / none)\n")
		}

		fmt.Printf("📤 [RESPONSE] %s Status: %d (%s) | Duration: %v\n", statusIcon, status, http.StatusText(status), duration)
		if resBodyStr != "" {
			if len(resBodyStr) > 2000 {
				fmt.Printf("📦 Response Body:   %s... [truncated %d bytes]\n", resBodyStr[:2000], len(resBodyStr))
			} else {
				fmt.Printf("📦 Response Body:   %s\n", resBodyStr)
			}
		} else {
			fmt.Printf("📦 Response Body:   (empty / none)\n")
		}
		fmt.Println(separator)
	}
}
