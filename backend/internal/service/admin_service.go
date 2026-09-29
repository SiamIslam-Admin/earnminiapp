package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/pkg/jwt"

	"github.com/ethereum/go-ethereum/common"
)

type AdminService struct {
	cfg          *config.Config
	settingsRepo *repository.SystemSettingsRepository
	bscClient    *bsc.BSCClient
	jwtManager   *jwt.JWTManager
}

func NewAdminService(
	cfg *config.Config,
	settingsRepo *repository.SystemSettingsRepository,
	bscClient *bsc.BSCClient,
	jwtManager *jwt.JWTManager,
) *AdminService {
	return &AdminService{
		cfg:          cfg,
		settingsRepo: settingsRepo,
		bscClient:    bscClient,
		jwtManager:   jwtManager,
	}
}

// AuthenticateAdmin validates admin secret passphrase
func (s *AdminService) AuthenticateAdmin(secretKey string) (*model.AdminAuthResponse, error) {
	if secretKey == "" || secretKey != s.cfg.AdminSecretKey {
		return nil, errors.New("invalid admin secret key")
	}

	token, err := s.jwtManager.GenerateToken(999999999, 999999999, "admin")
	if err != nil {
		return nil, fmt.Errorf("failed to issue admin session: %w", err)
	}

	return &model.AdminAuthResponse{
		Token:     token,
		ExpiresIn: s.cfg.JWTExpirationHours * 3600,
	}, nil
}

// GetWalletStatus returns master wallet balance and state
func (s *AdminService) GetWalletStatus(ctx context.Context) (*model.AdminWalletStatusResponse, error) {
	isInitStr, _ := s.settingsRepo.Get(ctx, "is_vault_initialized")
	isInit := isInitStr == "true" || s.bscClient.IsReady()

	masterAddr := s.bscClient.GetMasterAddress()

	if !s.bscClient.IsReady() {
		// Attempt to load from database
		dbMnemonic, _ := s.settingsRepo.Get(ctx, "master_mnemonic")
		dbPrivKey, _ := s.settingsRepo.Get(ctx, "master_private_key")

		if dbMnemonic != "" {
			addr, err := s.bscClient.SetMnemonic(dbMnemonic)
			if err == nil {
				masterAddr = addr
				isInit = true
			}
		} else if dbPrivKey != "" {
			err := s.bscClient.SetPrivateKey(dbPrivKey)
			if err == nil {
				masterAddr = s.bscClient.GetMasterAddress()
				isInit = true
			}
		}
	}

	bnbBal := 0.0
	usdtBal := 0.0

	if isInit && masterAddr != "" && masterAddr != "0x0000000000000000000000000000000000000000" {
		bnbBal, _ = s.bscClient.GetBnbBalance(ctx, masterAddr)
		usdtBal, _ = s.bscClient.GetUsdtBalance(ctx, masterAddr)
	}

	return &model.AdminWalletStatusResponse{
		IsInitialized:    isInit,
		MasterAddress:    masterAddr,
		BnbBalance:       bnbBal,
		UsdtBalance:      usdtBal,
		UsdtContract:     s.cfg.UsdtContractAddress,
		Network:          "Binance Smart Chain (BSC Mainnet)",
		ChainID:          s.cfg.BscChainID,
		LowBnbGasWarning: bnbBal < 0.01,
		IsPayoutReady:    isInit,
	}, nil
}

// GenerateMasterWallet creates a fresh 12-word BIP-39 mnemonic seed phrase and derives keys
func (s *AdminService) GenerateMasterWallet(ctx context.Context) (*model.GenerateWalletResponse, error) {
	mnemonic, err := s.bscClient.GenerateMnemonic()
	if err != nil {
		return nil, fmt.Errorf("failed to generate seed phrase: %w", err)
	}

	masterAddr, err := s.bscClient.SetMnemonic(mnemonic)
	if err != nil {
		return nil, fmt.Errorf("failed to derive master wallet: %w", err)
	}

	privKeyHex := s.bscClient.GetMasterPrivateKeyHex()

	// Persist in system settings
	_ = s.settingsRepo.Set(ctx, "master_mnemonic", mnemonic)
	_ = s.settingsRepo.Set(ctx, "master_private_key", privKeyHex)
	_ = s.settingsRepo.Set(ctx, "master_address", masterAddr)
	_ = s.settingsRepo.Set(ctx, "is_vault_initialized", "true")

	return &model.GenerateWalletResponse{
		MasterAddress:  masterAddr,
		SeedPhrase:     mnemonic,
		PrivateKey:     "0x" + privKeyHex,
		DerivationPath: "m/44'/60'/0'/0/0",
		Notice:         "IMPORTANT: Write down and securely store your 12-word seed phrase and private key. Download your backup file before closing this modal.",
	}, nil
}

// ImportMasterWallet imports an existing seed phrase or hex private key
func (s *AdminService) ImportMasterWallet(ctx context.Context, req *model.ImportWalletRequest) (string, error) {
	if req.SeedPhrase != "" {
		addr, err := s.bscClient.SetMnemonic(req.SeedPhrase)
		if err != nil {
			return "", fmt.Errorf("invalid seed phrase: %w", err)
		}
		privKeyHex := s.bscClient.GetMasterPrivateKeyHex()

		_ = s.settingsRepo.Set(ctx, "master_mnemonic", req.SeedPhrase)
		_ = s.settingsRepo.Set(ctx, "master_private_key", privKeyHex)
		_ = s.settingsRepo.Set(ctx, "master_address", addr)
		_ = s.settingsRepo.Set(ctx, "is_vault_initialized", "true")
		return addr, nil
	}

	if req.PrivateKey != "" {
		if err := s.bscClient.SetPrivateKey(req.PrivateKey); err != nil {
			return "", err
		}
		masterAddr := s.bscClient.GetMasterAddress()
		_ = s.settingsRepo.Set(ctx, "master_private_key", req.PrivateKey)
		_ = s.settingsRepo.Set(ctx, "master_address", masterAddr)
		_ = s.settingsRepo.Set(ctx, "is_vault_initialized", "true")
		return masterAddr, nil
	}

	return "", errors.New("either seed_phrase or private_key must be provided")
}

// ConfirmVaultInitialization marks the vault as officially initialized in DB
func (s *AdminService) ConfirmVaultInitialization(ctx context.Context) error {
	return s.settingsRepo.Set(ctx, "is_vault_initialized", "true")
}

// ExportVaultSecrets retrieves the full secret backup package for the master vault
func (s *AdminService) ExportVaultSecrets(ctx context.Context) (*model.VaultSecretsResponse, error) {
	masterAddr := s.bscClient.GetMasterAddress()
	mnemonic := s.bscClient.GetMasterMnemonic()
	privKey := s.bscClient.GetMasterPrivateKeyHex()

	if mnemonic == "" {
		mnemonic, _ = s.settingsRepo.Get(ctx, "master_mnemonic")
	}
	if privKey == "" {
		privKey, _ = s.settingsRepo.Get(ctx, "master_private_key")
	}
	if masterAddr == "" {
		masterAddr, _ = s.settingsRepo.Get(ctx, "master_address")
	}

	if masterAddr == "" {
		return nil, errors.New("master vault is not configured")
	}

	if privKey != "" {
		if !strings.HasPrefix(privKey, "0x") {
			privKey = "0x" + privKey
		}
	}

	return &model.VaultSecretsResponse{
		MasterAddress:  masterAddr,
		SeedPhrase:     mnemonic,
		PrivateKey:     privKey,
		DerivationPath: "m/44'/60'/0'/0/0",
		Network:        "Binance Smart Chain (BSC Mainnet)",
		ChainID:        s.cfg.BscChainID,
		UsdtContract:   s.cfg.UsdtContractAddress,
		ExportedAt:     time.Now().UTC().Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

// GetPayoutSettings retrieves current payout mode and rules
func (s *AdminService) GetPayoutSettings(ctx context.Context) (*model.PayoutSettings, error) {
	payoutMode := "manual"
	minWithdrawal := 0.00
	feePercent := 2.0
	instantMaxUSD := 50.00

	if s.settingsRepo != nil {
		if val, _ := s.settingsRepo.Get(ctx, "payout_mode"); val != "" {
			payoutMode = val
		}
		if val, _ := s.settingsRepo.Get(ctx, "min_withdraw_usd"); val != "" {
			if f, err := strconv.ParseFloat(val, 64); err == nil && f >= 0 {
				minWithdrawal = f
			}
		} else if val, _ := s.settingsRepo.Get(ctx, "min_withdrawal_usd"); val != "" {
			if f, err := strconv.ParseFloat(val, 64); err == nil && f >= 0 {
				minWithdrawal = f
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "fee_percent"); val != "" {
			if f, err := strconv.ParseFloat(val, 64); err == nil && f >= 0 {
				feePercent = f
			}
		} else if val, _ := s.settingsRepo.Get(ctx, "payout_fee_percent"); val != "" {
			if f, err := strconv.ParseFloat(val, 64); err == nil && f >= 0 {
				feePercent = f
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "instant_payout_max_usd"); val != "" {
			if f, err := strconv.ParseFloat(val, 64); err == nil && f >= 0 {
				instantMaxUSD = f
			}
		}
	}

	return &model.PayoutSettings{
		PayoutMode:          payoutMode,
		MinWithdrawalUSD:    minWithdrawal,
		FeePercentage:       feePercent,
		InstantPayoutMaxUSD: instantMaxUSD,
	}, nil
}

// UpdatePayoutSettings modifies payout mode and rules
func (s *AdminService) UpdatePayoutSettings(ctx context.Context, req *model.UpdatePayoutSettingsRequest) (*model.PayoutSettings, error) {
	if s.settingsRepo == nil {
		return nil, errors.New("system settings repository not available")
	}

	if req.PayoutMode != "" {
		if req.PayoutMode != "manual" && req.PayoutMode != "instant" {
			return nil, errors.New("payout_mode must be either 'manual' or 'instant'")
		}
		_ = s.settingsRepo.Set(ctx, "payout_mode", req.PayoutMode)
	}

	if req.MinWithdrawalUSD != nil && *req.MinWithdrawalUSD >= 0 {
		formatted := fmt.Sprintf("%.2f", *req.MinWithdrawalUSD)
		_ = s.settingsRepo.Set(ctx, "min_withdrawal_usd", formatted)
		_ = s.settingsRepo.Set(ctx, "min_withdraw_usd", formatted)
	}

	if req.FeePercentage != nil && *req.FeePercentage >= 0 {
		formatted := fmt.Sprintf("%.2f", *req.FeePercentage)
		_ = s.settingsRepo.Set(ctx, "payout_fee_percent", formatted)
		_ = s.settingsRepo.Set(ctx, "fee_percent", formatted)
	}

	if req.InstantPayoutMaxUSD != nil && *req.InstantPayoutMaxUSD >= 0 {
		_ = s.settingsRepo.Set(ctx, "instant_payout_max_usd", fmt.Sprintf("%.2f", *req.InstantPayoutMaxUSD))
	}

	return s.GetPayoutSettings(ctx)
}

// TransferVaultFunds transfers USDT or BNB from Master Vault to any external BSC address
func (s *AdminService) TransferVaultFunds(ctx context.Context, req model.VaultTransferRequest) (*model.VaultTransferResponse, error) {
	if s.bscClient == nil {
		return nil, errors.New("blockchain client is not available")
	}

	asset := strings.ToLower(strings.TrimSpace(req.Asset))
	if asset != "usdt" && asset != "bnb" {
		return nil, errors.New("invalid asset type: must be 'usdt' or 'bnb'")
	}

	recipient := strings.TrimSpace(req.RecipientAddress)
	if !common.IsHexAddress(recipient) {
		return nil, fmt.Errorf("invalid recipient BSC address: %s", recipient)
	}

	if req.Amount <= 0 {
		return nil, errors.New("transfer amount must be greater than 0")
	}

	masterAddr := s.bscClient.GetMasterAddress()
	if masterAddr == "" {
		return nil, errors.New("master vault is not initialized")
	}

	var txHash string
	var err error

	if asset == "usdt" {
		usdtBal, balErr := s.bscClient.GetUsdtBalance(ctx, masterAddr)
		if balErr == nil && usdtBal < req.Amount {
			return nil, fmt.Errorf("insufficient USDT in Master Vault: available $%.2f, requested $%.2f", usdtBal, req.Amount)
		}
		txHash, err = s.bscClient.SendUsdtPayout(ctx, recipient, req.Amount)
	} else {
		bnbBal, balErr := s.bscClient.GetBnbBalance(ctx, masterAddr)
		if balErr == nil && bnbBal < req.Amount {
			return nil, fmt.Errorf("insufficient BNB in Master Vault: available %.6f BNB, requested %.6f BNB", bnbBal, req.Amount)
		}
		txHash, err = s.bscClient.SendBnbPayout(ctx, recipient, req.Amount)
	}

	if err != nil {
		return nil, fmt.Errorf("on-chain transfer failed: %w", err)
	}

	explorerURL := fmt.Sprintf("https://bscscan.com/tx/%s", txHash)

	return &model.VaultTransferResponse{
		TxHash:           txHash,
		Asset:            strings.ToUpper(asset),
		Amount:           req.Amount,
		RecipientAddress: recipient,
		ExplorerURL:      explorerURL,
		TransferredAt:    time.Now().UTC().Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}
