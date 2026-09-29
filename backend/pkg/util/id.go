package util

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// GenerateTXID creates a cryptographically unique transaction reference ID that prevents collisions
func GenerateTXID(prefix string) string {
	if prefix == "" {
		prefix = "TX"
	}
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().UnixNano(), hex.EncodeToString(b))
}
