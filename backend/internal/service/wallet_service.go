package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/pkg/util"
)

type WalletService struct {
	userRepo     *repository.UserRepository
	walletRepo   *repository.WalletRepository
	txRepo       *repository.TransactionRepository
	settingsRepo *repository.SystemSettingsRepository
	bscClient    *bsc.BSCClient
}

func NewWalletService(
	userRepo *repository.UserRepository,
	walletRepo *repository.WalletRepository,
	txRepo *repository.TransactionRepository,
	settingsRepo *repository.SystemSettingsRepository,
	bscClient *bsc.BSCClient,
) *WalletService {
	return &WalletService{
		userRepo:     userRepo,
		walletRepo:   walletRepo,
		txRepo:       txRepo,
		settingsRepo: settingsRepo,
		bscClient:    bscClient,
	}
}

func (s *WalletService) BindWallet(ctx context.Context, userID int64, address string) (*model.UserResponse, error) {
	if address == "" {
		return nil, errors.New("wallet address is required")
	}

	updatedUser, err := s.userRepo.UpdateTONWallet(ctx, userID, address)
	if err != nil {
		return nil, fmt.Errorf("failed to bind wallet: %w", err)
	}

	resp := ToUserResponse(updatedUser)
	return &resp, nil
}

func (s *WalletService) GetWalletInfo(ctx context.Context, userID int64) (*model.WalletInfoResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	payoutMode := "manual"
	minWithdrawal := 0.00
	feePercent := 2.0

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
	}

	records, _ := s.GetRecords(ctx, userID, "all", 10, 0)

	return &model.WalletInfoResponse{
		AvailableBalanceUSD: user.BalanceUSD,
		Connected:           user.TONWallet != "",
		TONWalletAddress:    user.TONWallet,
		PresetAmounts:       []float64{1.00, 2.50, 5.00, 10.00},
		GasFeePercent:       feePercent,
		PayoutMode:          payoutMode,
		MinWithdrawalUSD:    minWithdrawal,
		RecentTransactions:  records,
	}, nil
}

func (s *WalletService) SubmitWithdrawal(ctx context.Context, userID int64, amountUSD float64) (*model.WithdrawResponse, error) {
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
			if f, err := strconv.ParseFloat(val, 64); err == nil && f > 0 {
				instantMaxUSD = f
			}
		}
	}

	if amountUSD <= 0 {
		return nil, errors.New("withdrawal amount must be greater than $0.00")
	}
	if minWithdrawal > 0 && amountUSD < minWithdrawal {
		return nil, fmt.Errorf("minimum withdrawal amount is $%.2f USDT", minWithdrawal)
	}

	if s.userRepo == nil {
		return nil, errors.New("user repository unavailable")
	}
	if s.walletRepo == nil {
		return nil, errors.New("wallet repository unavailable")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if user.TONWallet == "" {
		return nil, errors.New("please connect your BEP-20 wallet before requesting withdrawal")
	}

	if user.BalanceUSD < amountUSD {
		return nil, fmt.Errorf("insufficient balance ($%.2f available, $%.2f requested)", user.BalanceUSD, amountUSD)
	}

	feeUSD := amountUSD * (feePercent / 100.0)
	netPayoutUSD := amountUSD - feeUSD

	// 1. Deduct balance atomically with strict conditional check
	updatedUser, err := s.userRepo.DeductUSDBalance(ctx, userID, amountUSD)
	if err != nil {
		return nil, fmt.Errorf("insufficient balance: %w", err)
	}

	txID := util.GenerateTXID("WTH")
	status := "processing"
	hashRaw := sha256.Sum256([]byte(fmt.Sprintf("%d-%s-%f", userID, txID, amountUSD)))
	txHash := "0x" + hex.EncodeToString(hashRaw[:])[:14] + "...bsc"
	bscScanURL := ""
	message := "Withdrawal request submitted for review"
	notes := ""

	// 2. Insert withdrawal record into database with status 'processing' BEFORE dispatching on-chain transactions
	dbWithdrawal := &repository.DBWithdrawal{
		UserID:       userID,
		AmountUSD:    amountUSD,
		FeeUSD:       feeUSD,
		NetPayoutUSD: netPayoutUSD,
		TONAddress:   user.TONWallet,
		Status:       status,
		ReferenceID:  txID,
		TxHash:       txHash,
		Notes:        notes,
	}

	if err := s.walletRepo.CreateWithdrawal(ctx, dbWithdrawal); err != nil {
		_, _ = s.userRepo.MutateBalances(ctx, userID, 0, 0, amountUSD, 0)
		return nil, fmt.Errorf("failed to create withdrawal record: %w", err)
	}

	// 3. Ledger entry in transactions table
	if s.txRepo != nil {
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:      userID,
			Category:    "withdrawals",
			Title:       "USDT (BEP-20) Withdrawal",
			AmountUSD:   -amountUSD,
			Status:      status,
			ReferenceID: txID,
			TxHash:      txHash,
			Description: fmt.Sprintf("Net Payout: $%.2f USDT (%.1f%% Fee: $%.2f)", netPayoutUSD, feePercent, feeUSD),
		})
	}

	// 4. If Instant Automated Mode is enabled, dispatch on-chain transaction
	if payoutMode == "instant" && amountUSD <= instantMaxUSD && s.bscClient != nil && s.bscClient.IsReady() {
		onChainHash, onChainErr := s.bscClient.SendUsdtPayout(ctx, user.TONWallet, netPayoutUSD)
		if onChainErr == nil && onChainHash != "" {
			status = "completed"
			txHash = onChainHash
			bscScanURL = fmt.Sprintf("https://bscscan.com/tx/%s", txHash)
			message = "Withdrawal instantly processed and broadcasted to BSC Mainnet!"
			_ = s.walletRepo.UpdateWithdrawalStatus(ctx, dbWithdrawal.ID, "completed", txHash, "Paid via Instant Auto-Payout")
			if s.txRepo != nil {
				_ = s.txRepo.UpdateStatus(ctx, txID, "completed", txHash)
			}
		} else {
			// On-chain dispatch failed: mark withdrawal status 'failed' and refund user balance safely without double-refund loop
			status = "failed"
			notes = fmt.Sprintf("Instant on-chain dispatch failed: %v", onChainErr)
			message = "Instant on-chain payout failed. Funds refunded to balance."
			_ = s.walletRepo.UpdateWithdrawalStatus(ctx, dbWithdrawal.ID, "failed", "", notes)
			if s.txRepo != nil {
				_ = s.txRepo.UpdateStatus(ctx, txID, "failed", "")
			}
			refundedUser, errRef := s.userRepo.MutateBalances(ctx, userID, 0, 0, amountUSD, 0)
			if errRef == nil && refundedUser != nil {
				updatedUser = refundedUser
			}
		}
	}

	userResp := ToUserResponse(updatedUser)
	return &model.WithdrawResponse{
		WithdrawalID: fmt.Sprintf("%d", dbWithdrawal.ID),
		AmountUSD:    amountUSD,
		FeeUSD:       feeUSD,
		NetPayoutUSD: netPayoutUSD,
		TONAddress:   user.TONWallet,
		Status:       status,
		TxID:         txID,
		TxHash:       txHash,
		BscScanURL:   bscScanURL,
		Message:      message,
		UserBalance:  userResp,
		User:         &userResp,
	}, nil
}

func (s *WalletService) GetRecords(ctx context.Context, userID int64, category string, limit, offset int) ([]model.TransactionRecordResponse, error) {
	if limit <= 0 {
		limit = 30
	}

	txs, err := s.txRepo.GetUserTransactions(ctx, userID, category, limit, offset)
	if err != nil {
		return nil, err
	}

	var records []model.TransactionRecordResponse
	for _, t := range txs {
		amountStr := ""
		isDiamond := false

		if t.AmountUSD != 0 {
			if t.AmountUSD > 0 {
				amountStr = fmt.Sprintf("+$%.2f", t.AmountUSD)
			} else {
				amountStr = fmt.Sprintf("-$%.2f", -t.AmountUSD)
			}
		} else if t.AmountDiamonds != 0 {
			isDiamond = true
			if t.AmountDiamonds > 0 {
				amountStr = fmt.Sprintf("+%d", t.AmountDiamonds)
			} else {
				amountStr = fmt.Sprintf("-%d", -t.AmountDiamonds)
			}
		} else if t.AmountSpins != 0 {
			amountStr = fmt.Sprintf("+%d Spins", t.AmountSpins)
		} else if t.AmountTickets != 0 {
			amountStr = fmt.Sprintf("+%d Tickets", t.AmountTickets)
		}

		icon := "💎"
		isImageIcon := false
		switch t.Category {
		case "spin", "spins":
			icon = "🎡"
		case "daily_reward":
			icon = "📅"
		case "referral", "referrals":
			icon = "👥"
		case "raffle", "raffles":
			icon = "🎟️"
		case "task", "tasks":
			icon = "📋"
		case "withdrawals", "withdrawal":
			icon = "💸"
		case "deposits", "deposit":
			icon = "💰"
		case "gift_code":
			icon = "🎁"
		}

		records = append(records, model.TransactionRecordResponse{
			ID:          fmt.Sprintf("%d", t.ID),
			Title:       t.Title,
			Category:    t.Category,
			Date:        t.CreatedAt.UTC().Format("2006-01-02 15:04"),
			TxID:        t.ReferenceID,
			Icon:        icon,
			IsImageIcon: isImageIcon,
			Amount:      amountStr,
			IsDiamond:   isDiamond,
			Status:      t.Status,
			Hash:        t.TxHash,
		})
	}

	return records, nil
}
