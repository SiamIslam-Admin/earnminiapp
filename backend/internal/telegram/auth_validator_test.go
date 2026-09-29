package telegram_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"testing"

	"earnminiapp/internal/telegram"
)

func generateValidInitData(botToken, userJSON string, authDate int64) string {
	dataCheckString := fmt.Sprintf("auth_date=%d\nuser=%s", authDate, userJSON)

	secretMac := hmac.New(sha256.New, []byte("WebAppData"))
	secretMac.Write([]byte(botToken))
	secretKey := secretMac.Sum(nil)

	dataMac := hmac.New(sha256.New, secretKey)
	dataMac.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(dataMac.Sum(nil))

	v := url.Values{}
	v.Set("auth_date", fmt.Sprintf("%d", authDate))
	v.Set("user", userJSON)
	v.Set("hash", hash)

	return v.Encode()
}

func TestValidateInitData_Success(t *testing.T) {
	botToken := "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
	userJSON := `{"id":123456789,"first_name":"PlayerOne","username":"player_one"}`
	authDate := int64(1700000000)

	initData := generateValidInitData(botToken, userJSON, authDate)
	validator := telegram.NewAuthValidator(botToken)

	authData, err := validator.ValidateInitData(initData)
	if err != nil {
		t.Fatalf("Validation failed unexpectedly: %v", err)
	}

	if authData.User == nil {
		t.Fatal("Expected authData.User not to be nil")
	}

	if authData.User.ID != 123456789 {
		t.Errorf("Expected User ID 123456789, got %d", authData.User.ID)
	}

	if authData.User.FirstName != "PlayerOne" {
		t.Errorf("Expected first name 'PlayerOne', got '%s'", authData.User.FirstName)
	}
}

func TestValidateInitData_Tampered(t *testing.T) {
	botToken := "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
	userJSON := `{"id":123456789,"first_name":"PlayerOne","username":"player_one"}`
	authDate := int64(1700000000)

	initData := generateValidInitData(botToken, userJSON, authDate)
	// Tamper with data
	initData += "extra=tampered"

	validator := telegram.NewAuthValidator(botToken)
	_, err := validator.ValidateInitData(initData)
	if err == nil {
		t.Fatal("Expected validation error for tampered data, got nil")
	}
}
