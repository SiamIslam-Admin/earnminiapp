package jwt_test

import (
	"testing"
	"time"

	"earnminiapp/pkg/jwt"
)

func TestJWTTokenGenerationAndValidation(t *testing.T) {
	manager := jwt.NewJWTManager("test-secret-key-12345", 24)

	userID := int64(42)
	tgID := int64(987654321)
	username := "testuser"

	token, err := manager.GenerateToken(userID, tgID, username)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if token == "" {
		t.Fatal("Token is empty")
	}

	claims, err := manager.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected UserID %d, got %d", userID, claims.UserID)
	}

	if claims.TelegramID != tgID {
		t.Errorf("Expected TelegramID %d, got %d", tgID, claims.TelegramID)
	}

	if claims.Username != username {
		t.Errorf("Expected Username %s, got %s", username, claims.Username)
	}
}

func TestInvalidJWTToken(t *testing.T) {
	manager := jwt.NewJWTManager("test-secret-key-12345", 24)

	_, err := manager.ValidateToken("invalid.token.string")
	if err == nil {
		t.Fatal("Expected error for invalid token, got nil")
	}
}

func TestExportTokenGenerationAndValidation(t *testing.T) {
	manager := jwt.NewJWTManager("test-secret-key-12345", 24)

	token, err := manager.GenerateExportToken("withdrawals", 5*time.Minute)
	if err != nil {
		t.Fatalf("Failed to generate export token: %v", err)
	}

	// Validate matching type
	if err := manager.ValidateExportToken(token, "withdrawals"); err != nil {
		t.Errorf("Expected valid export token, got error: %v", err)
	}

	// Validate wildcard/empty expected type
	if err := manager.ValidateExportToken(token, ""); err != nil {
		t.Errorf("Expected valid export token with empty filter, got error: %v", err)
	}

	// Validate mismatched type
	if err := manager.ValidateExportToken(token, "users"); err == nil {
		t.Errorf("Expected error for mismatched export type, got nil")
	}
}
