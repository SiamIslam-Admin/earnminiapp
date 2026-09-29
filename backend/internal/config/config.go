package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort             string
	AppEnv              string
	DatabaseURL         string
	DBMaxConns          int32
	DBMinConns          int32
	DBMaxConnLifetime   time.Duration
	DBMaxConnIdleTime   time.Duration
	RedisURL            string
	JWTSecret           string
	JWTExpirationHours  int
	TelegramBotToken    string
	TelegramChannelID   string
	MiniAppURL          string
	ServerBaseURL       string // e.g. "https://api.yourdomain.com" or ngrok URL for automatic setWebhook
	RateLimitRequests   int
	RateLimitWindowSecs int

	// BSC (BEP-20) & Alchemy Configurations
	AlchemyAPIKey       string
	AlchemyNotifyToken  string
	AlchemyWebhookID    string
	AlchemySigningKey   string
	BscRPCURL           string
	BscChainID          int64
	UsdtContractAddress string
	AdminPrivateKey     string // Hex private key of master funding/payout wallet
	AdminMasterAddress  string
	AdminSecretKey      string // X-Admin-Secret header for admin panel
	AdminTelegramIDs    []int64
	EnableMockSeeds     bool // Toggle for demo placeholder leaderboard competitor seeds
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] No .env file found or error loading, reading system environment variables")
	}

	alchemyKey := getEnv("ALCHEMY_API_KEY", "")
	rpcURL := getEnv("BSC_RPC_URL", "")
	if rpcURL == "" {
		if alchemyKey != "" {
			rpcURL = fmt.Sprintf("https://bnb-mainnet.g.alchemy.com/v2/%s", alchemyKey)
		} else {
			rpcURL = "https://bsc-dataseed.binance.org"
		}
	}

	return &Config{
		AppPort:             getEnv("PORT", "3000"),
		AppEnv:              getEnv("APP_ENV", "production"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://postgres:postgrespassword@localhost:5432/earnminiapp?sslmode=disable"),
		DBMaxConns:          int32(getEnvInt("DB_MAX_CONNS", 30)),
		DBMinConns:          int32(getEnvInt("DB_MIN_CONNS", 5)),
		DBMaxConnLifetime:   time.Duration(getEnvInt("DB_MAX_CONN_LIFETIME_MINS", 30)) * time.Minute,
		DBMaxConnIdleTime:   time.Duration(getEnvInt("DB_MAX_CONN_IDLE_MINS", 5)) * time.Minute,
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:           getEnv("JWT_SECRET", "super-secret-telegram-earn-mini-app-jwt-key-2026"),
		JWTExpirationHours:  getEnvInt("JWT_EXPIRATION_HOURS", 72),
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", "8763962342:AAHeDJUQeXLp5XhXWwrrs8i6q7gmhMpL0iA"),
		TelegramChannelID:   getEnv("TELEGRAM_CHANNEL_ID", "@SpinCraftCommunity"),
		MiniAppURL:          getEnv("MINI_APP_URL", "https://t.me/SpinCraft_bot/earnnow"),
		ServerBaseURL:       getEnv("SERVER_BASE_URL", getEnv("WEBHOOK_BASE_URL", "")),
		RateLimitRequests:   getEnvInt("RATE_LIMIT_REQUESTS", 1000),
		RateLimitWindowSecs: getEnvInt("RATE_LIMIT_WINDOW_SECS", 60),

		// BSC & Alchemy Settings
		AlchemyAPIKey:       alchemyKey,
		AlchemyNotifyToken:  getEnv("ALCHEMY_NOTIFY_TOKEN", ""),
		AlchemyWebhookID:    getEnv("ALCHEMY_WEBHOOK_ID", ""),
		AlchemySigningKey:   getEnv("ALCHEMY_SIGNING_KEY", ""),
		BscRPCURL:           rpcURL,
		BscChainID:          int64(getEnvInt("BSC_CHAIN_ID", 56)),
		UsdtContractAddress: getEnv("USDT_BEP20_CONTRACT", "0x55d398326f99059fF775485246999027B3197955"),
		AdminPrivateKey:     getEnv("ADMIN_MASTER_PRIVATE_KEY", ""),
		AdminMasterAddress:  getEnv("ADMIN_MASTER_ADDRESS", ""),
		AdminSecretKey:      getEnv("ADMIN_SECRET_KEY", "super-admin-secret-key-2026"),
		AdminTelegramIDs:    parseTelegramIDs(getEnvOr("ADMIN_TELEGRAM_IDS", getEnv("ADMIN_TELEGRAM_ID", ""))),
		EnableMockSeeds:     getEnv("ENABLE_MOCK_SEEDS", "false") == "true",
	}
}

func getEnvOr(key, fallback string) string {
	val := getEnv(key, "")
	if val == "" {
		return fallback
	}
	return val
}

func (c *Config) IsAdminTelegramID(tgID int64) bool {
	for _, id := range c.AdminTelegramIDs {
		if id == tgID {
			return true
		}
	}
	return false
}

func parseTelegramIDs(raw string) []int64 {
	var ids []int64
	if raw == "" {
		return ids
	}
	parts := strings.Split(raw, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if val, err := strconv.ParseInt(p, 10, 64); err == nil {
			ids = append(ids, val)
		}
	}
	return ids
}

// IsAdmin checks if a telegram user ID is registered as an admin
func (c *Config) IsAdmin(telegramID int64) bool {
	if c == nil {
		return false
	}
	for _, id := range c.AdminTelegramIDs {
		if id == telegramID {
			return true
		}
	}
	return false
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}
