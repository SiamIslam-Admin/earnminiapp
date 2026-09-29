package telegram

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type TelegramUser struct {
	ID              int64  `json:"id"`
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name,omitempty"`
	Username        string `json:"username,omitempty"`
	LanguageCode    string `json:"language_code,omitempty"`
	IsPremium       bool   `json:"is_premium,omitempty"`
	AllowsWriteToPm bool   `json:"allows_write_to_pm,omitempty"`
	PhotoURL        string `json:"photo_url,omitempty"`
}

type AuthData struct {
	User        *TelegramUser
	AuthDate    time.Time
	QueryID     string
	StartParam  string
	Hash        string
	RawInitData string
}

type AuthValidator struct {
	botToken string
}

func NewAuthValidator(botToken string) *AuthValidator {
	return &AuthValidator{botToken: botToken}
}

// ValidateInitData verifies the cryptographic HMAC signature of Telegram initData
func (v *AuthValidator) ValidateInitData(initDataRaw string) (*AuthData, error) {
	if initDataRaw == "" {
		return nil, errors.New("initData is empty")
	}

	values, err := url.ParseQuery(initDataRaw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse initData query: %w", err)
	}

	hash := values.Get("hash")
	if hash == "" {
		return nil, errors.New("hash parameter missing in initData")
	}

	// Extract user payload
	userRaw := values.Get("user")
	var tgUser *TelegramUser
	if userRaw != "" {
		tgUser = &TelegramUser{}
		if err := json.Unmarshal([]byte(userRaw), tgUser); err != nil {
			return nil, fmt.Errorf("failed to decode user json: %w", err)
		}
	}

	authDateUnix, _ := strconv.ParseInt(values.Get("auth_date"), 10, 64)
	authDate := time.Unix(authDateUnix, 0)

	startParam := values.Get("start_param")
	queryID := values.Get("query_id")

	// If no bot token is configured (e.g. dev environment), allow verification if valid JSON user is present
	if v.botToken == "" {
		if tgUser == nil {
			return nil, errors.New("dev auth mode: user payload required")
		}
		return &AuthData{
			User:        tgUser,
			AuthDate:    authDate,
			QueryID:     queryID,
			StartParam:  startParam,
			Hash:        hash,
			RawInitData: initDataRaw,
		}, nil
	}

	// 1. Collect all keys except hash and sort alphabetically
	keys := make([]string, 0, len(values))
	for k := range values {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	// 2. Build data check string: "k1=v1\nk2=v2"
	var checkParts []string
	for _, k := range keys {
		checkParts = append(checkParts, fmt.Sprintf("%s=%s", k, values.Get(k)))
	}
	dataCheckString := strings.Join(checkParts, "\n")

	// 3. secret_key = HMAC-SHA256("WebAppData", bot_token)
	secretMac := hmac.New(sha256.New, []byte("WebAppData"))
	secretMac.Write([]byte(v.botToken))
	secretKey := secretMac.Sum(nil)

	// 4. calculated_hash = HMAC-SHA256(secret_key, dataCheckString)
	dataMac := hmac.New(sha256.New, secretKey)
	dataMac.Write([]byte(dataCheckString))
	calculatedHash := hex.EncodeToString(dataMac.Sum(nil))

	// 5. Compare hashes securely
	if !hmac.Equal([]byte(calculatedHash), []byte(hash)) {
		return nil, errors.New("telegram signature verification failed: hash mismatch")
	}

	return &AuthData{
		User:        tgUser,
		AuthDate:    authDate,
		QueryID:     queryID,
		StartParam:  startParam,
		Hash:        hash,
		RawInitData: initDataRaw,
	}, nil
}
