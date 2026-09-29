package service_test

import (
	"testing"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/config"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/jwt"
)

func TestAdminGenerateSeedPhraseAndDeriveMasterWallet(t *testing.T) {
	cfg := &config.Config{
		AdminSecretKey:     "secret-admin-pass",
		JWTSecret:          "jwt-secret-12345",
		JWTExpirationHours: 24,
		BscChainID:         56,
	}

	bscClient := bsc.NewBSCClient(cfg)
	jwtManager := jwt.NewJWTManager(cfg.JWTSecret, cfg.JWTExpirationHours)
	adminService := service.NewAdminService(cfg, nil, bscClient, jwtManager)

	// 1. Authenticate with valid secret
	authResp, err := adminService.AuthenticateAdmin("secret-admin-pass")
	if err != nil {
		t.Fatalf("Expected valid authentication, got error: %v", err)
	}
	if authResp.Token == "" {
		t.Fatal("Expected admin session token")
	}

	// 2. Authenticate with invalid secret
	_, err = adminService.AuthenticateAdmin("wrong-pass")
	if err == nil {
		t.Fatal("Expected authentication error for wrong secret, got nil")
	}

	// 3. Generate 12-word seed phrase
	mnemonic, err := bscClient.GenerateMnemonic()
	if err != nil {
		t.Fatalf("GenerateMnemonic failed: %v", err)
	}
	if mnemonic == "" {
		t.Fatal("Mnemonic is empty")
	}

	// 4. Derive Master Wallet (index 0)
	addr0, privKey0, err := bscClient.DeriveChildWallet(mnemonic, 0)
	if err != nil {
		t.Fatalf("DeriveChildWallet failed: %v", err)
	}
	if addr0 == "" || privKey0 == nil {
		t.Fatal("Derived wallet address or private key is nil")
	}

	// 5. Derive Child Wallet (index 1) for an invoice
	addr1, privKey1, err := bscClient.DeriveChildWallet(mnemonic, 1)
	if err != nil {
		t.Fatalf("DeriveChildWallet index 1 failed: %v", err)
	}
	if addr1 == addr0 {
		t.Fatal("Expected distinct addresses for index 0 and index 1")
	}
	if privKey1 == nil {
		t.Fatal("Expected private key for index 1")
	}
}

func TestPayoutSettingsDefaults(t *testing.T) {
	cfg := &config.Config{
		AdminSecretKey: "secret",
		JWTSecret:      "jwtsecret",
	}
	adminService := service.NewAdminService(cfg, nil, nil, nil)
	settings, err := adminService.GetPayoutSettings(nil)
	if err != nil {
		t.Fatalf("GetPayoutSettings failed: %v", err)
	}
	if settings.PayoutMode != "manual" {
		t.Errorf("Expected default payout_mode to be 'manual', got '%s'", settings.PayoutMode)
	}
	if settings.FeePercentage != 2.0 {
		t.Errorf("Expected default fee to be 2.0, got %f", settings.FeePercentage)
	}
}
