package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID     int64  `json:"user_id"`
	TelegramID int64  `json:"telegram_id"`
	Username   string `json:"username"`
	jwt.RegisteredClaims
}

type ExportClaims struct {
	ExportType string `json:"export_type"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secretKey     []byte
	durationHours int
}

func NewJWTManager(secret string, durationHours int) *JWTManager {
	return &JWTManager{
		secretKey:     []byte(secret),
		durationHours: durationHours,
	}
}

func (m *JWTManager) GenerateToken(userID, telegramID int64, username string) (string, error) {
	claims := Claims{
		UserID:     userID,
		TelegramID: telegramID,
		Username:   username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(m.durationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid or expired token")
}

// GenerateExportToken generates a cryptographically signed temporary token for downloading CSVs (e.g. 5 min expiry)
func (m *JWTManager) GenerateExportToken(exportType string, duration time.Duration) (string, error) {
	if duration <= 0 {
		duration = 5 * time.Minute
	}
	claims := ExportClaims{
		ExportType: exportType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   "admin_export",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

// ValidateExportToken validates a temporary export token and optionally checks export_type
func (m *JWTManager) ValidateExportToken(tokenString string, expectedType string) error {
	token, err := jwt.ParseWithClaims(tokenString, &ExportClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secretKey, nil
	})

	if err != nil {
		return err
	}

	if claims, ok := token.Claims.(*ExportClaims); ok && token.Valid {
		if expectedType != "" && claims.ExportType != expectedType && claims.ExportType != "all" && claims.ExportType != "*" {
			return errors.New("export token type mismatch")
		}
		return nil
	}

	return errors.New("invalid or expired export token")
}
