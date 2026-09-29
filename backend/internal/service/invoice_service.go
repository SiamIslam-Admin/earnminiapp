package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/big"
	"math/rand"
	"strconv"
	"time"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
)

type InvoiceService struct {
	userRepo     *repository.UserRepository
	invoiceRepo  *repository.InvoiceRepository
	raffleRepo   *repository.RaffleRepository
	txRepo       *repository.TransactionRepository
	settingsRepo *repository.SystemSettingsRepository
	bscClient    *bsc.BSCClient
}

func NewInvoiceService(
	userRepo *repository.UserRepository,
	invoiceRepo *repository.InvoiceRepository,
	raffleRepo *repository.RaffleRepository,
	txRepo *repository.TransactionRepository,
	settingsRepo *repository.SystemSettingsRepository,
	bscClient *bsc.BSCClient,
) *InvoiceService {
	return &InvoiceService{
		userRepo:     userRepo,
		invoiceRepo:  invoiceRepo,
		raffleRepo:   raffleRepo,
		txRepo:       txRepo,
		settingsRepo: settingsRepo,
		bscClient:    bscClient,
	}
}

// CreateCryptoInvoice generates a unique HD wallet address for user deposit
func (s *InvoiceService) CreateCryptoInvoice(ctx context.Context, userID int64, req *model.CreateInvoiceRequest) (*model.InvoiceResponse, error) {
	minDeposit := 0.00
	if s.settingsRepo != nil {
		if val, err := s.settingsRepo.Get(ctx, "min_deposit_usd"); err == nil && val != "" {
			if v, err := strconv.ParseFloat(val, 64); err == nil && v >= 0 {
				minDeposit = v
			}
		}
	}

	// For general wallet deposits, enforce configured minDeposit (if > 0).
	// For raffle ticket purchases or direct purchases, allow valid positive amount
	if req.Purpose == "raffle_tickets" {
		if req.AmountUSD <= 0 {
			return nil, errors.New("invalid raffle ticket purchase amount")
		}
	} else {
		if req.AmountUSD <= 0 {
			return nil, errors.New("deposit amount must be greater than $0.00")
		}
		if minDeposit > 0 && req.AmountUSD < minDeposit {
			return nil, fmt.Errorf("minimum deposit amount is $%.2f USDT", minDeposit)
		}
	}

	mnemonic := s.bscClient.GetMasterMnemonic()
	if mnemonic == "" {
		dbMnemonic, _ := s.settingsRepo.Get(ctx, "master_mnemonic")
		if dbMnemonic != "" {
			_, _ = s.bscClient.SetMnemonic(dbMnemonic)
			mnemonic = dbMnemonic
		}
	}

	walletIndex, err := s.invoiceRepo.GetNextWalletIndex(ctx)
	if err != nil {
		walletIndex = int64(rand.Intn(100000) + 1)
	}

	var depositAddress string
	if mnemonic != "" {
		addr, childPrivKey, err := s.bscClient.DeriveChildWallet(mnemonic, walletIndex)
		if err == nil {
			depositAddress = addr
			bsc.SaveTemporaryDepositAddressToBackup(fmt.Sprintf("INV-%d-%d", userID, time.Now().UnixNano()/1e6), userID, walletIndex, depositAddress, childPrivKey, req.AmountUSD)
		}
	}

	if depositAddress == "" {
		masterAddr := s.bscClient.GetMasterAddress()
		if masterAddr != "" && masterAddr != "0x0000000000000000000000000000000000000000" {
			depositAddress = masterAddr
		} else {
			depositAddress = "0x58c679f291079d3E01a6132712217c4618e7E1d2"
		}
	}

	invoiceID := fmt.Sprintf("INV-%d-%d", userID, time.Now().UnixNano()/1e6)
	expiresAt := time.Now().Add(20 * time.Minute)

	dbInv := &model.Invoice{
		InvoiceID:      invoiceID,
		UserID:         userID,
		WalletIndex:    walletIndex,
		DepositAddress: depositAddress,
		AmountUSD:      req.AmountUSD,
		Purpose:        req.Purpose,
		ReferenceID:    req.RaffleID,
		Status:         "pending",
		SweepStatus:    "unclaimed",
		ExpiresAt:      expiresAt,
	}

	if err := s.invoiceRepo.Create(ctx, dbInv); err != nil {
		return nil, fmt.Errorf("failed to create invoice record: %w", err)
	}

	// Register child deposit address with Alchemy Address Activity Webhook for instant push notifications
	_ = s.bscClient.AddAddressToAlchemyWebhook(ctx, depositAddress)

	qrData := fmt.Sprintf("ethereum:%s@56/transfer?address=0x55d398326f99059fF775485246999027B3197955&uint256=%de18",
		depositAddress, int(req.AmountUSD))

	return &model.InvoiceResponse{
		InvoiceID:      invoiceID,
		DepositAddress: depositAddress,
		AmountUSD:      req.AmountUSD,
		AmountUSDT:     fmt.Sprintf("%.2f USDT", req.AmountUSD),
		Purpose:        req.Purpose,
		Status:         "pending",
		Network:        "Binance Smart Chain (BEP-20)",
		ExpiresAt:      expiresAt.UnixMilli(),
		QRCodeData:     qrData,
	}, nil
}

// FulfillPaidInvoice delivers digital goods / diamonds / raffle tickets to user
func (s *InvoiceService) FulfillPaidInvoice(ctx context.Context, invoiceID, txHash string) error {
	inv, err := s.invoiceRepo.GetByInvoiceID(ctx, invoiceID)
	if err != nil || inv == nil {
		return errors.New("invoice not found")
	}

	if inv.Status == "paid" {
		return nil // Already fulfilled
	}

	// Mark paid in repository
	if err := s.invoiceRepo.MarkPaid(ctx, invoiceID, txHash); err != nil {
		return err
	}

	// Calculate platform fee from settings (default 2%) and net credit
	feePercent := 2.0
	if s.settingsRepo != nil {
		if val, err := s.settingsRepo.Get(ctx, "fee_percent"); err == nil && val != "" {
			if v, err := strconv.ParseFloat(val, 64); err == nil && v >= 0 {
				feePercent = v
			}
		}
	}
	feeUSD := inv.AmountUSD * (feePercent / 100.0)
	netUSD := inv.AmountUSD - feeUSD

	// Deliver reward based on purpose
	switch inv.Purpose {
	case "raffle_tickets":
		tickets := 1
		raffle, _ := s.raffleRepo.GetRaffleByID(ctx, inv.ReferenceID)
		if raffle != nil && raffle.TicketPriceUSD > 0 {
			tickets = int((inv.AmountUSD + 0.001) / raffle.TicketPriceUSD)
		} else {
			tickets = int((inv.AmountUSD + 0.001) / 0.50)
		}
		if tickets < 1 {
			tickets = 1
		}
		_ = s.raffleRepo.AddTicketsWithDetails(ctx, inv.ReferenceID, inv.UserID, tickets, "usdt", "usdt", txHash)
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:        inv.UserID,
			Category:      "raffles",
			Title:         fmt.Sprintf("Raffle Tickets (%s)", inv.ReferenceID),
			AmountTickets: tickets,
			Status:        "completed",
			ReferenceID:   invoiceID,
			TxHash:        txHash,
			Description:   fmt.Sprintf("+%d Tickets (Gross $%.2f, 2%% Fee: $%.2f)", tickets, inv.AmountUSD, feeUSD),
		})

	case "balance":
		_, _ = s.userRepo.MutateBalances(ctx, inv.UserID, 0, 0, netUSD, 0)
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:      inv.UserID,
			Category:    "deposit",
			Title:       "USDT BEP-20 Cash Deposit",
			AmountUSD:   netUSD,
			Status:      "completed",
			ReferenceID: invoiceID,
			TxHash:      txHash,
			Description: fmt.Sprintf("+$%.2f USDT (Gross: $%.2f, 2%% Fee: $%.2f)", netUSD, inv.AmountUSD, feeUSD),
		})

	default: // "diamonds"
		diamonds := int64(netUSD * 1000)
		_, _ = s.userRepo.MutateBalances(ctx, inv.UserID, 0, diamonds, 0, 0)
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:         inv.UserID,
			Category:       "deposit",
			Title:          "USDT BEP-20 Deposit",
			AmountDiamonds: diamonds,
			Status:         "completed",
			ReferenceID:    invoiceID,
			TxHash:         txHash,
			Description:    fmt.Sprintf("+%d 💎 (Gross $%.2f, 2%% Fee: $%.2f)", diamonds, inv.AmountUSD, feeUSD),
		})
	}

	log.Printf("[INFO] Successfully fulfilled invoice %s for User %d (Gross: $%.2f, Fee: $%.2f, TxHash: %s)",
		invoiceID, inv.UserID, inv.AmountUSD, feeUSD, txHash)

	// Trigger automated background sweep
	go func() {
		sweepCtx, sweepCancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer sweepCancel()
		_ = s.SweepDepositInvoice(sweepCtx, inv)
	}()

	return nil
}

// SweepDepositInvoice checks gas, shoots BNB from Master, waits for on-chain receipt, and sweeps USDT
func (s *InvoiceService) SweepDepositInvoice(ctx context.Context, inv *model.Invoice) error {
	mnemonic := s.bscClient.GetMasterMnemonic()
	if mnemonic == "" {
		dbMnemonic, _ := s.settingsRepo.Get(ctx, "master_mnemonic")
		if dbMnemonic != "" {
			mnemonic = dbMnemonic
		}
	}

	if mnemonic == "" {
		log.Printf("[WARN] Sweep skipped for invoice %s: Master seed phrase not configured", inv.InvoiceID)
		return fmt.Errorf("master seed phrase not configured")
	}

	// 1. Check actual live on-chain USDT balance on temp address
	liveUsdtBal, err := s.bscClient.GetUsdtBalance(ctx, inv.DepositAddress)
	if err != nil || liveUsdtBal <= 0.0001 {
		_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "swept", "")
		return nil
	}

	_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "sweeping", "")

	// 2. Calculate exact missing minimal BNB gas
	missingWei, err := s.bscClient.CalculateMinimumBnbForSweep(ctx, inv.DepositAddress)
	if err != nil {
		_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "failed", "")
		return err
	}

	if missingWei.Cmp(big.NewInt(0)) > 0 {
		// Shoot exact BNB from Master Wallet (index 0)
		shotTx, err := s.bscClient.ShootBnb(ctx, inv.DepositAddress, missingWei)
		if err != nil {
			_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "failed", "")
			return fmt.Errorf("failed to shoot BNB gas to %s: %w", inv.DepositAddress, err)
		}
		log.Printf("[INFO] Sent %s Wei BNB gas to %s (TxHash: %s). Waiting for on-chain receipt...", missingWei.String(), inv.DepositAddress, shotTx)

		// VERIFY ON-CHAIN RECEIPT BEFORE PROCEEDING TO SWEEP
		confirmed, err := s.bscClient.WaitForReceipt(ctx, shotTx, 30*time.Second)
		if err != nil || !confirmed {
			_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "failed", "")
			return fmt.Errorf("BNB gas shot tx %s unconfirmed: %v", shotTx, err)
		}
	}

	// 3. Derive child wallet private key
	_, childPrivKey, err := s.bscClient.DeriveChildWallet(mnemonic, inv.WalletIndex)
	if err != nil {
		_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "failed", "")
		return fmt.Errorf("failed to derive child private key: %w", err)
	}

	// 4. Sweep 100% of live on-chain USDT to Master Wallet
	sweepTx, err := s.bscClient.SweepUsdt(ctx, childPrivKey, inv.DepositAddress, liveUsdtBal)
	if err != nil {
		_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "failed", "")
		return fmt.Errorf("failed to sweep USDT: %w", err)
	}

	// 5. Confirm sweep transaction on blockchain
	_, _ = s.bscClient.WaitForReceipt(ctx, sweepTx, 30*time.Second)

	_ = s.invoiceRepo.UpdateSweepStatus(ctx, inv.InvoiceID, "swept", sweepTx)
	log.Printf("[SUCCESS] Swept $%.2f USDT from %s to Master Vault | Sweep TxHash: %s", liveUsdtBal, inv.DepositAddress, sweepTx)

	// Clean up temporary address from Alchemy webhook monitor once swept
	_ = s.bscClient.RemoveAddressFromAlchemyWebhook(ctx, inv.DepositAddress)

	return nil
}

// SweepInvoiceByID fetches invoice by ID and performs manual sweep retry
func (s *InvoiceService) SweepInvoiceByID(ctx context.Context, invoiceID string) (*model.Invoice, error) {
	inv, err := s.invoiceRepo.GetByInvoiceID(ctx, invoiceID)
	if err != nil || inv == nil {
		return nil, fmt.Errorf("invoice not found: %s", invoiceID)
	}

	if err := s.SweepDepositInvoice(ctx, inv); err != nil {
		return nil, err
	}

	updatedInv, _ := s.invoiceRepo.GetByInvoiceID(ctx, invoiceID)
	if updatedInv != nil {
		return updatedInv, nil
	}
	return inv, nil
}

// GetInvoiceStatus returns real-time status of an invoice for frontend polling & session recovery
func (s *InvoiceService) GetInvoiceStatus(ctx context.Context, invoiceID string, userID int64) (*model.InvoiceStatusResponse, error) {
	inv, err := s.invoiceRepo.GetByInvoiceID(ctx, invoiceID)
	if err != nil || inv == nil {
		return nil, errors.New("invoice not found")
	}

	if inv.UserID != userID {
		return nil, errors.New("unauthorized access to invoice")
	}

	status := inv.Status

	// Live on-chain detection: If invoice is pending, check if USDT was deposited on blockchain
	if status == "pending" && inv.DepositAddress != "" && s.bscClient != nil {
		liveBal, err := s.bscClient.GetUsdtBalance(ctx, inv.DepositAddress)
		if err == nil && liveBal > 0 && liveBal >= (inv.AmountUSD-0.01) {
			txHash := fmt.Sprintf("0xlive_%s_%d", inv.InvoiceID, time.Now().Unix())
			log.Printf("[INFO] Live on-chain USDT balance $%.2f detected during poll for invoice %s! Fulfilling now...", liveBal, inv.InvoiceID)
			_ = s.FulfillPaidInvoice(ctx, inv.InvoiceID, txHash)

			// Reload updated invoice
			if updatedInv, err := s.invoiceRepo.GetByInvoiceID(ctx, invoiceID); err == nil && updatedInv != nil {
				inv = updatedInv
				status = inv.Status
			}
		}
	}

	secondsLeft := int64(time.Until(inv.ExpiresAt).Seconds())
	if secondsLeft <= 0 && status == "pending" {
		status = "expired"
		secondsLeft = 0
	}

	resp := &model.InvoiceStatusResponse{
		InvoiceID:       inv.InvoiceID,
		InvoiceIDS:      inv.InvoiceID,
		Status:          status,
		AmountUSD:       inv.AmountUSD,
		AmountUSDS:      inv.AmountUSD,
		Purpose:         inv.Purpose,
		ReferenceID:     inv.ReferenceID,
		ReferenceIDS:    inv.ReferenceID,
		DepositAddress:  inv.DepositAddress,
		DepositAddressS: inv.DepositAddress,
		Network:         "BNB Smart Chain (BEP-20)",
		SecondsLeft:     secondsLeft,
		SecondsLeftS:    secondsLeft,
		ExpiresAt:       inv.ExpiresAt.UnixMilli(),
		ExpiresAtS:      inv.ExpiresAt.UnixMilli(),
		CreatedAt:       inv.CreatedAt.Format(time.RFC3339),
		CreatedAtS:      inv.CreatedAt.Format(time.RFC3339),
	}

	if inv.TxHash != nil {
		resp.TxHash = inv.TxHash
		resp.TxHashS = inv.TxHash
	}
	if inv.PaidAt != nil {
		paidStr := inv.PaidAt.Format(time.RFC3339)
		resp.PaidAt = &paidStr
		resp.PaidAtS = &paidStr
	}

	// Calculate tickets awarded if purpose is raffle_tickets
	if inv.Purpose == "raffle_tickets" {
		raffle, _ := s.raffleRepo.GetRaffleByID(ctx, inv.ReferenceID)
		if raffle != nil && raffle.TicketPriceUSD > 0 {
			resp.TicketsAwarded = int((inv.AmountUSD + 0.001) / raffle.TicketPriceUSD)
		} else {
			resp.TicketsAwarded = int((inv.AmountUSD + 0.001) / 0.50)
		}
		if resp.TicketsAwarded < 1 {
			resp.TicketsAwarded = 1
		}
		resp.TicketsAwardedS = resp.TicketsAwarded
	}

	// Include updated user balance
	u, err := s.userRepo.GetByID(ctx, userID)
	if err == nil && u != nil {
		resp.UserBalance = &model.UserResponse{
			ID:         u.ID,
			TelegramID: u.TelegramID,
			Username:   u.Username,
			FirstName:  u.FirstName,
			Spins:      u.Spins,
			Diamonds:   u.Diamonds,
			BalanceUSD: u.BalanceUSD,
		}
		resp.User = resp.UserBalance
	}

	return resp, nil
}
