package handler

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/service"
	"earnminiapp/internal/telegram"
	"earnminiapp/pkg/jwt"
	"earnminiapp/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminHandler struct {
	pool               *pgxpool.Pool
	userRepo           *repository.UserRepository
	walletRepo         *repository.WalletRepository
	txRepo             *repository.TransactionRepository
	bscClient          *bsc.BSCClient
	botClient          *telegram.BotClient
	adminService       *service.AdminService
	analyticsService   *service.AnalyticsService
	giftCodeService    *service.GiftCodeService
	invoiceService     *service.InvoiceService
	spinService        *service.SpinService
	dailyRewardService *service.DailyRewardService
	referralService    *service.ReferralService
	contestRepo        *repository.ContestRepository
	contestService     *service.ContestService
	subAdminService    *service.SubAdminService
	broadcastService   *service.BroadcastService
	jwtManager         *jwt.JWTManager
	cfg                *config.Config
}

func NewAdminHandler(
	pool *pgxpool.Pool,
	userRepo *repository.UserRepository,
	walletRepo *repository.WalletRepository,
	txRepo *repository.TransactionRepository,
	bscClient *bsc.BSCClient,
	botClient *telegram.BotClient,
	adminService *service.AdminService,
	analyticsService *service.AnalyticsService,
	giftCodeService *service.GiftCodeService,
	invoiceService *service.InvoiceService,
	spinService *service.SpinService,
	dailyRewardService *service.DailyRewardService,
	referralService *service.ReferralService,
	contestRepo *repository.ContestRepository,
	contestService *service.ContestService,
	subAdminService *service.SubAdminService,
	broadcastService *service.BroadcastService,
	jwtManager *jwt.JWTManager,
	cfg *config.Config,
) *AdminHandler {
	return &AdminHandler{
		pool:               pool,
		userRepo:           userRepo,
		walletRepo:         walletRepo,
		txRepo:             txRepo,
		bscClient:          bscClient,
		botClient:          botClient,
		adminService:       adminService,
		analyticsService:   analyticsService,
		giftCodeService:    giftCodeService,
		invoiceService:     invoiceService,
		spinService:        spinService,
		dailyRewardService: dailyRewardService,
		referralService:    referralService,
		contestRepo:        contestRepo,
		contestService:     contestService,
		subAdminService:    subAdminService,
		broadcastService:   broadcastService,
		jwtManager:         jwtManager,
		cfg:                cfg,
	}
}

// Authenticate handles POST /api/v1/admin/auth
func (h *AdminHandler) Authenticate(c *gin.Context) {
	var req model.AdminAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Secret key is required")
		return
	}

	authResp, err := h.adminService.AuthenticateAdmin(req.SecretKey)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Admin authorization successful", authResp)
}

// GetWalletStatus handles GET /api/v1/admin/wallet-status
func (h *AdminHandler) GetWalletStatus(c *gin.Context) {
	status, err := h.adminService.GetWalletStatus(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, status)
}

// GetFinancialStats handles GET /api/v1/admin/financial-stats
func (h *AdminHandler) GetFinancialStats(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. Deposits aggregation from invoices table
	var totalDepositsUSD, totalPaidInvoices float64
	_ = h.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_usd), 0), COUNT(id)
		FROM invoices
		WHERE status = 'paid'
	`).Scan(&totalDepositsUSD, &totalPaidInvoices)

	totalDepositFeesUSD := totalDepositsUSD * 0.02
	netDepositsCreditedUSD := totalDepositsUSD - totalDepositFeesUSD

	// 2. Withdrawals aggregation from withdrawals table
	var totalWithdrawalsUSD, totalWithdrawalFeesUSD, totalNetPayoutsUSD, totalCompletedCashouts float64
	_ = h.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_usd), 0), COALESCE(SUM(fee_usd), 0), COALESCE(SUM(net_payout_usd), 0), COUNT(id)
		FROM withdrawals
		WHERE status = 'completed'
	`).Scan(&totalWithdrawalsUSD, &totalWithdrawalFeesUSD, &totalNetPayoutsUSD, &totalCompletedCashouts)

	// Pending withdrawals aggregation
	var pendingCount, pendingAmountUSD float64
	_ = h.pool.QueryRow(ctx, `
		SELECT COUNT(id), COALESCE(SUM(net_payout_usd), 0)
		FROM withdrawals
		WHERE status = 'processing'
	`).Scan(&pendingCount, &pendingAmountUSD)

	// Total 2% platform revenue
	totalPlatformProfitUSD := totalDepositFeesUSD + totalWithdrawalFeesUSD

	// Master wallet live balances
	masterAddr := h.bscClient.GetMasterAddress()
	bnbBal := 0.0
	usdtBal := 0.0
	if masterAddr != "" && masterAddr != "0x0000000000000000000000000000000000000000" {
		bnbBal, _ = h.bscClient.GetBnbBalance(ctx, masterAddr)
		usdtBal, _ = h.bscClient.GetUsdtBalance(ctx, masterAddr)
	}

	response.Success(c, gin.H{
		"masterWallet": gin.H{
			"address":          masterAddr,
			"bnbBalance":       bnbBal,
			"usdtBalance":      usdtBal,
			"lowBnbGasWarning": bnbBal < 0.01,
		},
		"deposits": gin.H{
			"totalGrossUSD":     totalDepositsUSD,
			"platformFeeUSD":    totalDepositFeesUSD,
			"feePercent":        2.0,
			"netCreditedUSD":    netDepositsCreditedUSD,
			"completedInvoices": int(totalPaidInvoices),
		},
		"withdrawals": gin.H{
			"totalRequestedUSD":   totalWithdrawalsUSD,
			"platformFeeUSD":      totalWithdrawalFeesUSD,
			"feePercent":          2.0,
			"netDispatchedUSD":    totalNetPayoutsUSD,
			"completedPayouts":    int(totalCompletedCashouts),
			"pendingPayoutsCount": int(pendingCount),
			"pendingPayoutsUSD":   pendingAmountUSD,
		},
		"platformProfit": gin.H{
			"totalFeeRevenueUSD": totalPlatformProfitUSD,
			"breakdown": gin.H{
				"fromDeposits":    totalDepositFeesUSD,
				"fromWithdrawals": totalWithdrawalFeesUSD,
			},
			"note": "2% fee collected in USDT on every deposit and withdrawal covers BNB gas fees and platform profits without token swaps.",
		},
	})
}

// GenerateMasterWallet handles POST /api/v1/admin/wallet/generate
func (h *AdminHandler) GenerateMasterWallet(c *gin.Context) {
	resp, err := h.adminService.GenerateMasterWallet(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "Master funding wallet generated successfully", resp)
}

// ImportMasterWallet handles POST /api/v1/admin/wallet/import
func (h *AdminHandler) ImportMasterWallet(c *gin.Context) {
	var req model.ImportWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid import payload")
		return
	}

	addr, err := h.adminService.ImportMasterWallet(c.Request.Context(), &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Master wallet imported successfully", gin.H{
		"master_address": addr,
	})
}

// ConfirmVaultInitialization handles POST /api/v1/admin/wallet/confirm-init
func (h *AdminHandler) ConfirmVaultInitialization(c *gin.Context) {
	if err := h.adminService.ConfirmVaultInitialization(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "Master vault initialization confirmed successfully!", gin.H{
		"is_initialized": true,
	})
}

// ExportVaultSecrets handles GET /api/v1/admin/wallet/secrets
func (h *AdminHandler) ExportVaultSecrets(c *gin.Context) {
	secrets, err := h.adminService.ExportVaultSecrets(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, secrets)
}

// DownloadVaultSecretsFile handles GET /api/v1/admin/wallet/export-secrets (text file download)
func (h *AdminHandler) DownloadVaultSecretsFile(c *gin.Context) {
	secrets, err := h.adminService.ExportVaultSecrets(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	content := fmt.Sprintf(`===================================================================
SPIN CRAFT MASTER HD VAULT - CONFIDENTIAL BACKUP
===================================================================
Exported At: %s
Network: %s (Chain ID: %d)
USDT BEP-20 Contract: %s

MASTER WALLET DETAILS:
-------------------------------------------------------------------
Master Address:    %s
Derivation Path:   %s
Seed Phrase (12w): %s
Private Key:       %s

WARNING:
Keep this file in a secure, offline location.
Anyone with this seed phrase or private key has full control
over all platform payout reserves and swept deposit funds.
===================================================================`,
		secrets.ExportedAt, secrets.Network, secrets.ChainID, secrets.UsdtContract,
		secrets.MasterAddress, secrets.DerivationPath, secrets.SeedPhrase, secrets.PrivateKey,
	)

	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=spincraft_master_vault_%s.txt", time.Now().Format("20060102_150405")))
	c.Writer.WriteString(content)
	c.Writer.Flush()
}

// TransferVaultFunds handles POST /api/v1/admin/wallet/transfer (Main Admin Only)
func (h *AdminHandler) TransferVaultFunds(c *gin.Context) {
	if h.adminService == nil {
		response.InternalError(c, "Admin service unavailable")
		return
	}

	var req model.VaultTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid transfer request: asset ('usdt' or 'bnb'), recipient_address, and amount are required")
		return
	}

	res, err := h.adminService.TransferVaultFunds(c.Request.Context(), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, fmt.Sprintf("Successfully broadcasted on-chain transfer of %s %s to %s!", fmt.Sprintf("%.4f", req.Amount), strings.ToUpper(req.Asset), req.RecipientAddress), res)
}

// GetPendingWithdrawals handles GET /api/v1/admin/withdrawals
func (h *AdminHandler) GetPendingWithdrawals(c *gin.Context) {
	status := strings.ToLower(strings.TrimSpace(c.DefaultQuery("status", "all")))
	if status == "pending" {
		status = "processing"
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("q")
	if search == "" {
		search = c.Query("search")
	}
	if search == "" {
		search = c.Query("query")
	}
	search = strings.TrimSpace(search)

	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Fetch aggregate counts
	var pendingCount, completedCount, rejectedCount int64
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM withdrawals WHERE status = 'processing'").Scan(&pendingCount)
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM withdrawals WHERE status = 'completed'").Scan(&completedCount)
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM withdrawals WHERE status = 'rejected'").Scan(&rejectedCount)

	query := `
		SELECT w.id, w.user_id, u.telegram_id, u.first_name, u.username,
		       w.amount_usd, w.fee_usd, w.net_payout_usd, w.ton_address, w.status, w.reference_id,
		       COALESCE(w.tx_hash, ''), COALESCE(w.notes, ''), w.created_at, w.processed_at
		FROM withdrawals w
		JOIN users u ON u.id = w.user_id
		WHERE (1=1)
	`
	var args []interface{}
	argIdx := 1

	if status != "" && status != "all" {
		query += fmt.Sprintf(" AND w.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	if search != "" {
		searchParam := "%" + search + "%"
		query += fmt.Sprintf(" AND (u.first_name ILIKE $%d OR u.username ILIKE $%d OR w.ton_address ILIKE $%d OR w.reference_id ILIKE $%d OR COALESCE(w.tx_hash, '') ILIKE $%d OR CAST(u.telegram_id AS TEXT) ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, searchParam)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY w.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.pool.Query(c.Request.Context(), query, args...)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	list := make([]gin.H, 0)
	for rows.Next() {
		var id, userID, telegramID int64
		var firstName, username, tonAddress, wStatus, refID, txHash, notes string
		var amountUSD, feeUSD, netPayoutUSD float64
		var createdAt time.Time
		var processedAt *time.Time

		if err := rows.Scan(&id, &userID, &telegramID, &firstName, &username, &amountUSD, &feeUSD, &netPayoutUSD, &tonAddress, &wStatus, &refID, &txHash, &notes, &createdAt, &processedAt); err == nil {
			var procAtStr *string
			if processedAt != nil {
				s := processedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
				procAtStr = &s
			}

			bscScanURL := ""
			if txHash != "" && !strings.Contains(txHash, "...") {
				bscScanURL = fmt.Sprintf("https://bscscan.com/tx/%s", txHash)
			}

			list = append(list, gin.H{
				"id":                  id,
				"userId":              userID,
				"user_id":             userID,
				"telegramId":          telegramID,
				"telegram_id":         telegramID,
				"userName":            firstName,
				"user_name":           firstName,
				"first_name":          firstName,
				"username":            username,
				"amountUsd":           amountUSD,
				"amount_usd":          amountUSD,
				"feeUsd":              feeUSD,
				"fee_usd":             feeUSD,
				"netPayoutUsd":        netPayoutUSD,
				"net_amount_usd":      netPayoutUSD,
				"net_payout_usd":      netPayoutUSD,
				"recipient":           tonAddress,
				"ton_address":         tonAddress,
				"destination_address": tonAddress,
				"status":              wStatus,
				"referenceId":         refID,
				"reference_id":        refID,
				"txHash":              txHash,
				"tx_hash":             txHash,
				"bscScanUrl":          bscScanURL,
				"bsc_scan_url":        bscScanURL,
				"notes":               notes,
				"createdAt":           createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"created_at":          createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"processedAt":         procAtStr,
				"processed_at":        procAtStr,
			})
		}
	}

	response.Success(c, gin.H{
		"pendingCount":   pendingCount,
		"completedCount": completedCount,
		"rejectedCount":  rejectedCount,
		"total":          pendingCount + completedCount + rejectedCount,
		"limit":          limit,
		"offset":         offset,
		"list":           list,
		"withdrawals":    list,
		"items":          list,
		"data":           list,
	})
}

// ProcessWithdrawalPayout handles POST /api/v1/admin/withdrawals/:id/payout (Pay from Master HD Vault)
func (h *AdminHandler) ProcessWithdrawalPayout(c *gin.Context) {
	idStr := c.Param("id")
	wID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid withdrawal ID")
		return
	}

	var w repository.DBWithdrawal
	query := `
		SELECT id, user_id, amount_usd, fee_usd, net_payout_usd, ton_address, status, reference_id
		FROM withdrawals
		WHERE id = $1
	`
	err = h.pool.QueryRow(c.Request.Context(), query, wID).Scan(
		&w.ID, &w.UserID, &w.AmountUSD, &w.FeeUSD, &w.NetPayoutUSD, &w.TONAddress, &w.Status, &w.ReferenceID,
	)
	if err != nil {
		response.NotFound(c, "Withdrawal request not found")
		return
	}

	if w.Status != "processing" {
		response.BadRequest(c, fmt.Sprintf("Withdrawal is already in '%s' status", w.Status))
		return
	}

	// Dispatch On-Chain BEP-20 Transfer from Master Vault
	txHash, err := h.bscClient.SendUsdtPayout(c.Request.Context(), w.TONAddress, w.NetPayoutUSD)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Blockchain payout failed: %v", err))
		return
	}

	// Update withdrawal status to completed with tx_hash
	_, _ = h.pool.Exec(c.Request.Context(), `
		UPDATE withdrawals
		SET status = 'completed', tx_hash = $2, notes = 'Paid via Master Vault on-chain', processed_at = NOW()
		WHERE id = $1
	`, wID, txHash)

	// Update transaction audit ledger
	_, _ = h.pool.Exec(c.Request.Context(), `
		UPDATE transactions
		SET status = 'completed', tx_hash = $2
		WHERE reference_id = $1
	`, w.ReferenceID, txHash)

	// Notify user via Telegram Bot
	if h.botClient != nil {
		user, _ := h.userRepo.GetByID(c.Request.Context(), w.UserID)
		if user != nil && user.TelegramID != 0 {
			notifyText := fmt.Sprintf(
				"✅ <b>Withdrawal Processed & Paid!</b> 💸\n\n"+
					"Your withdrawal request of <b>$%.2f USDT</b> has been completed.\n\n"+
					"🏦 <b>Recipient:</b> <code>%s</code>\n"+
					"🔗 <b>Tx Hash:</b> <code>%s</code>\n"+
					"🎉 Check your wallet balance!",
				w.NetPayoutUSD, w.TONAddress, txHash,
			)
			_ = h.botClient.SendMessage(user.TelegramID, notifyText, nil)
		}
	}

	response.SuccessWithMessage(c, "Withdrawal payout broadcasted successfully to BSC Mainnet", gin.H{
		"withdrawalId": w.ID,
		"recipient":    w.TONAddress,
		"netPayoutUsd": w.NetPayoutUSD,
		"txHash":       txHash,
		"bscScanUrl":   fmt.Sprintf("https://bscscan.com/tx/%s", txHash),
		"status":       "completed",
	})
}

// MarkWithdrawalManualPaid handles POST /api/v1/admin/withdrawals/:id/manual-paid (External payment)
func (h *AdminHandler) MarkWithdrawalManualPaid(c *gin.Context) {
	idStr := c.Param("id")
	wID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid withdrawal ID")
		return
	}

	var req model.ManualPaidRequest
	_ = c.ShouldBindJSON(&req)

	var w repository.DBWithdrawal
	query := `
		SELECT id, user_id, amount_usd, fee_usd, net_payout_usd, ton_address, status, reference_id
		FROM withdrawals
		WHERE id = $1
	`
	err = h.pool.QueryRow(c.Request.Context(), query, wID).Scan(
		&w.ID, &w.UserID, &w.AmountUSD, &w.FeeUSD, &w.NetPayoutUSD, &w.TONAddress, &w.Status, &w.ReferenceID,
	)
	if err != nil {
		response.NotFound(c, "Withdrawal request not found")
		return
	}

	if w.Status != "processing" {
		response.BadRequest(c, fmt.Sprintf("Withdrawal is already in '%s' status", w.Status))
		return
	}

	txHash := req.TxHash
	if txHash == "" {
		txHash = fmt.Sprintf("MANUAL-PAID-%d", time.Now().Unix())
	}
	notes := req.Notes
	if notes == "" {
		notes = "Marked as paid manually via external transfer"
	}

	// Update withdrawal status to completed
	_, _ = h.pool.Exec(c.Request.Context(), `
		UPDATE withdrawals
		SET status = 'completed', tx_hash = $2, notes = $3, processed_at = NOW()
		WHERE id = $1
	`, wID, txHash, notes)

	// Update transaction audit ledger
	_, _ = h.pool.Exec(c.Request.Context(), `
		UPDATE transactions
		SET status = 'completed', tx_hash = $2
		WHERE reference_id = $1
	`, w.ReferenceID, txHash)

	// Notify user via Telegram Bot
	if h.botClient != nil {
		user, _ := h.userRepo.GetByID(c.Request.Context(), w.UserID)
		if user != nil && user.TelegramID != 0 {
			notifyText := fmt.Sprintf(
				"✅ <b>Withdrawal Marked as Paid!</b> 💸\n\n"+
					"Your withdrawal request of <b>$%.2f USDT</b> has been processed.\n\n"+
					"🏦 <b>Recipient:</b> <code>%s</code>\n"+
					"📝 <b>Notes:</b> %s\n"+
					"🎉 Thank you for spinning with us!",
				w.NetPayoutUSD, w.TONAddress, notes,
			)
			_ = h.botClient.SendMessage(user.TelegramID, notifyText, nil)
		}
	}

	response.SuccessWithMessage(c, "Withdrawal successfully marked as completed", gin.H{
		"withdrawalId": w.ID,
		"recipient":    w.TONAddress,
		"netPayoutUsd": w.NetPayoutUSD,
		"txHash":       txHash,
		"notes":        notes,
		"status":       "completed",
	})
}

// RejectWithdrawal handles POST /api/v1/admin/withdrawals/:id/reject
func (h *AdminHandler) RejectWithdrawal(c *gin.Context) {
	idStr := c.Param("id")
	wID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid withdrawal ID")
		return
	}

	var req model.RejectWithdrawalRequest
	_ = c.ShouldBindJSON(&req)

	var w repository.DBWithdrawal
	query := `
		SELECT id, user_id, amount_usd, status, reference_id
		FROM withdrawals
		WHERE id = $1
	`
	err = h.pool.QueryRow(c.Request.Context(), query, wID).Scan(&w.ID, &w.UserID, &w.AmountUSD, &w.Status, &w.ReferenceID)
	if err != nil {
		response.NotFound(c, "Withdrawal request not found")
		return
	}

	if w.Status != "processing" {
		response.BadRequest(c, fmt.Sprintf("Cannot reject withdrawal with status '%s'", w.Status))
		return
	}

	// Refund balance to user
	_, err = h.userRepo.MutateBalances(c.Request.Context(), w.UserID, 0, 0, w.AmountUSD, 0)
	if err != nil {
		response.InternalError(c, "Failed to refund user balance")
		return
	}

	reason := req.Reason
	if reason == "" {
		reason = "Rejected by administrator. Balance refunded."
	}

	// Update status to rejected
	_, _ = h.pool.Exec(c.Request.Context(), "UPDATE withdrawals SET status = 'rejected', notes = $2, processed_at = NOW() WHERE id = $1", wID, reason)
	_, _ = h.pool.Exec(c.Request.Context(), "UPDATE transactions SET status = 'failed' WHERE reference_id = $1", w.ReferenceID)

	// Notify user via Telegram Bot
	if h.botClient != nil {
		user, _ := h.userRepo.GetByID(c.Request.Context(), w.UserID)
		if user != nil && user.TelegramID != 0 {
			notifyText := fmt.Sprintf(
				"❌ <b>Withdrawal Request Update</b>\n\n"+
					"Your withdrawal request for <b>$%.2f USDT</b> was rejected.\n"+
					"📝 <b>Reason:</b> %s\n\n"+
					"💰 <b>Your balance of $%.2f USDT has been fully refunded to your account.</b>",
				w.AmountUSD, reason, w.AmountUSD,
			)
			_ = h.botClient.SendMessage(user.TelegramID, notifyText, nil)
		}
	}

	response.SuccessWithMessage(c, "Withdrawal rejected and funds refunded to user", gin.H{
		"withdrawalId": w.ID,
		"status":       "rejected",
		"reason":       reason,
		"refundedUsd":  w.AmountUSD,
	})
}

// GetPayoutSettings handles GET /api/v1/admin/payout-settings
func (h *AdminHandler) GetPayoutSettings(c *gin.Context) {
	settings, err := h.adminService.GetPayoutSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, settings)
}

// UpdatePayoutSettings handles POST /api/v1/admin/payout-settings
func (h *AdminHandler) UpdatePayoutSettings(c *gin.Context) {
	var req model.UpdatePayoutSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid payout settings payload")
		return
	}

	updated, err := h.adminService.UpdatePayoutSettings(c.Request.Context(), &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Payout settings updated successfully", updated)
}

// GetOverviewStats handles GET /api/v1/admin/stats/overview (Alias combining financial, wallet and user metrics)
func (h *AdminHandler) GetOverviewStats(c *gin.Context) {
	ctx := c.Request.Context()

	// Financials
	var totalDepositsUSD, netDepositsCreditedUSD, totalDepositFeesUSD float64
	var totalWithdrawalsUSD, totalNetPayoutsUSD, totalWithdrawalFeesUSD float64
	var pendingAmountUSD float64
	var totalPaidInvoices, totalCompletedCashouts, pendingCount int64

	_ = h.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_usd), 0), COALESCE(SUM(credited_usd), 0), COALESCE(SUM(fee_usd), 0), COUNT(*) FROM invoices WHERE status = 'paid'`).Scan(&totalDepositsUSD, &netDepositsCreditedUSD, &totalDepositFeesUSD, &totalPaidInvoices)
	_ = h.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_usd), 0), COALESCE(SUM(net_payout_usd), 0), COALESCE(SUM(fee_usd), 0), COUNT(*) FROM withdrawals WHERE status = 'completed'`).Scan(&totalWithdrawalsUSD, &totalNetPayoutsUSD, &totalWithdrawalFeesUSD, &totalCompletedCashouts)
	_ = h.pool.QueryRow(ctx, `SELECT COALESCE(SUM(net_payout_usd), 0), COUNT(*) FROM withdrawals WHERE status = 'processing'`).Scan(&pendingAmountUSD, &pendingCount)

	totalPlatformProfitUSD := totalDepositFeesUSD + totalWithdrawalFeesUSD

	// Master Wallet
	walletStatus, _ := h.adminService.GetWalletStatus(ctx)

	// Payout Settings
	payoutSettings, _ := h.adminService.GetPayoutSettings(ctx)

	// User count
	var totalUsers int64
	_ = h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)

	// Spins played today
	var totalSpinsToday int64
	_ = h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM spins WHERE created_at >= CURRENT_DATE`).Scan(&totalSpinsToday)

	// Traffic & Active Users
	var trafficStats any = nil
	var dau int64 = 0
	var mau int64 = 0
	if h.analyticsService != nil {
		if tData, err := h.analyticsService.GetTrafficAnalytics(ctx, "24h"); err == nil && tData != nil {
			trafficStats = tData
			dau = tData.DailyActiveUsers
			mau = tData.MonthlyActiveUsers
		}
	}

	response.Success(c, gin.H{
		"wallet":                    walletStatus,
		"payoutSettings":            payoutSettings,
		"totalUsers":                totalUsers,
		"total_registered_users":    totalUsers,
		"total_deposits_usd":        totalDepositsUSD,
		"total_withdrawals_usd":     totalWithdrawalsUSD,
		"gross_volume_usd":          totalDepositsUSD + totalWithdrawalsUSD,
		"active_users_dau":          dau,
		"active_users_mau":          mau,
		"total_spins_today":         totalSpinsToday,
		"pending_withdrawals_count": int(pendingCount),
		"traffic":                   trafficStats,
		"deposits": gin.H{
			"totalGrossUSD":     totalDepositsUSD,
			"platformFeeUSD":    totalDepositFeesUSD,
			"netCreditedUSD":    netDepositsCreditedUSD,
			"completedInvoices": int(totalPaidInvoices),
		},
		"withdrawals": gin.H{
			"totalRequestedUSD":   totalWithdrawalsUSD,
			"platformFeeUSD":      totalWithdrawalFeesUSD,
			"netDispatchedUSD":    totalNetPayoutsUSD,
			"completedPayouts":    int(totalCompletedCashouts),
			"pendingPayoutsCount": int(pendingCount),
			"pendingPayoutsUSD":   pendingAmountUSD,
		},
		"platformProfit": gin.H{
			"totalFeeRevenueUSD": totalPlatformProfitUSD,
			"breakdown": gin.H{
				"fromDeposits":    totalDepositFeesUSD,
				"fromWithdrawals": totalWithdrawalFeesUSD,
			},
		},
	})
}

// -------------------------------------------------------------
// USER MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// GetUsers handles GET /api/v1/admin/users
func (h *AdminHandler) GetUsers(c *gin.Context) {
	search := c.Query("search")
	if search == "" {
		search = c.Query("q")
	}
	if search == "" {
		search = c.Query("query")
	}
	search = strings.TrimPrefix(strings.TrimSpace(search), "@")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var rows pgxRows
	var err error
	var totalUsers int64

	if search != "" {
		searchParam := "%" + search + "%"
		_ = h.pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM users WHERE username ILIKE $1 OR first_name ILIKE $1 OR CAST(telegram_id AS TEXT) ILIKE $1", searchParam).Scan(&totalUsers)

		query := `
			SELECT id, telegram_id, username, first_name, level, energy, spins, diamonds, balance_usd, COALESCE(ton_wallet, ''), is_premium, is_banned, created_at
			FROM users
			WHERE username ILIKE $1 OR first_name ILIKE $1 OR CAST(telegram_id AS TEXT) ILIKE $1
			ORDER BY id DESC
			LIMIT $2 OFFSET $3
		`
		rows, err = h.pool.Query(c.Request.Context(), query, searchParam, limit, offset)
	} else {
		_ = h.pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM users").Scan(&totalUsers)

		query := `
			SELECT id, telegram_id, username, first_name, level, energy, spins, diamonds, balance_usd, COALESCE(ton_wallet, ''), is_premium, is_banned, created_at
			FROM users
			ORDER BY id DESC
			LIMIT $1 OFFSET $2
		`
		rows, err = h.pool.Query(c.Request.Context(), query, limit, offset)
	}

	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	users := make([]gin.H, 0)
	for rows.Next() {
		var id, telegramID, diamonds int64
		var username, firstName, tonWallet, createdAt string
		var level, energy, spins int
		var balanceUSD float64
		var isPremium, isBanned bool

		if err := rows.Scan(&id, &telegramID, &username, &firstName, &level, &energy, &spins, &diamonds, &balanceUSD, &tonWallet, &isPremium, &isBanned, &createdAt); err == nil {
			users = append(users, gin.H{
				"id":          id,
				"userId":      id,
				"user_id":     id,
				"telegramId":  telegramID,
				"telegram_id": telegramID,
				"username":    username,
				"firstName":   firstName,
				"first_name":  firstName,
				"name":        firstName,
				"level":       level,
				"energy":      energy,
				"spins":       spins,
				"diamonds":    diamonds,
				"gems":        diamonds,
				"balanceUsd":  balanceUSD,
				"balance_usd": balanceUSD,
				"tonWallet":   tonWallet,
				"ton_wallet":  tonWallet,
				"isPremium":   isPremium,
				"is_premium":  isPremium,
				"isBanned":    isBanned,
				"is_banned":   isBanned,
				"createdAt":   createdAt,
				"created_at":  createdAt,
			})
		}
	}

	response.Success(c, gin.H{
		"users":  users,
		"list":   users,
		"items":  users,
		"data":   users,
		"total":  totalUsers,
		"limit":  limit,
		"offset": offset,
	})
}

// AdjustUserBalance handles POST /api/v1/admin/users/:id/adjust-balance
func (h *AdminHandler) AdjustUserBalance(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var req struct {
		Spins         *int     `json:"spins"`
		DeltaSpins    *int     `json:"delta_spins"`
		Diamonds      *int64   `json:"diamonds"`
		DeltaDiamonds *int64   `json:"delta_diamonds"`
		USD           *float64 `json:"usd"`
		DeltaUSD      *float64 `json:"delta_usd"`
		Reason        string   `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid payload")
		return
	}

	deltaSpins := 0
	if req.DeltaSpins != nil {
		deltaSpins = *req.DeltaSpins
	} else if req.Spins != nil {
		deltaSpins = *req.Spins
	}

	var deltaDiamonds int64 = 0
	if req.DeltaDiamonds != nil {
		deltaDiamonds = *req.DeltaDiamonds
	} else if req.Diamonds != nil {
		deltaDiamonds = *req.Diamonds
	}

	var deltaUSD float64 = 0
	if req.DeltaUSD != nil {
		deltaUSD = *req.DeltaUSD
	} else if req.USD != nil {
		deltaUSD = *req.USD
	}

	updatedUser, err := h.userRepo.MutateBalances(c.Request.Context(), userID, deltaSpins, deltaDiamonds, deltaUSD, 0)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	// Ledger record
	_ = h.txRepo.Create(c.Request.Context(), &model.Transaction{
		UserID:         userID,
		Category:       "admin_adjustment",
		Title:          "Admin Balance Adjustment",
		AmountUSD:      deltaUSD,
		AmountDiamonds: deltaDiamonds,
		AmountSpins:    deltaSpins,
		Status:         "completed",
		ReferenceID:    fmt.Sprintf("ADM-%d-%d", userID, time.Now().UnixNano()),
		Description:    req.Reason,
	})

	response.SuccessWithMessage(c, "User balances adjusted successfully", updatedUser)
}

// ToggleBanUser handles POST /api/v1/admin/users/:id/ban
func (h *AdminHandler) ToggleBanUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var req struct {
		Banned bool   `json:"banned"`
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	_, err = h.pool.Exec(c.Request.Context(), "UPDATE users SET is_banned = $1 WHERE id = $2", req.Banned, userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	msg := "User unbanned successfully"
	if req.Banned {
		msg = "User banned successfully"
	}
	response.SuccessWithMessage(c, msg, gin.H{"userId": userID, "isBanned": req.Banned})
}

// -------------------------------------------------------------
// GIFT CODES MANAGEMENT
// -------------------------------------------------------------

// GetGiftCodes handles GET /api/v1/admin/gift-codes?type=all|custom|bulk&q=...
func (h *AdminHandler) GetGiftCodes(c *gin.Context) {
	codeType := c.DefaultQuery("type", "all")
	search := strings.TrimSpace(c.Query("q"))

	query := `
		SELECT id, code, COALESCE(batch_id, ''), COALESCE(batch_name, ''), reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, is_active, expires_at, created_at
		FROM gift_codes
		WHERE (1=1)
	`
	var args []interface{}
	argIdx := 1

	if codeType == "custom" {
		query += " AND (batch_id IS NULL OR batch_id = '')"
	} else if codeType == "bulk" {
		query += " AND (batch_id IS NOT NULL AND batch_id != '')"
	}

	if search != "" {
		searchParam := "%" + search + "%"
		query += fmt.Sprintf(" AND (code ILIKE $%d OR COALESCE(batch_name, '') ILIKE $%d OR COALESCE(batch_id, '') ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, searchParam)
		argIdx++
	}

	query += " ORDER BY id DESC LIMIT 500"

	rows, err := h.pool.Query(c.Request.Context(), query, args...)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int64
		var code, batchID, batchName, createdAt string
		var diamonds int64
		var spins, maxClaims, currentClaims int
		var usd float64
		var isActive bool
		var expiresAt *time.Time

		if err := rows.Scan(&id, &code, &batchID, &batchName, &diamonds, &spins, &usd, &maxClaims, &currentClaims, &isActive, &expiresAt, &createdAt); err == nil {
			var expStr *string
			if expiresAt != nil {
				s := expiresAt.UTC().Format("2006-01-02T15:04:05Z07:00")
				expStr = &s
			}
			list = append(list, gin.H{
				"id":              id,
				"code":            code,
				"batchId":         batchID,
				"batch_id":        batchID,
				"batchName":       batchName,
				"batch_name":      batchName,
				"rewardDiamonds":  diamonds,
				"reward_diamonds": diamonds,
				"rewardSpins":     spins,
				"reward_spins":    spins,
				"rewardUsd":       usd,
				"reward_usd":      usd,
				"maxClaims":       maxClaims,
				"max_claims":      maxClaims,
				"currentClaims":   currentClaims,
				"current_claims":  currentClaims,
				"claimsCount":     currentClaims,
				"claims_count":    currentClaims,
				"isActive":        isActive,
				"is_active":       isActive,
				"expiresAt":       expStr,
				"expires_at":      expStr,
				"createdAt":       createdAt,
				"created_at":      createdAt,
			})
		}
	}
	response.Success(c, list)
}

// CreateGiftCode handles POST /api/v1/admin/gift-codes
func (h *AdminHandler) CreateGiftCode(c *gin.Context) {
	var req struct {
		Code           string  `json:"code" binding:"required"`
		RewardDiamonds int64   `json:"reward_diamonds"`
		RewardSpins    int     `json:"reward_spins"`
		RewardUSD      float64 `json:"reward_usd"`
		MaxClaims      int     `json:"max_claims"`
		ExpiresInDays  int     `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid gift code payload")
		return
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		response.BadRequest(c, "Code cannot be empty")
		return
	}

	if req.MaxClaims <= 0 {
		req.MaxClaims = 1000
	}

	var expiresAt *time.Time
	if req.ExpiresInDays > 0 {
		exp := time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour)
		expiresAt = &exp
	}

	query := `
		INSERT INTO gift_codes (code, reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, is_active, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, 0, true, $6, NOW())
		RETURNING id
	`
	var id int64
	err := h.pool.QueryRow(c.Request.Context(), query, cleanCode, req.RewardDiamonds, req.RewardSpins, req.RewardUSD, req.MaxClaims, expiresAt).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			response.BadRequest(c, fmt.Sprintf("Gift code '%s' already exists", cleanCode))
			return
		}
		response.InternalError(c, fmt.Sprintf("Failed to create gift code: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Gift code created successfully", gin.H{
		"id":             id,
		"code":           cleanCode,
		"rewardDiamonds": req.RewardDiamonds,
		"rewardSpins":    req.RewardSpins,
		"rewardUsd":      req.RewardUSD,
		"maxClaims":      req.MaxClaims,
		"currentClaims":  0,
		"isActive":       true,
		"expiresAt":      expiresAt,
	})
}

// BulkGenerateGiftCodes handles POST /api/v1/admin/gift-codes/bulk-generate
func (h *AdminHandler) BulkGenerateGiftCodes(c *gin.Context) {
	var req model.BulkGenerateGiftCodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid bulk generate payload: quantity (1-1000) is required")
		return
	}

	res, err := h.giftCodeService.BulkGenerateCodes(c.Request.Context(), &req)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to generate bulk codes: %v", err))
		return
	}

	response.SuccessWithMessage(c, fmt.Sprintf("Successfully generated %d unique gift codes! 🎉", res.Count), res)
}

// GetGiftCodeBatches handles GET /api/v1/admin/gift-codes/batches
func (h *AdminHandler) GetGiftCodeBatches(c *gin.Context) {
	query := `
		SELECT 
			batch_id,
			MAX(batch_name) as batch_name,
			COUNT(id) as total_codes,
			COUNT(id) FILTER (WHERE current_claims > 0) as claimed_codes,
			COUNT(id) FILTER (WHERE current_claims = 0) as unclaimed_codes,
			MAX(reward_diamonds) as reward_diamonds,
			MAX(reward_spins) as reward_spins,
			MAX(reward_usd) as reward_usd,
			MAX(expires_at) as expires_at,
			MIN(created_at) as created_at
		FROM gift_codes
		WHERE batch_id IS NOT NULL AND batch_id != ''
		GROUP BY batch_id
		ORDER BY MIN(created_at) DESC
	`
	rows, err := h.pool.Query(c.Request.Context(), query)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var batchID, batchName string
		var totalCodes, claimedCodes, unclaimedCodes, spins int
		var diamonds int64
		var usd float64
		var expiresAt *time.Time
		var createdAt time.Time

		if err := rows.Scan(&batchID, &batchName, &totalCodes, &claimedCodes, &unclaimedCodes, &diamonds, &spins, &usd, &expiresAt, &createdAt); err == nil {
			var expStr *string
			if expiresAt != nil {
				s := expiresAt.UTC().Format("2006-01-02T15:04:05Z07:00")
				expStr = &s
			}
			list = append(list, gin.H{
				"batchId":         batchID,
				"batch_id":        batchID,
				"batchName":       batchName,
				"batch_name":      batchName,
				"totalCodes":      totalCodes,
				"total_codes":     totalCodes,
				"claimedCodes":    claimedCodes,
				"claimed_codes":   claimedCodes,
				"unclaimedCodes":  unclaimedCodes,
				"unclaimed_codes": unclaimedCodes,
				"rewardDiamonds":  diamonds,
				"reward_diamonds": diamonds,
				"rewardSpins":     spins,
				"reward_spins":    spins,
				"rewardUsd":       usd,
				"reward_usd":      usd,
				"expiresAt":       expStr,
				"expires_at":      expStr,
				"createdAt":       createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"created_at":      createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			})
		}
	}
	response.Success(c, list)
}

// GetBatchCodes handles GET /api/v1/admin/gift-codes/batches/:batch_id
func (h *AdminHandler) GetBatchCodes(c *gin.Context) {
	batchID := c.Param("batch_id")
	query := `
		SELECT g.id, g.code, g.reward_diamonds, g.reward_spins, g.reward_usd, g.current_claims, g.is_active, g.created_at,
		       COALESCE(u.id, 0) as claimer_id, COALESCE(u.telegram_id, 0) as claimer_tg_id, COALESCE(u.username, '') as claimer_username, COALESCE(u.first_name, '') as claimer_first_name, c.claimed_at
		FROM gift_codes g
		LEFT JOIN gift_code_claims c ON c.gift_code_id = g.id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE g.batch_id = $1
		ORDER BY g.id ASC
	`
	rows, err := h.pool.Query(c.Request.Context(), query, batchID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, diamonds, claimerID, claimerTgID int64
		var code, claimerUsername, claimerFirstName string
		var currentClaims, spins int
		var usd float64
		var isActive bool
		var createdAt time.Time
		var claimedAt *time.Time

		if err := rows.Scan(&id, &code, &diamonds, &spins, &usd, &currentClaims, &isActive, &createdAt, &claimerID, &claimerTgID, &claimerUsername, &claimerFirstName, &claimedAt); err == nil {
			var claimedAtStr *string
			if claimedAt != nil {
				s := claimedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
				claimedAtStr = &s
			}
			isClaimed := currentClaims > 0
			list = append(list, gin.H{
				"id":             id,
				"code":           code,
				"rewardDiamonds": diamonds,
				"rewardSpins":    spins,
				"rewardUsd":      usd,
				"isClaimed":      isClaimed,
				"isActive":       isActive,
				"createdAt":      createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"claimer": gin.H{
					"userId":     claimerID,
					"telegramId": claimerTgID,
					"username":   claimerUsername,
					"firstName":  claimerFirstName,
					"claimedAt":  claimedAtStr,
				},
			})
		}
	}
	response.Success(c, list)
}

// ExportBatchCSV handles GET /api/v1/admin/gift-codes/batches/:batch_id/export-csv
func (h *AdminHandler) ExportBatchCSV(c *gin.Context) {
	batchID := c.Param("batch_id")
	query := `
		SELECT g.code, g.reward_diamonds, g.reward_spins, g.reward_usd, 
		       CASE WHEN g.current_claims > 0 THEN 'CLAIMED' ELSE 'UNCLAIMED' END as status,
		       COALESCE(u.username, '') as claimed_by,
		       COALESCE(c.claimed_at::text, '') as claimed_at
		FROM gift_codes g
		LEFT JOIN gift_code_claims c ON c.gift_code_id = g.id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE g.batch_id = $1
		ORDER BY g.id ASC
	`
	rows, err := h.pool.Query(c.Request.Context(), query, batchID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("Code,Diamonds,Spins,USD_Reward,Status,Claimed_By,Claimed_At\n")
	for rows.Next() {
		var code, status, claimedBy, claimedAt string
		var diamonds int64
		var spins int
		var usd float64
		if err := rows.Scan(&code, &diamonds, &spins, &usd, &status, &claimedBy, &claimedAt); err == nil {
			sb.WriteString(fmt.Sprintf("%s,%d,%d,%.2f,%s,%s,%s\n", code, diamonds, spins, usd, status, claimedBy, claimedAt))
		}
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s_codes.csv", batchID))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.String(200, sb.String())
}

// GetGiftCodeClaimers handles GET /api/v1/admin/gift-codes/:id/claims
func (h *AdminHandler) GetGiftCodeClaimers(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	query := `
		SELECT c.user_id, u.telegram_id, u.first_name, u.username, c.claimed_at
		FROM gift_code_claims c
		JOIN users u ON u.id = c.user_id
		WHERE c.gift_code_id = $1
		ORDER BY c.claimed_at DESC
	`
	rows, err := h.pool.Query(c.Request.Context(), query, id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var userID, tgID int64
		var firstName, username string
		var claimedAt time.Time
		if err := rows.Scan(&userID, &tgID, &firstName, &username, &claimedAt); err == nil {
			list = append(list, gin.H{
				"userId":     userID,
				"telegramId": tgID,
				"firstName":  firstName,
				"username":   username,
				"claimedAt":  claimedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			})
		}
	}
	response.Success(c, list)
}

// ExportGiftCodeClaimsCSV handles GET /api/v1/admin/gift-codes/:id/export-csv
func (h *AdminHandler) ExportGiftCodeClaimsCSV(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var code string
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT code FROM gift_codes WHERE id = $1", id).Scan(&code)
	if code == "" {
		code = fmt.Sprintf("gift_code_%d", id)
	}

	query := `
		SELECT c.user_id, u.telegram_id, u.first_name, u.username, c.claimed_at
		FROM gift_code_claims c
		JOIN users u ON u.id = c.user_id
		WHERE c.gift_code_id = $1
		ORDER BY c.claimed_at DESC
	`
	rows, err := h.pool.Query(c.Request.Context(), query, id)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("User_ID,Telegram_ID,First_Name,Username,Claimed_At\n")
	for rows.Next() {
		var userID, tgID int64
		var firstName, username string
		var claimedAt time.Time
		if err := rows.Scan(&userID, &tgID, &firstName, &username, &claimedAt); err == nil {
			sb.WriteString(fmt.Sprintf("%d,%d,%s,%s,%s\n", userID, tgID, firstName, username, claimedAt.UTC().Format("2006-01-02T15:04:05Z07:00")))
		}
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s_claims.csv", code))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.String(200, sb.String())
}

// DeleteGiftCode handles DELETE /api/v1/admin/gift-codes/:id
func (h *AdminHandler) DeleteGiftCode(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.ParseInt(idStr, 10, 64)
	_, _ = h.pool.Exec(c.Request.Context(), "DELETE FROM gift_codes WHERE id = $1", id)
	response.SuccessWithMessage(c, "Gift code deleted successfully", nil)
}

// DeleteGiftCodeBatch handles DELETE /api/v1/admin/gift-codes/batches/:batch_id
func (h *AdminHandler) DeleteGiftCodeBatch(c *gin.Context) {
	batchID := c.Param("batch_id")
	_, _ = h.pool.Exec(c.Request.Context(), "DELETE FROM gift_codes WHERE batch_id = $1", batchID)
	response.SuccessWithMessage(c, fmt.Sprintf("Batch %s revoked successfully", batchID), nil)
}

// -------------------------------------------------------------
// TASKS & QUESTS MANAGEMENT (WITH DIRECT IMAGE UPLOADS)
// -------------------------------------------------------------

// GetTasks handles GET /api/v1/admin/tasks
func (h *AdminHandler) GetTasks(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, category, title, COALESCE(icon, ''), COALESCE(icon_url, ''),
		       is_icon_image, reward_gems, COALESCE(reward_spins, 0), secondary_reward_gems,
		       target_count, task_type, COALESCE(action_url, ''), COALESCE(channel_id, ''), is_active, created_at
		FROM tasks
		ORDER BY created_at DESC
	`)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id string
		var category, title, icon, iconURL, actionURL, channelID, taskType string
		var rewardGems, rewardSpins, secondaryRewardGems, targetCount int
		var isIconImage, isActive bool
		var createdAt time.Time

		if err := rows.Scan(&id, &category, &title, &icon, &iconURL, &isIconImage, &rewardGems, &rewardSpins, &secondaryRewardGems, &targetCount, &taskType, &actionURL, &channelID, &isActive, &createdAt); err == nil {
			list = append(list, gin.H{
				"id":                  id,
				"taskId":              id,
				"task_id":             id,
				"category":            category,
				"title":               title,
				"icon":                icon,
				"iconUrl":             iconURL,
				"icon_url":            iconURL,
				"isIconImage":         isIconImage,
				"is_icon_image":       isIconImage,
				"rewardGems":          rewardGems,
				"reward_gems":         rewardGems,
				"rewardDiamonds":      rewardGems,
				"reward_diamonds":     rewardGems,
				"rewardSpins":         rewardSpins,
				"reward_spins":        rewardSpins,
				"secondaryRewardGems": secondaryRewardGems,
				"targetCount":         targetCount,
				"target_count":        targetCount,
				"taskType":            taskType,
				"task_type":           taskType,
				"actionUrl":           actionURL,
				"action_url":          actionURL,
				"channelId":           channelID,
				"channel_id":          channelID,
				"isActive":            isActive,
				"is_active":           isActive,
				"createdAt":           createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"created_at":          createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			})
		}
	}
	response.Success(c, list)
}

// CreateTask handles POST /api/v1/admin/tasks (Supports all 3 task types, custom rewards, and image uploads)
func (h *AdminHandler) CreateTask(c *gin.Context) {
	var taskID, category, title, iconURL, actionURL, channelID, taskType string
	var rewardGems, rewardSpins, targetCount int

	// 1. Check if multipart form upload
	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		taskID = c.PostForm("task_id")
		category = c.PostForm("category")
		title = c.PostForm("title")
		actionURL = c.PostForm("action_url")
		channelID = c.PostForm("channel_id")
		taskType = c.PostForm("task_type")
		iconURL = c.PostForm("icon_url")
		rewardGems, _ = strconv.Atoi(c.PostForm("reward_gems"))
		if rewardGems == 0 {
			rewardGems, _ = strconv.Atoi(c.PostForm("reward_diamonds"))
		}
		rewardSpins, _ = strconv.Atoi(c.PostForm("reward_spins"))
		targetCount, _ = strconv.Atoi(c.PostForm("target_count"))

		// Handle direct file upload if present
		file, err := c.FormFile("icon_file")
		if err == nil && file != nil {
			_ = os.MkdirAll("./uploads/tasks", os.ModePerm)
			ext := filepath.Ext(file.Filename)
			if ext == "" {
				ext = ".png"
			}
			filename := fmt.Sprintf("task_%d_%d%s", time.Now().UnixNano()/1e6, rand.Intn(1000), ext)
			dst := filepath.Join("./uploads/tasks", filename)
			if err := c.SaveUploadedFile(file, dst); err == nil {
				iconURL = "/uploads/tasks/" + filename
			}
		}
	} else {
		// JSON Body
		var req struct {
			TaskID         string `json:"task_id"`
			Category       string `json:"category"` // 'special', 'daily', 'socials'
			Title          string `json:"title" binding:"required"`
			TaskType       string `json:"task_type"` // 'external_link', 'invite_count', 'spin_count', 'level_reach', 'telegram_channel', 'watch_ad'
			TargetCount    int    `json:"target_count"`
			Icon           string `json:"icon"`
			IconURL        string `json:"icon_url"`
			RewardGems     int    `json:"reward_gems"`
			RewardDiamonds int    `json:"reward_diamonds"`
			RewardSpins    int    `json:"reward_spins"`
			ActionURL      string `json:"action_url"`
			ChannelID      string `json:"channel_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid task payload: Title is required")
			return
		}
		taskID = req.TaskID
		category = req.Category
		title = req.Title
		taskType = req.TaskType
		targetCount = req.TargetCount
		iconURL = req.IconURL
		if iconURL == "" {
			iconURL = req.Icon
		}
		rewardGems = req.RewardGems
		if rewardGems == 0 {
			rewardGems = req.RewardDiamonds
		}
		rewardSpins = req.RewardSpins
		actionURL = req.ActionURL
		channelID = req.ChannelID
	}

	if title == "" {
		response.BadRequest(c, "Task Title is required")
		return
	}
	if taskID == "" {
		taskID = fmt.Sprintf("task-%d", time.Now().UnixNano()/1e6)
	}
	if category == "" {
		category = "socials"
	}
	if iconURL == "" {
		if taskType == "watch_ad" {
			iconURL = "🎬"
		} else if taskType == "telegram_channel" {
			iconURL = "./assets/telegram.png"
		} else if taskType == "invite_count" {
			iconURL = "./assets/gift_animated.gif"
		} else if taskType == "spin_count" {
			iconURL = "./assets/wheel-of-fortune.png"
		} else if taskType == "level_reach" {
			iconURL = "./assets/trophy.png"
		} else {
			iconURL = "./assets/youtube.png"
		}
	}
	if targetCount <= 0 {
		targetCount = 1
	}

	// Auto-infer task_type if not specified
	if taskType == "" {
		if channelID != "" {
			taskType = "telegram_channel"
		} else if actionURL != "" {
			taskType = "external_link"
		} else if targetCount > 1 {
			taskType = "invite_count"
		} else {
			taskType = "external_link"
		}
	}

	isIconImage := strings.Contains(iconURL, ".") || strings.Contains(iconURL, "/") || strings.HasPrefix(iconURL, "http")

	query := `
		INSERT INTO tasks (id, category, title, icon, icon_url, is_icon_image, reward_gems, reward_spins, target_count, task_type, action_url, channel_id, is_active, created_at)
		VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
		ON CONFLICT (id) DO UPDATE
		SET category = EXCLUDED.category, title = EXCLUDED.title, icon = EXCLUDED.icon, icon_url = EXCLUDED.icon_url,
		    is_icon_image = EXCLUDED.is_icon_image, reward_gems = EXCLUDED.reward_gems, reward_spins = EXCLUDED.reward_spins,
		    target_count = EXCLUDED.target_count, task_type = EXCLUDED.task_type,
		    action_url = EXCLUDED.action_url, channel_id = EXCLUDED.channel_id
		RETURNING id
	`
	var id string
	err := h.pool.QueryRow(c.Request.Context(), query, taskID, category, title, iconURL, isIconImage, rewardGems, rewardSpins, targetCount, taskType, actionURL, channelID).Scan(&id)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to save task: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Task created/updated successfully", gin.H{
		"id":           id,
		"taskId":       id,
		"task_id":      id,
		"title":        title,
		"taskType":     taskType,
		"task_type":    taskType,
		"targetCount":  targetCount,
		"target_count": targetCount,
		"iconUrl":      iconURL,
		"icon_url":     iconURL,
		"rewardGems":   rewardGems,
		"reward_gems":  rewardGems,
		"rewardSpins":  rewardSpins,
		"reward_spins": rewardSpins,
		"actionUrl":    actionURL,
		"action_url":   actionURL,
		"channelId":    channelID,
		"channel_id":   channelID,
	})
}

// DeleteTask handles DELETE /api/v1/admin/tasks/:id
func (h *AdminHandler) DeleteTask(c *gin.Context) {
	idStr := c.Param("id")
	_, _ = h.pool.Exec(c.Request.Context(), "DELETE FROM tasks WHERE id = $1", idStr)
	response.SuccessWithMessage(c, "Task deleted successfully", nil)
}

// UploadImage handles POST /api/v1/admin/upload (Saves uploaded task/media image and returns permanent public URL)
func (h *AdminHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		file, err = c.FormFile("image")
	}
	if err != nil || file == nil {
		file, err = c.FormFile("icon_file")
	}
	if err != nil || file == nil {
		response.BadRequest(c, "No image file uploaded")
		return
	}

	_ = os.MkdirAll("./uploads/tasks", os.ModePerm)
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".png"
	}
	filename := fmt.Sprintf("task_%d_%d%s", time.Now().UnixNano()/1e6, rand.Intn(1000), ext)
	dst := filepath.Join("./uploads/tasks", filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to save uploaded file: %v", err))
		return
	}

	publicURL := fmt.Sprintf("https://craftspin.duckdns.org/uploads/tasks/%s", filename)
	response.Success(c, gin.H{
		"url":      publicURL,
		"path":     "/uploads/tasks/" + filename,
		"filename": filename,
		"size":     file.Size,
	})
}

// -------------------------------------------------------------
// CONNECTED TELEGRAM CHANNELS & GROUPS (FOR TASK CREATION)
// -------------------------------------------------------------

// GetConnectedChats handles GET /api/v1/admin/connected-chats
// Pulls all channels & groups connected by the bot so admin can turn them into tasks
func (h *AdminHandler) GetConnectedChats(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, chat_id, type, title, COALESCE(username, ''), COALESCE(invite_link, ''), created_at
		FROM connected_chats
		ORDER BY id DESC
	`)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, chatID int64
		var chatType, title, username, inviteLink, createdAt string
		if err := rows.Scan(&id, &chatID, &chatType, &title, &username, &inviteLink, &createdAt); err == nil {
			list = append(list, gin.H{
				"id":         id,
				"chatId":     chatID,
				"type":       chatType,
				"title":      title,
				"username":   username,
				"inviteLink": inviteLink,
				"createdAt":  createdAt,
			})
		}
	}
	response.Success(c, list)
}

// CreateConnectedChat handles POST /api/v1/admin/connected-chats (Manual linking)
func (h *AdminHandler) CreateConnectedChat(c *gin.Context) {
	var req struct {
		ChatID     int64  `json:"chat_id" binding:"required"`
		Type       string `json:"type"` // 'channel', 'group'
		Title      string `json:"title" binding:"required"`
		Username   string `json:"username"`
		InviteLink string `json:"invite_link"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid chat payload")
		return
	}
	if req.Type == "" {
		req.Type = "channel"
	}

	query := `
		INSERT INTO connected_chats (chat_id, type, title, username, invite_link, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (chat_id) DO UPDATE
		SET title = EXCLUDED.title, username = EXCLUDED.username, invite_link = EXCLUDED.invite_link, type = EXCLUDED.type
		RETURNING id
	`
	var id int64
	err := h.pool.QueryRow(c.Request.Context(), query, req.ChatID, req.Type, req.Title, req.Username, req.InviteLink).Scan(&id)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to link chat: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Telegram channel/group connected successfully", gin.H{
		"id":     id,
		"chatId": req.ChatID,
		"title":  req.Title,
	})
}

// DeleteConnectedChat handles DELETE /api/v1/admin/connected-chats/:id
func (h *AdminHandler) DeleteConnectedChat(c *gin.Context) {
	idStr := c.Param("id")
	_, _ = h.pool.Exec(c.Request.Context(), "DELETE FROM connected_chats WHERE id = $1 OR CAST(chat_id AS TEXT) = $1", idStr)
	response.SuccessWithMessage(c, "Connected channel unlinked successfully", nil)
}

// -------------------------------------------------------------
// RAFFLES & LOTTERIES MANAGEMENT
// -------------------------------------------------------------

// GetRaffles handles GET /api/v1/admin/raffles
func (h *AdminHandler) GetRaffles(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, title, cash_reward, coin_reward_str, ticket_price_gems,
		       COALESCE(ticket_price_usd, 0.50), COALESCE(ticket_price_stars, 25),
		       COALESCE(ticket_gem_price, ticket_price_gems, 200),
		       COALESCE(enable_usd_payment, true), COALESCE(enable_stars_payment, true),
		       COALESCE(enable_gems_payment, true), COALESCE(max_tickets_per_user, 50),
		       COALESCE(total_tickets_sold, total_tickets_count, 0),
		       participants_count, total_tickets_count,
		       CASE WHEN ends_at <= NOW() AND status = 'ongoing' THEN 'ended' ELSE status END as status,
		       ends_at, created_at,
		       COALESCE(prize_tiers, '[]'::jsonb),
		       COALESCE(winners_json, '[]'::jsonb)
		FROM raffles
		ORDER BY created_at DESC
	`)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	list := make([]gin.H, 0)
	for rows.Next() {
		var raffleID, title, coinRewardStr, status string
		var cashReward, ticketPriceUSD float64
		var ticketPriceGems, ticketPriceStars, ticketGemPrice, maxTickets, totalSold, participants, totalTickets int
		var enableUSD, enableStars, enableGems bool
		var endsAt, createdAt time.Time
		var rawTiers, rawWinners []byte

		if err := rows.Scan(
			&raffleID, &title, &cashReward, &coinRewardStr, &ticketPriceGems,
			&ticketPriceUSD, &ticketPriceStars, &ticketGemPrice,
			&enableUSD, &enableStars, &enableGems, &maxTickets, &totalSold,
			&participants, &totalTickets, &status, &endsAt, &createdAt,
			&rawTiers, &rawWinners,
		); err == nil {
			var parsedTiers []model.PrizeTierConfig
			if len(rawTiers) > 0 && string(rawTiers) != "[]" && string(rawTiers) != "null" {
				_ = json.Unmarshal(rawTiers, &parsedTiers)
			}
			var parsedWinners []model.RaffleWinnerResult
			if len(rawWinners) > 0 && string(rawWinners) != "[]" && string(rawWinners) != "null" {
				_ = json.Unmarshal(rawWinners, &parsedWinners)
			}

			list = append(list, gin.H{
				"id":                  raffleID,
				"raffleId":            raffleID,
				"raffle_id":           raffleID,
				"title":               title,
				"cashReward":          cashReward,
				"cash_reward":         cashReward,
				"cashPrizeUsd":        cashReward,
				"cash_prize_usd":      cashReward,
				"coinRewardStr":       coinRewardStr,
				"coin_reward_str":     coinRewardStr,
				"ticketPriceGems":     ticketPriceGems,
				"ticket_price_gems":   ticketPriceGems,
				"ticketPriceUsd":      ticketPriceUSD,
				"ticket_price_usd":    ticketPriceUSD,
				"ticketPriceStars":    ticketPriceStars,
				"ticket_price_stars":  ticketPriceStars,
				"ticketGemPrice":      ticketGemPrice,
				"ticket_gem_price":    ticketGemPrice,
				"enableUsdPayment":    enableUSD,
				"enable_usd_payment":  enableUSD,
				"enableStarsPayment":  enableStars,
				"enable_stars_payment": enableStars,
				"enableGemsPayment":   enableGems,
				"enable_gems_payment": enableGems,
				"maxTicketsPerUser":   maxTickets,
				"max_tickets_per_user": maxTickets,
				"totalTicketsSold":    totalSold,
				"total_tickets_sold":  totalSold,
				"participants":        participants,
				"participants_count":  participants,
				"totalTickets":        totalTickets,
				"total_tickets_count": totalTickets,
				"status":              status,
				"endsAt":              endsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"ends_at":             endsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"createdAt":           createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"created_at":          createdAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
				"prizeTiers":          parsedTiers,
				"prize_tiers":         parsedTiers,
				"winners":             parsedWinners,
			})
		}
	}
	response.Success(c, gin.H{
		"raffles": list,
		"list":    list,
		"items":   list,
		"data":    list,
	})
}

// CreateRaffle handles POST /api/v1/admin/raffles
func (h *AdminHandler) CreateRaffle(c *gin.Context) {
	var req model.AdminCreateRaffleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid raffle payload: "+err.Error())
		return
	}

	if req.RaffleID == "" {
		if req.ID != "" {
			req.RaffleID = req.ID
		} else {
			req.RaffleID = fmt.Sprintf("#VIP%d", time.Now().UnixNano()/1e6%1000000)
		}
	}

	if req.CashReward <= 0 {
		if req.CashPrizeUSD > 0 {
			req.CashReward = req.CashPrizeUSD
		} else {
			req.CashReward = 50.0
		}
	}

	if req.CoinRewardStr == "" {
		req.CoinRewardStr = fmt.Sprintf("$%.2f USDT", req.CashReward)
	}

	if req.TicketPriceUSD <= 0 {
		req.TicketPriceUSD = 0.50
	}
	if req.TicketPriceStars <= 0 {
		req.TicketPriceStars = 25
	}
	if req.TicketGemPrice <= 0 {
		if req.TicketPriceGems > 0 {
			req.TicketGemPrice = req.TicketPriceGems
		} else {
			req.TicketGemPrice = 200
		}
	}
	if req.TicketPriceGems <= 0 {
		req.TicketPriceGems = req.TicketGemPrice
	}

	enableUSD := true
	if req.EnableUSDPayment != nil {
		enableUSD = *req.EnableUSDPayment
	}
	enableStars := true
	if req.EnableStarsPayment != nil {
		enableStars = *req.EnableStarsPayment
	}
	enableGems := true
	if req.EnableGemsPayment != nil {
		enableGems = *req.EnableGemsPayment
	}

	if req.MaxTicketsPerUser <= 0 {
		req.MaxTicketsPerUser = 50
	}

	if req.DurationDays <= 0 {
		req.DurationDays = 7
	}

	var endsAt time.Time
	if req.EndsAt != nil && !req.EndsAt.IsZero() {
		endsAt = *req.EndsAt
	} else {
		endsAt = time.Now().Add(time.Duration(req.DurationDays) * 24 * time.Hour)
	}

	// Setup Prize Tiers
	prizeTiers := req.PrizeTiers
	if len(prizeTiers) == 0 {
		prizeTiers = []model.PrizeTierConfig{
			{Rank: "1st Prize", Medal: "🥇", RewardType: "usd", Amount: req.CashReward * 0.50, AmountStr: fmt.Sprintf("$%.2f", req.CashReward*0.50), Multiplier: "x 1 Winner", WinnersCount: 1, Highlight: true},
			{Rank: "2nd Prize", Medal: "🥈", RewardType: "usd", Amount: req.CashReward * 0.30, AmountStr: fmt.Sprintf("$%.2f", req.CashReward*0.30), Multiplier: "x 2 Winners", WinnersCount: 2, Highlight: false},
			{Rank: "3rd Prize", Medal: "🥉", RewardType: "usd", Amount: req.CashReward * 0.20, AmountStr: fmt.Sprintf("$%.2f", req.CashReward*0.20), Multiplier: "x 6 Winners", WinnersCount: 6, Highlight: false},
			{Rank: "4th Prize", Medal: "💎", RewardType: "diamonds", Amount: 5000, AmountStr: "5,000", Icon: "./assets/purple-diamond.png", Multiplier: "x 20 Winners", WinnersCount: 20, Highlight: false},
			{Rank: "5th Prize", Medal: "💎", RewardType: "diamonds", Amount: 800, AmountStr: "800", Icon: "./assets/purple-diamond.png", Multiplier: "x 100 Winners", WinnersCount: 100, Highlight: false},
		}
	} else {
		for i := range prizeTiers {
			if prizeTiers[i].WinnersCount <= 0 {
				prizeTiers[i].WinnersCount = 1
			}
			if prizeTiers[i].Multiplier == "" {
				if prizeTiers[i].WinnersCount > 1 {
					prizeTiers[i].Multiplier = fmt.Sprintf("x %d Winners", prizeTiers[i].WinnersCount)
				} else {
					prizeTiers[i].Multiplier = "x 1 Winner"
				}
			}
			if prizeTiers[i].AmountStr == "" {
				if prizeTiers[i].RewardType == "diamonds" {
					prizeTiers[i].AmountStr = fmt.Sprintf("%d", int64(prizeTiers[i].Amount))
				} else {
					prizeTiers[i].AmountStr = fmt.Sprintf("$%.2f", prizeTiers[i].Amount)
				}
			}
		}
	}

	tiersJSON, _ := json.Marshal(prizeTiers)

	query := `
		INSERT INTO raffles (
			id, title, cash_reward, coin_reward_str, ticket_price_gems,
			ticket_price_usd, ticket_price_stars, ticket_gem_price,
			enable_usd_payment, enable_stars_payment, enable_gems_payment,
			max_tickets_per_user, total_tickets_sold, total_tickets_count,
			participants_count, status, starts_at, ends_at, created_at,
			prize_tiers
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 0, 0, 'ongoing', NOW(), $13, NOW(), $14)
		ON CONFLICT (id) DO UPDATE SET
			title = EXCLUDED.title,
			cash_reward = EXCLUDED.cash_reward,
			coin_reward_str = EXCLUDED.coin_reward_str,
			ticket_price_gems = EXCLUDED.ticket_price_gems,
			ticket_price_usd = EXCLUDED.ticket_price_usd,
			ticket_price_stars = EXCLUDED.ticket_price_stars,
			ticket_gem_price = EXCLUDED.ticket_gem_price,
			enable_usd_payment = EXCLUDED.enable_usd_payment,
			enable_stars_payment = EXCLUDED.enable_stars_payment,
			enable_gems_payment = EXCLUDED.enable_gems_payment,
			max_tickets_per_user = EXCLUDED.max_tickets_per_user,
			ends_at = EXCLUDED.ends_at,
			prize_tiers = EXCLUDED.prize_tiers
	`
	_, err := h.pool.Exec(
		c.Request.Context(), query,
		req.RaffleID, req.Title, req.CashReward, req.CoinRewardStr, req.TicketPriceGems,
		req.TicketPriceUSD, req.TicketPriceStars, req.TicketGemPrice,
		enableUSD, enableStars, enableGems,
		req.MaxTicketsPerUser, endsAt, tiersJSON,
	)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to save raffle: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Raffle created/updated successfully", gin.H{
		"id":                 req.RaffleID,
		"raffleId":           req.RaffleID,
		"raffle_id":          req.RaffleID,
		"title":              req.Title,
		"cashReward":         req.CashReward,
		"cash_reward":        req.CashReward,
		"ticketPriceUsd":     req.TicketPriceUSD,
		"ticket_price_usd":   req.TicketPriceUSD,
		"ticketPriceStars":   req.TicketPriceStars,
		"ticket_price_stars": req.TicketPriceStars,
		"ticketGemPrice":     req.TicketGemPrice,
		"ticket_gem_price":   req.TicketGemPrice,
		"enableUsdPayment":   enableUSD,
		"enable_usd_payment": enableUSD,
		"enableStarsPayment": enableStars,
		"enable_stars_payment": enableStars,
		"enableGemsPayment":  enableGems,
		"enable_gems_payment": enableGems,
		"maxTicketsPerUser":  req.MaxTicketsPerUser,
		"max_tickets_per_user": req.MaxTicketsPerUser,
		"endsAt":             endsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"ends_at":            endsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"prizeTiers":         prizeTiers,
		"prize_tiers":        prizeTiers,
	})
}

// DrawRaffleWinner handles POST /api/v1/admin/raffles/:id/draw
func (h *AdminHandler) DrawRaffleWinner(c *gin.Context) {
	raffleID := c.Param("id")
	if raffleID == "" {
		response.BadRequest(c, "Raffle ID is required")
		return
	}
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")

	raffleRepo := repository.NewRaffleRepository(h.pool)

	// 1. Fetch raffle details
	var title, status string
	var cashReward float64
	var rawTiers []byte
	query := `
		SELECT id, title, cash_reward, status, COALESCE(prize_tiers, '[]'::jsonb)
		FROM raffles
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
	`
	var matchedID string
	err := h.pool.QueryRow(c.Request.Context(), query, raffleID, cleanID).Scan(&matchedID, &title, &cashReward, &status, &rawTiers)
	if err != nil {
		response.NotFound(c, "Raffle not found")
		return
	}

	// 2. Fetch ticket holders
	holders, err := raffleRepo.GetUserTicketHolders(c.Request.Context(), raffleID)
	if err != nil {
		response.InternalError(c, "Failed to query participants: "+err.Error())
		return
	}
	if len(holders) == 0 {
		response.BadRequest(c, "No tickets found for this raffle. Cannot draw winners.")
		return
	}

	// 3. Parse prize tiers
	var tiers []model.PrizeTierConfig
	if len(rawTiers) > 0 && string(rawTiers) != "[]" && string(rawTiers) != "null" {
		_ = json.Unmarshal(rawTiers, &tiers)
	}
	if len(tiers) == 0 {
		tiers = []model.PrizeTierConfig{
			{Rank: "1st Prize", Medal: "🥇", RewardType: "usd", Amount: cashReward * 0.50, AmountStr: fmt.Sprintf("$%.2f", cashReward*0.50), Multiplier: "x 1 Winner", WinnersCount: 1, Highlight: true},
			{Rank: "2nd Prize", Medal: "🥈", RewardType: "usd", Amount: cashReward * 0.30, AmountStr: fmt.Sprintf("$%.2f", cashReward*0.30), Multiplier: "x 2 Winners", WinnersCount: 2, Highlight: false},
			{Rank: "3rd Prize", Medal: "🥉", RewardType: "usd", Amount: cashReward * 0.20, AmountStr: fmt.Sprintf("$%.2f", cashReward*0.20), Multiplier: "x 6 Winners", WinnersCount: 6, Highlight: false},
			{Rank: "4th Prize", Medal: "💎", RewardType: "diamonds", Amount: 5000, AmountStr: "5,000", Icon: "./assets/purple-diamond.png", Multiplier: "x 20 Winners", WinnersCount: 20, Highlight: false},
			{Rank: "5th Prize", Medal: "💎", RewardType: "diamonds", Amount: 800, AmountStr: "800", Icon: "./assets/purple-diamond.png", Multiplier: "x 100 Winners", WinnersCount: 100, Highlight: false},
		}
	}

	// 4. Weighted random selection
	rGen := rand.New(rand.NewSource(time.Now().UnixNano()))
	candidatePool := make([]repository.TicketHolder, len(holders))
	copy(candidatePool, holders)

	var winnersList []model.RaffleWinnerResult
	nowStr := time.Now().UTC().Format(time.RFC3339)

	for _, tier := range tiers {
		count := tier.WinnersCount
		if count <= 0 {
			count = 1
		}

		for w := 0; w < count; w++ {
			if len(candidatePool) == 0 {
				// If we ran out of unique candidates, stop to prevent assigning multiple duplicate prizes
				break
			}

			// Calculate total ticket weight of current candidate pool
			totalWeight := 0
			for _, ch := range candidatePool {
				totalWeight += ch.TicketCount
			}
			if totalWeight <= 0 {
				break
			}

			targetWeight := rGen.Intn(totalWeight)
			accum := 0
			winnerIdx := 0
			for idx, ch := range candidatePool {
				accum += ch.TicketCount
				if accum > targetWeight {
					winnerIdx = idx
					break
				}
			}

			chosen := candidatePool[winnerIdx]

			// Remove chosen from candidatePool so unique users win each tier slot
			candidatePool = append(candidatePool[:winnerIdx], candidatePool[winnerIdx+1:]...)

			displayName := chosen.FirstName
			if displayName == "" {
				displayName = "Lucky Spinner"
			}

			prizeStr := tier.AmountStr
			if prizeStr == "" {
				if tier.RewardType == "diamonds" {
					prizeStr = fmt.Sprintf("%d Diamonds", int64(tier.Amount))
				} else {
					prizeStr = fmt.Sprintf("$%.2f USDT", tier.Amount)
				}
			}

			// Credit prize
			if tier.RewardType == "diamonds" {
				diamondsGain := int64(tier.Amount)
				_, _ = h.userRepo.MutateBalances(c.Request.Context(), chosen.UserID, 0, diamondsGain, 0, 0)
				_ = h.txRepo.Create(c.Request.Context(), &model.Transaction{
					UserID:         chosen.UserID,
					Category:       "raffles",
					Title:          fmt.Sprintf("Raffle %s Winner (%s)", tier.Rank, matchedID),
					AmountDiamonds: diamondsGain,
					Status:         "completed",
					ReferenceID:    fmt.Sprintf("WIN-%s-U%d-%d", cleanID, chosen.UserID, time.Now().UnixNano()/1e6),
					Description:    fmt.Sprintf("Won %s in Raffle %s! 🏆", prizeStr, title),
				})
			} else {
				usdGain := tier.Amount
				_, _ = h.userRepo.MutateBalances(c.Request.Context(), chosen.UserID, 0, 0, usdGain, 0)
				_ = h.txRepo.Create(c.Request.Context(), &model.Transaction{
					UserID:      chosen.UserID,
					Category:    "raffles",
					Title:       fmt.Sprintf("Raffle %s Winner (%s)", tier.Rank, matchedID),
					AmountUSD:   usdGain,
					Status:      "completed",
					ReferenceID: fmt.Sprintf("WIN-%s-U%d-%d", cleanID, chosen.UserID, time.Now().UnixNano()/1e6),
					Description: fmt.Sprintf("Won %s in Raffle %s! 🏆", prizeStr, title),
				})
			}

			// Notify via Telegram Bot
			if h.botClient != nil && chosen.TelegramID != 0 {
				winMsg := fmt.Sprintf(
					"🎉 <b>CONGRATULATIONS %s!</b> 🏆\n\n"+
						"🎟️ You have won <b>%s</b> in <b>%s</b>!\n\n"+
						"🎁 <b>Prize:</b> %s\n\n"+
						"🚀 Launch Spin & Win now to view your updated balance!",
					displayName, tier.Rank, title, prizeStr,
				)
				_ = h.botClient.SendMessage(chosen.TelegramID, winMsg, nil)
			}

			winnersList = append(winnersList, model.RaffleWinnerResult{
				TierRank:   tier.Rank,
				UserID:     chosen.UserID,
				TelegramID: chosen.TelegramID,
				Name:       displayName,
				Username:   chosen.Username,
				Prize:      prizeStr,
				RewardType: tier.RewardType,
				Amount:     tier.Amount,
				WonAt:      nowStr,
			})
		}
	}

	// Save winners and mark raffle ended
	winnersBytes, _ := json.Marshal(winnersList)
	_ = raffleRepo.SaveWinnersAndEndRaffle(c.Request.Context(), matchedID, winnersBytes)

	response.SuccessWithMessage(c, fmt.Sprintf("Successfully drawn %d winners across %d prize tiers!", len(winnersList), len(tiers)), gin.H{
		"raffleId":     matchedID,
		"raffle_id":    matchedID,
		"winnersCount": len(winnersList),
		"winners":      winnersList,
		"status":       "ended",
	})
}

// DeleteRaffle handles DELETE /api/v1/admin/raffles/:id
func (h *AdminHandler) DeleteRaffle(c *gin.Context) {
	raffleID := c.Param("id")
	if raffleID == "" {
		response.BadRequest(c, "Raffle ID is required")
		return
	}

	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")

	// Delete associated tickets and raffle
	tx, err := h.pool.Begin(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to start database transaction: "+err.Error())
		return
	}
	defer tx.Rollback(c.Request.Context())

	_, _ = tx.Exec(c.Request.Context(), `
		DELETE FROM raffle_tickets
		WHERE raffle_id = $1 OR raffle_id = ('#' || $1) OR raffle_id = $2 OR raffle_id = ('#' || $2)
	`, raffleID, cleanID)

	tag, err := tx.Exec(c.Request.Context(), `
		DELETE FROM raffles
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
	`, raffleID, cleanID)
	if err != nil {
		response.InternalError(c, "Failed to delete raffle: "+err.Error())
		return
	}

	if tag.RowsAffected() == 0 {
		response.NotFound(c, "Raffle not found")
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		response.InternalError(c, "Failed to commit deletion: "+err.Error())
		return
	}

	response.SuccessWithMessage(c, "Raffle and all associated tickets deleted successfully!", gin.H{
		"raffle_id": raffleID,
		"deleted":   true,
	})
}

// EndRaffle handles POST /api/v1/admin/raffles/:id/end
func (h *AdminHandler) EndRaffle(c *gin.Context) {
	raffleID := c.Param("id")
	if raffleID == "" {
		response.BadRequest(c, "Raffle ID is required")
		return
	}

	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	query := `
		UPDATE raffles
		SET status = 'ended'
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
	`
	tag, err := h.pool.Exec(c.Request.Context(), query, raffleID, cleanID)
	if err != nil {
		response.InternalError(c, "Failed to end raffle: "+err.Error())
		return
	}

	if tag.RowsAffected() == 0 {
		response.NotFound(c, "Raffle not found")
		return
	}

	response.SuccessWithMessage(c, "Raffle status changed to ended successfully!", gin.H{
		"raffle_id": raffleID,
		"status":    "ended",
	})
}

// -------------------------------------------------------------
// SUPPORT FEEDBACK INBOX
// -------------------------------------------------------------

// GetFeedbackList handles GET /api/v1/admin/support/feedback
func (h *AdminHandler) GetFeedbackList(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT f.id, COALESCE(f.user_id, 0), COALESCE(u.telegram_id, 0), COALESCE(u.first_name, 'Guest'), COALESCE(u.username, ''),
		       f.email, f.category, f.description, COALESCE(f.screenshot_url, ''), f.status, COALESCE(f.admin_notes, ''), f.created_at, f.resolved_at
		FROM support_tickets f
		LEFT JOIN users u ON u.id = f.user_id
		ORDER BY f.id DESC
		LIMIT 100
	`)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, userID, telegramID int64
		var firstName, username, email, category, description, screenshotURL, status, adminNotes string
		var createdAt time.Time
		var resolvedAt *time.Time

		if err := rows.Scan(&id, &userID, &telegramID, &firstName, &username, &email, &category, &description, &screenshotURL, &status, &adminNotes, &createdAt, &resolvedAt); err == nil {
			isResolved := status == "resolved"
			var resolvedAtStr *string
			if resolvedAt != nil {
				s := resolvedAt.Format(time.RFC3339)
				resolvedAtStr = &s
			}

			list = append(list, gin.H{
				"id":             id,
				"userId":         userID,
				"user_id":        userID,
				"telegramId":     telegramID,
				"telegram_id":    telegramID,
				"userName":       firstName,
				"user_name":      firstName,
				"username":       username,
				"email":          email,
				"category":       category,
				"description":    description,
				"message":        description,
				"screenshotUrl":  screenshotURL,
				"screenshot_url": screenshotURL,
				"status":         status,
				"isResolved":     isResolved,
				"is_resolved":    isResolved,
				"adminNotes":     adminNotes,
				"admin_notes":    adminNotes,
				"createdAt":      createdAt.Format(time.RFC3339),
				"created_at":     createdAt.Format(time.RFC3339),
				"resolvedAt":     resolvedAtStr,
				"resolved_at":    resolvedAtStr,
			})
		}
	}
	response.Success(c, list)
}

// ResolveFeedback handles POST /api/v1/admin/support/feedback/:id/resolve
func (h *AdminHandler) ResolveFeedback(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var req struct {
		AdminNotes   string `json:"admin_notes"`
		ReplyMessage string `json:"reply_message"`
		Notes        string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&req)

	adminNotes := strings.TrimSpace(req.AdminNotes)
	if adminNotes == "" {
		adminNotes = strings.TrimSpace(req.ReplyMessage)
	}
	if adminNotes == "" {
		adminNotes = strings.TrimSpace(req.Notes)
	}
	if adminNotes == "" {
		adminNotes = "Your support ticket has been reviewed and resolved by our support team."
	}

	_, _ = h.pool.Exec(c.Request.Context(), "UPDATE support_tickets SET status = 'resolved', admin_notes = $2, resolved_at = NOW() WHERE id = $1", id, adminNotes)

	// Fetch user info and ticket details for live bot reply notification
	var userID *int64
	var category, description string
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT user_id, category, description FROM support_tickets WHERE id = $1", id).Scan(&userID, &category, &description)

	// Send Telegram bot notification to user if linked
	if userID != nil && *userID > 0 && h.botClient != nil {
		user, _ := h.userRepo.GetByID(c.Request.Context(), *userID)
		if user != nil && user.TelegramID != 0 {
			name := user.FirstName
			if name == "" {
				name = user.Username
			}
			if name == "" {
				name = "Player"
			}

			categoryFormatted := strings.ToUpper(category)
			if category == "" {
				categoryFormatted = "GENERAL SUPPORT"
			}

			notifyText := fmt.Sprintf(
				"📩 <b>Support Ticket Update (Ticket #%d)</b>\n\n"+
					"Hello <b>%s</b>! Our team has reviewed your support request regarding <b>%s</b>.\n\n"+
					"📝 <b>Your Inquiry:</b>\n"+
					"<i>\"%s\"</i>\n\n"+
					"💬 <b>Support Response / Action:</b>\n"+
					"<b>%s</b>\n\n"+
					"Status: ✅ <b>Resolved</b>\n\n"+
					"Thank you for being part of EarnMiniApp! 🙏",
				id, name, categoryFormatted, description, adminNotes,
			)
			_ = h.botClient.SendMessage(user.TelegramID, notifyText, nil)
		}
	}

	response.SuccessWithMessage(c, "Support ticket marked as resolved and user notified via bot", gin.H{
		"id":          id,
		"status":      "resolved",
		"admin_notes": adminNotes,
	})
}

// -------------------------------------------------------------
// WHEEL OF FORTUNE / SPIN PROBABILITY SETTINGS
// -------------------------------------------------------------

// GetWheelSettings handles GET /api/v1/admin/wheel/settings and GET /api/v1/admin/spin/probabilities
func (h *AdminHandler) GetWheelSettings(c *gin.Context) {
	if h.spinService == nil {
		response.InternalError(c, "Spin service unavailable")
		return
	}
	settings, err := h.spinService.GetWheelSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, settings)
}

// UpdateWheelSettings handles POST /api/v1/admin/wheel/settings and POST /api/v1/admin/spin/probabilities
func (h *AdminHandler) UpdateWheelSettings(c *gin.Context) {
	if h.spinService == nil {
		response.InternalError(c, "Spin service unavailable")
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid JSON payload")
		return
	}

	kv := make(map[string]string)
	for k, v := range req {
		valStr := fmt.Sprintf("%v", v)
		switch k {
		case "weight_diamonds", "weight_gem", "wheel_weight_gem":
			kv["wheel_weight_gem"] = valStr
		case "weight_cash", "weight_coins", "wheel_weight_coins":
			kv["wheel_weight_coins"] = valStr
		case "weight_spin_ticket", "wheel_weight_spin_ticket":
			kv["wheel_weight_spin_ticket"] = valStr
		case "weight_double_reward", "wheel_weight_double_reward":
			kv["wheel_weight_double_reward"] = valStr
		case "weight_spin_ticket_2", "wheel_weight_spin_ticket_2":
			kv["wheel_weight_spin_ticket_2"] = valStr
		case "weight_gem_large", "wheel_weight_gem_large":
			kv["wheel_weight_gem_large"] = valStr
		case "diamond_reward", "wheel_diamond_reward":
			kv["wheel_diamond_reward"] = valStr
		case "mega_diamond_reward", "wheel_mega_diamond_reward":
			kv["wheel_mega_diamond_reward"] = valStr
		case "min_cash_reward", "wheel_min_cash_reward":
			kv["wheel_min_cash_reward"] = valStr
		case "max_cash_reward", "wheel_max_cash_reward":
			kv["wheel_max_cash_reward"] = valStr
		}
	}

	updated, err := h.spinService.UpdateWheelSettings(c.Request.Context(), kv)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Wheel probability weights and prize settings updated successfully! 🎡", updated)
}

// -------------------------------------------------------------
// DAILY REWARD & REFERRAL REWARD CONFIGURATIONS
// -------------------------------------------------------------

// GetDailyRewardsSettings handles GET /api/v1/admin/rewards/daily
func (h *AdminHandler) GetDailyRewardsSettings(c *gin.Context) {
	if h.dailyRewardService == nil {
		response.InternalError(c, "Daily reward service unavailable")
		return
	}
	config, err := h.dailyRewardService.GetDailyRewardsConfig(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, config)
}

// UpdateDailyRewardsSettings handles POST /api/v1/admin/rewards/daily
func (h *AdminHandler) UpdateDailyRewardsSettings(c *gin.Context) {
	if h.dailyRewardService == nil {
		response.InternalError(c, "Daily reward service unavailable")
		return
	}

	var req model.DailyRewardsConfigResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid daily rewards payload: 'days' array required")
		return
	}

	updated, err := h.dailyRewardService.UpdateDailyRewardsConfig(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "7-Day Daily Streak rewards updated successfully! 📅", updated)
}

// GetReferralRewardsSettings handles GET /api/v1/admin/rewards/referral and GET /api/v1/admin/referral-settings
func (h *AdminHandler) GetReferralRewardsSettings(c *gin.Context) {
	if h.referralService == nil {
		response.InternalError(c, "Referral service unavailable")
		return
	}
	settings, err := h.referralService.GetReferralRewardSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, settings)
}

// UpdateReferralRewardsSettings handles POST /api/v1/admin/rewards/referral and POST /api/v1/admin/referral-settings
func (h *AdminHandler) UpdateReferralRewardsSettings(c *gin.Context) {
	if h.referralService == nil {
		response.InternalError(c, "Referral service unavailable")
		return
	}

	var req model.ReferralRewardSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid referral rewards payload")
		return
	}

	updated, err := h.referralService.UpdateReferralRewardSettings(c.Request.Context(), req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Referral multi-asset rewards updated successfully! 👥", updated)
}

// -------------------------------------------------------------
// SYSTEM SETTINGS
// -------------------------------------------------------------

// GetSystemSettings handles GET /api/v1/admin/settings
func (h *AdminHandler) GetSystemSettings(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), "SELECT key, value, updated_at FROM system_settings")
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v, updatedAt string
		if err := rows.Scan(&k, &v, &updatedAt); err == nil {
			if k != "master_mnemonic" && k != "master_private_key" { // Exclude sensitive mnemonic from general settings dump
				settings[k] = v
			}
		}
	}

	// Defaults if not set
	if _, ok := settings["fee_percent"]; !ok {
		settings["fee_percent"] = "2.0"
	}
	if _, ok := settings["min_withdraw_usd"]; !ok {
		settings["min_withdraw_usd"] = "1.00"
	}
	if _, ok := settings["min_deposit_usd"]; !ok {
		settings["min_deposit_usd"] = "0.50"
	}

	response.Success(c, settings)
}

// UpdateSystemSettings handles POST /api/v1/admin/settings
func (h *AdminHandler) UpdateSystemSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid settings payload")
		return
	}

	for k, v := range req {
		if k == "master_mnemonic" || k == "master_private_key" {
			continue // Protect sensitive keys
		}
		_, _ = h.pool.Exec(c.Request.Context(), `
			INSERT INTO system_settings (key, value, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`, k, v)
	}

	// If official_channel_id was saved, auto-generate invite link and title if not explicitly set
	if chID, ok := req["official_channel_id"]; ok && chID != "" {
		if req["official_channel_link"] == "" && h.botClient != nil {
			if inv, err := h.botClient.ExportChatInviteLink(chID); err == nil && inv != "" {
				_, _ = h.pool.Exec(c.Request.Context(), `
					INSERT INTO system_settings (key, value, updated_at)
					VALUES ('official_channel_link', $1, NOW())
					ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
				`, inv)
				req["official_channel_link"] = inv
			}
		}
	}

	response.SuccessWithMessage(c, "System settings updated successfully", req)
}

// VerifyAndConnectChannel handles POST /api/v1/admin/settings/verify-channel
func (h *AdminHandler) VerifyAndConnectChannel(c *gin.Context) {
	var req struct {
		ChatID string `json:"chat_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ChatID) == "" {
		response.BadRequest(c, "Telegram Chat ID or @username is required")
		return
	}

	chatID := strings.TrimSpace(req.ChatID)
	if h.botClient == nil {
		response.BadRequest(c, "Telegram Bot client is not initialized")
		return
	}

	// 1. Fetch Chat Info
	chatInfo, chatErr := h.botClient.GetChatByString(chatID)
	title := "Official Channel"
	username := ""
	inviteLink := ""

	if chatInfo != nil {
		if chatInfo.Title != "" {
			title = chatInfo.Title
		}
		if chatInfo.Username != "" {
			username = "@" + strings.TrimPrefix(chatInfo.Username, "@")
		}
		inviteLink = chatInfo.InviteLink
	}

	// 2. Export primary permanent invite link from Telegram
	exportedLink, linkErr := h.botClient.ExportChatInviteLink(chatID)
	if exportedLink != "" {
		inviteLink = exportedLink
	} else if inviteLink == "" && username != "" {
		inviteLink = fmt.Sprintf("https://t.me/%s", strings.TrimPrefix(username, "@"))
	}

	if inviteLink == "" {
		response.BadRequest(c, fmt.Sprintf("Could not generate invite link: %v. Please make sure your Bot is an Administrator in the channel/group!", linkErr))
		return
	}

	response.Success(c, gin.H{
		"chat_id":     chatID,
		"title":       title,
		"username":    username,
		"invite_link": inviteLink,
		"is_admin":    true,
		"error":       chatErr,
	})
}

// -------------------------------------------------------------
// TRAFFIC ANALYTICS & SLIDING GRAPHS
// -------------------------------------------------------------

// GetTrafficAnalytics handles GET /api/v1/admin/analytics/traffic
func (h *AdminHandler) GetTrafficAnalytics(c *gin.Context) {
	rangeStr := c.DefaultQuery("range", "24h")
	analytics, err := h.analyticsService.GetTrafficAnalytics(c.Request.Context(), rangeStr)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, analytics)
}

// -------------------------------------------------------------
// USER DEEP LOOKUP & FULL AUDIT HISTORY
// -------------------------------------------------------------

// LookupUserDetail handles GET /api/v1/admin/users/lookup?query=...
func (h *AdminHandler) LookupUserDetail(c *gin.Context) {
	queryStr := c.Query("query")
	if queryStr == "" {
		queryStr = c.Query("q")
	}
	if queryStr == "" {
		queryStr = c.Query("search")
	}
	if queryStr == "" {
		queryStr = c.Query("id")
	}
	if queryStr == "" {
		queryStr = c.Query("username")
	}
	queryStr = strings.TrimPrefix(strings.TrimSpace(queryStr), "@")

	if queryStr == "" {
		response.BadRequest(c, "Query parameter (User ID, Telegram ID, or Username) is required")
		return
	}

	ctx := c.Request.Context()
	var user model.User
	var tonWallet, photoURL, referrerName string
	var referrerID *int64

	// Search by ID, Telegram ID, or Username
	query := `
		SELECT u.id, u.telegram_id, u.username, u.first_name, u.level, u.energy, u.spins, u.diamonds, u.balance_usd,
		       COALESCE(u.ton_wallet, ''), COALESCE(u.photo_url, ''), u.is_premium, u.is_banned, u.referrer_id,
		       COALESCE(r.first_name, ''), u.created_at
		FROM users u
		LEFT JOIN users r ON r.id = u.referrer_id
		WHERE u.username ILIKE $1 OR CAST(u.telegram_id AS TEXT) = $1 OR CAST(u.id AS TEXT) = $1
		LIMIT 1
	`
	err := h.pool.QueryRow(ctx, query, queryStr).Scan(
		&user.ID, &user.TelegramID, &user.Username, &user.FirstName, &user.Level, &user.Energy,
		&user.Spins, &user.Diamonds, &user.BalanceUSD, &tonWallet, &photoURL,
		&user.IsPremium, &user.IsBanned, &referrerID, &referrerName, &user.CreatedAt,
	)
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}

	// 1. Aggregations: Deposits & Withdrawals
	var totalDepositsUSD float64
	var depositsCount int
	_ = h.pool.QueryRow(ctx, "SELECT COALESCE(SUM(amount_usd), 0), COUNT(id) FROM invoices WHERE user_id = $1 AND status = 'paid'", user.ID).Scan(&totalDepositsUSD, &depositsCount)

	var totalWithdrawalsUSD, totalNetPaidUSD float64
	var withdrawalsCount int
	_ = h.pool.QueryRow(ctx, "SELECT COALESCE(SUM(amount_usd), 0), COALESCE(SUM(net_payout_usd), 0), COUNT(id) FROM withdrawals WHERE user_id = $1 AND status = 'completed'", user.ID).Scan(&totalWithdrawalsUSD, &totalNetPaidUSD, &withdrawalsCount)

	// 2. Aggregations: Total Referrals
	var referralCount int
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(id) FROM users WHERE referrer_id = $1", user.ID).Scan(&referralCount)

	// 3. Recent 50 Transaction Records
	rows, _ := h.pool.Query(ctx, `
		SELECT id, category, title, amount_usd, amount_diamonds, amount_spins, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
		FROM transactions
		WHERE user_id = $1
		ORDER BY id DESC
		LIMIT 50
	`, user.ID)
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()

	var txHistory []gin.H
	if rows != nil {
		for rows.Next() {
			var txID int64
			var cat, title, status, refID, txHash, desc, createdAt string
			var usd float64
			var diamonds int64
			var spins int
			if err := rows.Scan(&txID, &cat, &title, &usd, &diamonds, &spins, &status, &refID, &txHash, &desc, &createdAt); err == nil {
				txHistory = append(txHistory, gin.H{
					"id":             txID,
					"category":       cat,
					"title":          title,
					"amountUsd":      usd,
					"amountDiamonds": diamonds,
					"amountSpins":    spins,
					"status":         status,
					"referenceId":    refID,
					"txHash":         txHash,
					"description":    desc,
					"createdAt":      createdAt,
				})
			}
		}
	}

	response.Success(c, gin.H{
		"user": gin.H{
			"id":           user.ID,
			"telegramId":   user.TelegramID,
			"username":     user.Username,
			"firstName":    user.FirstName,
			"level":        user.Level,
			"energy":       user.Energy,
			"spins":        user.Spins,
			"diamonds":     user.Diamonds,
			"balanceUsd":   user.BalanceUSD,
			"tonWallet":    tonWallet,
			"photoUrl":     photoURL,
			"isPremium":    user.IsPremium,
			"isBanned":     user.IsBanned,
			"referrerId":   referrerID,
			"referrerName": referrerName,
			"createdAt":    user.CreatedAt,
		},
		"financialSummary": gin.H{
			"totalDepositsUSD":    totalDepositsUSD,
			"completedInvoices":   depositsCount,
			"totalWithdrawalsUSD": totalWithdrawalsUSD,
			"totalNetPaidUSD":     totalNetPaidUSD,
			"completedPayouts":    withdrawalsCount,
			"totalReferrals":      referralCount,
		},
		"recentTransactions": txHistory,
	})
}

// -------------------------------------------------------------
// INVOICE DEEP-INSPECTION
// -------------------------------------------------------------

// InspectInvoice handles GET /api/v1/admin/invoices/inspect?query=...
func (h *AdminHandler) InspectInvoice(c *gin.Context) {
	queryStr := c.Query("query")
	if queryStr == "" {
		response.BadRequest(c, "Invoice ID, Deposit Address, or Tx Hash is required")
		return
	}

	ctx := c.Request.Context()
	var inv model.Invoice
	var username, firstName string
	var telegramID int64
	var txHash, sweepTxHash *string

	query := `
		SELECT i.id, i.invoice_id, i.user_id, u.telegram_id, u.username, u.first_name,
		       i.wallet_index, i.deposit_address, i.amount_usd, i.purpose, COALESCE(i.reference_id, ''),
		       i.status, i.sweep_status, i.tx_hash, i.sweep_tx_hash, i.expires_at, i.created_at, i.paid_at
		FROM invoices i
		JOIN users u ON u.id = i.user_id
		WHERE i.invoice_id = $1 OR LOWER(i.deposit_address) = LOWER($1) OR i.tx_hash = $1 OR i.sweep_tx_hash = $1
		LIMIT 1
	`
	err := h.pool.QueryRow(ctx, query, queryStr).Scan(
		&inv.ID, &inv.InvoiceID, &inv.UserID, &telegramID, &username, &firstName,
		&inv.WalletIndex, &inv.DepositAddress, &inv.AmountUSD, &inv.Purpose, &inv.ReferenceID,
		&inv.Status, &inv.SweepStatus, &txHash, &sweepTxHash, &inv.ExpiresAt, &inv.CreatedAt, &inv.PaidAt,
	)
	if err != nil {
		response.NotFound(c, "Invoice record not found")
		return
	}

	feeUSD := inv.AmountUSD * 0.02
	netUSD := inv.AmountUSD - feeUSD

	depositBscScan := ""
	if txHash != nil && *txHash != "" {
		depositBscScan = fmt.Sprintf("https://bscscan.com/tx/%s", *txHash)
	}

	sweepBscScan := ""
	if sweepTxHash != nil && *sweepTxHash != "" {
		sweepBscScan = fmt.Sprintf("https://bscscan.com/tx/%s", *sweepTxHash)
	}

	response.Success(c, gin.H{
		"invoiceId":   inv.InvoiceID,
		"status":      inv.Status,
		"sweepStatus": inv.SweepStatus,
		"user": gin.H{
			"userId":     inv.UserID,
			"telegramId": telegramID,
			"username":   username,
			"firstName":  firstName,
		},
		"depositAddress": inv.DepositAddress,
		"walletIndex":    inv.WalletIndex,
		"derivationPath": fmt.Sprintf("m/44'/60'/0'/0/%d", inv.WalletIndex),
		"amount": gin.H{
			"grossUsd":       inv.AmountUSD,
			"platformFeeUsd": feeUSD,
			"feePercent":     2.0,
			"netCreditedUsd": netUSD,
		},
		"purpose":     inv.Purpose,
		"referenceId": inv.ReferenceID,
		"blockchain": gin.H{
			"depositTxHash":  txHash,
			"depositBscScan": depositBscScan,
			"sweepTxHash":    sweepTxHash,
			"sweepBscScan":   sweepBscScan,
		},
		"timestamps": gin.H{
			"createdAt": inv.CreatedAt,
			"expiresAt": inv.ExpiresAt,
			"paidAt":    inv.PaidAt,
		},
	})
}

// -------------------------------------------------------------
// WHEEL CONFIG & DYNAMIC ODDS
// -------------------------------------------------------------

// GetWheelConfig handles GET /api/v1/admin/wheel/config
func (h *AdminHandler) GetWheelConfig(c *gin.Context) {
	var rawJSON string
	err := h.pool.QueryRow(c.Request.Context(), "SELECT value FROM system_settings WHERE key = 'wheel_segments_config'").Scan(&rawJSON)
	if err != nil || rawJSON == "" {
		// Return default segments
		response.Success(c, gin.H{
			"segments":          model.DefaultWheelSegments,
			"spinsToDollarGoal": 18,
		})
		return
	}
	response.Success(c, gin.H{
		"configJson":        rawJSON,
		"spinsToDollarGoal": 18,
	})
}

// UpdateWheelConfig handles POST /api/v1/admin/wheel/config
func (h *AdminHandler) UpdateWheelConfig(c *gin.Context) {
	var req struct {
		ConfigJSON        string `json:"config_json" binding:"required"`
		SpinsToDollarGoal int    `json:"spins_to_dollar_goal"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid wheel configuration payload")
		return
	}

	_, _ = h.pool.Exec(c.Request.Context(), `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ('wheel_segments_config', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, req.ConfigJSON)

	response.SuccessWithMessage(c, "Spin wheel configuration and odds updated successfully", nil)
}

// -------------------------------------------------------------
// ADSGRAM REWARDED ADS CONFIG
// -------------------------------------------------------------

// GetAdsConfig handles GET /api/v1/admin/ads/config
func (h *AdminHandler) GetAdsConfig(c *gin.Context) {
	var enabledStr, blockID string
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT value FROM system_settings WHERE key = 'adsgram_enabled'").Scan(&enabledStr)
	_ = h.pool.QueryRow(c.Request.Context(), "SELECT value FROM system_settings WHERE key = 'adsgram_block_id'").Scan(&blockID)

	response.Success(c, gin.H{
		"adsgramEnabled": enabledStr == "true",
		"blockId":        blockID,
	})
}

// UpdateAdsConfig handles POST /api/v1/admin/ads/config
func (h *AdminHandler) UpdateAdsConfig(c *gin.Context) {
	var req struct {
		Enabled bool   `json:"enabled"`
		BlockID string `json:"block_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid ads config payload")
		return
	}

	enStr := "false"
	if req.Enabled {
		enStr = "true"
	}

	_, _ = h.pool.Exec(c.Request.Context(), `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ('adsgram_enabled', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, enStr)

	_, _ = h.pool.Exec(c.Request.Context(), `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ('adsgram_block_id', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, req.BlockID)

	response.SuccessWithMessage(c, "Adsgram configuration updated successfully", req)
}

// -------------------------------------------------------------
// DUAL CONTESTS (REFERRALS & SPINS)
// -------------------------------------------------------------

// GetContests handles GET /api/v1/admin/contests
func (h *AdminHandler) GetContests(c *gin.Context) {
	contests, err := h.contestRepo.GetAllContests(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, contests)
}

// CreateContest handles POST /api/v1/admin/contests
func (h *AdminHandler) CreateContest(c *gin.Context) {
	var req model.CreateContestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, fmt.Sprintf("Invalid contest payload: %v", err))
		return
	}

	if req.Type != "spins" && req.Type != "referrals" {
		response.BadRequest(c, "Invalid contest type: must be 'spins' or 'referrals'")
		return
	}

	if h.contestService != nil {
		contest, err := h.contestService.CreateOrUpdateContest(c.Request.Context(), &req)
		if err != nil {
			response.InternalError(c, fmt.Sprintf("Failed to save contest: %v", err))
			return
		}
		response.SuccessWithMessage(c, "Contest tournament created/updated successfully", contest)
		return
	}

	durationDays := req.DurationDays
	if durationDays <= 0 {
		durationDays = 7
	}

	startsAt := time.Now().UTC()
	if req.StartsAt != nil {
		startsAt = *req.StartsAt
	}

	endsAt := startsAt.Add(time.Duration(durationDays) * 24 * time.Hour)
	if req.EndsAt != nil {
		endsAt = *req.EndsAt
	}

	prizePoolStr := req.PrizePoolStr
	if prizePoolStr == "" {
		prizePoolStr = fmt.Sprintf("$%.2f USDT", req.PrizePoolUSD)
	}

	icon := req.Icon
	if icon == "" {
		if req.Type == "spins" {
			icon = "./assets/wheel-of-fortune.png"
		} else {
			icon = "./assets/inviteFeatureCardIcon.png"
		}
	}

	contest := &model.Contest{
		ContestID:         req.ContestID,
		Type:              req.Type,
		Title:             req.Title,
		PrizePoolUSD:      req.PrizePoolUSD,
		PrizePoolStr:      prizePoolStr,
		Icon:              icon,
		PrizeDistribution: req.PrizeDistribution,
		StartsAt:          startsAt,
		EndsAt:            endsAt,
		Status:            "active",
		IsActive:          true,
	}

	if err := h.contestRepo.Create(c.Request.Context(), contest); err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to create contest: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Contest tournament created successfully", contest)
}

// UpdateContest handles PUT /api/v1/admin/contests/:id
func (h *AdminHandler) UpdateContest(c *gin.Context) {
	contestID := c.Param("id")
	var req model.UpdateContestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, fmt.Sprintf("Invalid update payload: %v", err))
		return
	}

	if err := h.contestRepo.Update(c.Request.Context(), contestID, &req); err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to update contest: %v", err))
		return
	}

	updated, _ := h.contestRepo.GetByID(c.Request.Context(), contestID)
	response.SuccessWithMessage(c, "Contest tournament updated successfully", updated)
}

// DeleteContest handles DELETE /api/v1/admin/contests/:id
func (h *AdminHandler) DeleteContest(c *gin.Context) {
	contestID := c.Param("id")
	if err := h.contestRepo.Delete(c.Request.Context(), contestID); err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to delete contest: %v", err))
		return
	}
	response.SuccessWithMessage(c, "Contest tournament deleted successfully", gin.H{"contestId": contestID})
}

// DistributeContestPrizes handles POST /api/v1/admin/contests/:id/distribute-prizes
func (h *AdminHandler) DistributeContestPrizes(c *gin.Context) {
	contestID := c.Param("id")
	distributedWinners, err := h.contestService.DistributePrizes(c.Request.Context(), contestID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to distribute prizes: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Contest finalized and prizes credited to winners' balances! 🏆", gin.H{
		"contestId": contestID,
		"status":    "ended",
		"winners":   distributedWinners,
		"count":     len(distributedWinners),
	})
}

// ExportUsersCSV handles GET /api/v1/admin/export/users.csv
func (h *AdminHandler) ExportUsersCSV(c *gin.Context) {
	ctx := c.Request.Context()
	query := `
		SELECT id, telegram_id, username, first_name, COALESCE(photo_url, ''), level, spins, diamonds, balance_usd, COALESCE(ton_wallet, ''), is_banned, created_at
		FROM users
		ORDER BY id ASC
	`
	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to query users: %v", err))
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=users_export_%s.csv", time.Now().Format("20060102_150405")))

	c.Writer.WriteString("User ID,Telegram ID,Username,First Name,Photo URL,Level,Spins,Diamonds,Balance USD,BEP-20 Wallet,Is Banned,Registered At\n")

	for rows.Next() {
		var id, tgID, diamonds int64
		var level, spins int
		var username, firstName, photoURL, wallet string
		var usd float64
		var isBanned bool
		var createdAt time.Time

		if err := rows.Scan(&id, &tgID, &username, &firstName, &photoURL, &level, &spins, &diamonds, &usd, &wallet, &isBanned, &createdAt); err == nil {
			line := fmt.Sprintf("%d,%d,\"%s\",\"%s\",\"%s\",%d,%d,%d,%.4f,\"%s\",%t,\"%s\"\n",
				id, tgID,
				strings.ReplaceAll(username, "\"", "\"\""),
				strings.ReplaceAll(firstName, "\"", "\"\""),
				photoURL, level, spins, diamonds, usd, wallet, isBanned,
				createdAt.Format(time.RFC3339),
			)
			c.Writer.WriteString(line)
		}
	}
	c.Writer.Flush()
}

// ExportWithdrawalsCSV handles GET /api/v1/admin/export/withdrawals.csv
func (h *AdminHandler) ExportWithdrawalsCSV(c *gin.Context) {
	ctx := c.Request.Context()
	query := `
		SELECT w.id, w.user_id, COALESCE(u.telegram_id, 0), COALESCE(u.username, ''), w.amount_usd, w.fee_usd, w.net_payout_usd, w.ton_address, w.status, COALESCE(w.tx_hash, ''), w.created_at
		FROM withdrawals w
		LEFT JOIN users u ON w.user_id = u.id
		ORDER BY w.id DESC
	`
	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to query withdrawals: %v", err))
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=withdrawals_export_%s.csv", time.Now().Format("20060102_150405")))

	c.Writer.WriteString("Withdrawal ID,User ID,Telegram ID,Username,Gross USD,2% Fee USD,Net Payout USD,Recipient BEP-20 Address,Status,On-Chain Tx Hash,Timestamp\n")

	for rows.Next() {
		var id, userID, tgID int64
		var username, address, status, txHash string
		var gross, fee, net float64
		var createdAt time.Time

		if err := rows.Scan(&id, &userID, &tgID, &username, &gross, &fee, &net, &address, &status, &txHash, &createdAt); err == nil {
			line := fmt.Sprintf("%d,%d,%d,\"%s\",%.2f,%.2f,%.2f,\"%s\",\"%s\",\"%s\",\"%s\"\n",
				id, userID, tgID,
				strings.ReplaceAll(username, "\"", "\"\""),
				gross, fee, net, address, status, txHash,
				createdAt.Format(time.RFC3339),
			)
			c.Writer.WriteString(line)
		}
	}
	c.Writer.Flush()
}

// GenerateExportTempLink handles POST /api/v1/admin/export/temp-link
func (h *AdminHandler) GenerateExportTempLink(c *gin.Context) {
	var req struct {
		ExportType string `json:"export_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid payload: export_type is required (withdrawals, users, gift-codes, batches)")
		return
	}

	cleanType := strings.ToLower(strings.TrimSpace(req.ExportType))
	cleanType = strings.TrimSuffix(cleanType, ".csv")

	token, err := h.jwtManager.GenerateExportToken(cleanType, 5*time.Minute)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to generate export token: %v", err))
		return
	}

	baseURL := ""
	if h.cfg != nil {
		baseURL = h.cfg.ServerBaseURL
	}
	if baseURL == "" {
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		baseURL = fmt.Sprintf("%s://%s", scheme, c.Request.Host)
	}
	baseURL = strings.TrimRight(baseURL, "/")

	downloadURL := fmt.Sprintf("%s/api/v1/admin/export/%s.csv?token=%s", baseURL, cleanType, token)

	response.Success(c, gin.H{
		"token":        token,
		"downloadUrl":  downloadURL,
		"download_url": downloadURL,
		"exportType":   cleanType,
		"export_type":  cleanType,
		"expiresIn":    300,
		"expires_in":   300,
	})
}

// ExportGiftCodesCSV handles GET /api/v1/admin/export/gift-codes.csv
func (h *AdminHandler) ExportGiftCodesCSV(c *gin.Context) {
	ctx := c.Request.Context()
	query := `
		SELECT id, code, COALESCE(batch_id, ''), COALESCE(batch_name, ''), reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, is_active, expires_at, created_at
		FROM gift_codes
		ORDER BY id DESC
	`
	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to query gift codes: %v", err))
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=gift_codes_export_%s.csv", time.Now().Format("20060102_150405")))

	c.Writer.WriteString("ID,Code,Batch ID,Batch Name,Reward Diamonds,Reward Spins,Reward USD,Max Claims,Current Claims,Is Active,Expires At,Created At\n")

	for rows.Next() {
		var id int64
		var code, batchID, batchName string
		var diamonds int64
		var spins, maxClaims, currentClaims int
		var usd float64
		var isActive bool
		var expiresAt *time.Time
		var createdAt time.Time

		if err := rows.Scan(&id, &code, &batchID, &batchName, &diamonds, &spins, &usd, &maxClaims, &currentClaims, &isActive, &expiresAt, &createdAt); err == nil {
			expStr := ""
			if expiresAt != nil {
				expStr = expiresAt.Format(time.RFC3339)
			}
			line := fmt.Sprintf("%d,\"%s\",\"%s\",\"%s\",%d,%d,%.2f,%d,%d,%t,\"%s\",\"%s\"\n",
				id,
				strings.ReplaceAll(code, "\"", "\"\""),
				strings.ReplaceAll(batchID, "\"", "\"\""),
				strings.ReplaceAll(batchName, "\"", "\"\""),
				diamonds, spins, usd, maxClaims, currentClaims, isActive,
				expStr, createdAt.Format(time.RFC3339),
			)
			c.Writer.WriteString(line)
		}
	}
	c.Writer.Flush()
}

// ExportBatchesCSV handles GET /api/v1/admin/export/batches.csv
func (h *AdminHandler) ExportBatchesCSV(c *gin.Context) {
	ctx := c.Request.Context()
	query := `
		SELECT 
			batch_id,
			MAX(batch_name) as batch_name,
			COUNT(id) as total_codes,
			COUNT(id) FILTER (WHERE current_claims > 0) as claimed_codes,
			COUNT(id) FILTER (WHERE current_claims = 0) as unclaimed_codes,
			MAX(reward_diamonds) as reward_diamonds,
			MAX(reward_spins) as reward_spins,
			MAX(reward_usd) as reward_usd,
			MAX(expires_at) as expires_at,
			MIN(created_at) as created_at
		FROM gift_codes
		WHERE batch_id IS NOT NULL AND batch_id != ''
		GROUP BY batch_id
		ORDER BY MIN(created_at) DESC
	`
	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to query batches: %v", err))
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=batches_export_%s.csv", time.Now().Format("20060102_150405")))

	c.Writer.WriteString("Batch ID,Batch Name,Total Codes,Claimed Codes,Unclaimed Codes,Reward Diamonds,Reward Spins,Reward USD,Expires At,Created At\n")

	for rows.Next() {
		var batchID, batchName string
		var totalCodes, claimedCodes, unclaimedCodes, spins int
		var diamonds int64
		var usd float64
		var expiresAt *time.Time
		var createdAt time.Time

		if err := rows.Scan(&batchID, &batchName, &totalCodes, &claimedCodes, &unclaimedCodes, &diamonds, &spins, &usd, &expiresAt, &createdAt); err == nil {
			expStr := ""
			if expiresAt != nil {
				expStr = expiresAt.Format(time.RFC3339)
			}
			line := fmt.Sprintf("\"%s\",\"%s\",%d,%d,%d,%d,%d,%.2f,\"%s\",\"%s\"\n",
				strings.ReplaceAll(batchID, "\"", "\"\""),
				strings.ReplaceAll(batchName, "\"", "\"\""),
				totalCodes, claimedCodes, unclaimedCodes,
				diamonds, spins, usd,
				expStr, createdAt.Format(time.RFC3339),
			)
			c.Writer.WriteString(line)
		}
	}
	c.Writer.Flush()
}

// GetFailedTransactions handles GET /api/v1/admin/transactions/failed
func (h *AdminHandler) GetFailedTransactions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	failedTxs, err := h.txRepo.GetFailedTransactions(c.Request.Context(), limit, offset)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to fetch failed transactions: %v", err))
		return
	}

	// Also query any stuck/failed invoices
	var failedInvoices []gin.H
	invRows, _ := h.pool.Query(c.Request.Context(), `
		SELECT id, invoice_id, user_id, deposit_address, amount_usd, status, sweep_status, COALESCE(sweep_tx_hash, ''), expires_at, created_at
		FROM invoices
		WHERE status = 'expired' OR sweep_status IN ('failed', 'stuck', 'retry')
		ORDER BY id DESC
		LIMIT 50
	`)
	if invRows != nil {
		defer invRows.Close()
		for invRows.Next() {
			var id, userID int64
			var invID, addr, status, sweepStatus, sweepTx string
			var amount float64
			var expiresAt, createdAt time.Time
			if err := invRows.Scan(&id, &invID, &userID, &addr, &amount, &status, &sweepStatus, &sweepTx, &expiresAt, &createdAt); err == nil {
				failedInvoices = append(failedInvoices, gin.H{
					"id":             id,
					"invoiceId":      invID,
					"userId":         userID,
					"depositAddress": addr,
					"amountUsd":      amount,
					"status":         status,
					"sweepStatus":    sweepStatus,
					"sweepTxHash":    sweepTx,
					"expiresAt":      expiresAt,
					"createdAt":      createdAt,
				})
			}
		}
	}

	response.Success(c, gin.H{
		"failedTransactions": failedTxs,
		"failedInvoices":     failedInvoices,
		"count":              len(failedTxs) + len(failedInvoices),
	})
}

// ForceSweepInvoice handles POST /api/v1/admin/invoices/:id/force-sweep
func (h *AdminHandler) ForceSweepInvoice(c *gin.Context) {
	invoiceQuery := c.Param("id")
	ctx := c.Request.Context()

	var invID string
	var walletIndex int64
	var depositAddr string
	var amountUSD float64
	var sweepStatus string

	err := h.pool.QueryRow(ctx, `
		SELECT invoice_id, wallet_index, deposit_address, amount_usd, sweep_status
		FROM invoices
		WHERE invoice_id = $1 OR id::text = $1
	`, invoiceQuery).Scan(&invID, &walletIndex, &depositAddr, &amountUSD, &sweepStatus)

	if err != nil {
		response.NotFound(c, "Invoice record not found")
		return
	}

	// Trigger live sweep retry via InvoiceService
	res, sweepErr := h.invoiceService.SweepInvoiceByID(ctx, invID)
	if sweepErr != nil {
		response.BadRequest(c, fmt.Sprintf("Sweep retry failed: %v", sweepErr))
		return
	}

	response.SuccessWithMessage(c, "Invoice BNB gas shot and USDT sweep executed successfully! 🚀", res)
}

// -------------------------------------------------------------
// SUB-ADMIN RBAC MANAGEMENT
// -------------------------------------------------------------

// GetSubAdmins handles GET /api/v1/admin/sub-admins
func (h *AdminHandler) GetSubAdmins(c *gin.Context) {
	if h.subAdminService == nil {
		response.InternalError(c, "Sub-admin service unavailable")
		return
	}

	list, err := h.subAdminService.ListSubAdmins(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, list)
}

// CreateSubAdmin handles POST /api/v1/admin/sub-admins
func (h *AdminHandler) CreateSubAdmin(c *gin.Context) {
	if h.subAdminService == nil {
		response.InternalError(c, "Sub-admin service unavailable")
		return
	}

	var req model.CreateSubAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid sub-admin payload")
		return
	}

	callerID, _ := c.Get("userID")
	var createdBy int64
	if cid, ok := callerID.(int64); ok {
		createdBy = cid
	}

	sa, err := h.subAdminService.CreateSubAdmin(c.Request.Context(), &req, createdBy)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Sub-admin created successfully", sa)
}

// UpdateSubAdmin handles PUT /api/v1/admin/sub-admins/:id
func (h *AdminHandler) UpdateSubAdmin(c *gin.Context) {
	if h.subAdminService == nil {
		response.InternalError(c, "Sub-admin service unavailable")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid sub-admin ID")
		return
	}

	var req model.UpdateSubAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid update payload")
		return
	}

	sa, err := h.subAdminService.UpdateSubAdmin(c.Request.Context(), id, &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Sub-admin updated successfully", sa)
}

// DeleteSubAdmin handles DELETE /api/v1/admin/sub-admins/:id
func (h *AdminHandler) DeleteSubAdmin(c *gin.Context) {
	if h.subAdminService == nil {
		response.InternalError(c, "Sub-admin service unavailable")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid sub-admin ID")
		return
	}

	if err := h.subAdminService.DeleteSubAdmin(c.Request.Context(), id); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Sub-admin removed successfully", gin.H{"id": id})
}

// -------------------------------------------------------------
// BROADCAST SYSTEM & CAMPAIGN MANAGEMENT
// -------------------------------------------------------------

// GetBroadcastJobs handles GET /api/v1/admin/broadcast
func (h *AdminHandler) GetBroadcastJobs(c *gin.Context) {
	if h.broadcastService == nil {
		response.InternalError(c, "Broadcast service unavailable")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	list, total, err := h.broadcastService.ListJobs(c.Request.Context(), limit, offset)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"jobs":   list,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// CreateBroadcastJob handles POST /api/v1/admin/broadcast
func (h *AdminHandler) CreateBroadcastJob(c *gin.Context) {
	if h.broadcastService == nil {
		response.InternalError(c, "Broadcast service unavailable")
		return
	}

	var req model.CreateBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid broadcast payload")
		return
	}
	req.Normalize()
	if req.Message == "" {
		response.BadRequest(c, "Broadcast message is required")
		return
	}

	callerID, _ := c.Get("userID")
	var createdBy int64
	if cid, ok := callerID.(int64); ok {
		createdBy = cid
	}

	job, err := h.broadcastService.CreateJob(c.Request.Context(), &req, createdBy)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Broadcast campaign queued for delivery", job)
}

// GetBroadcastJob handles GET /api/v1/admin/broadcast/:id
func (h *AdminHandler) GetBroadcastJob(c *gin.Context) {
	if h.broadcastService == nil {
		response.InternalError(c, "Broadcast service unavailable")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid broadcast job ID")
		return
	}

	job, err := h.broadcastService.GetJob(c.Request.Context(), id)
	if err != nil || job == nil {
		response.NotFound(c, "Broadcast job not found")
		return
	}

	response.Success(c, job)
}

// CancelBroadcastJob handles POST /api/v1/admin/broadcast/:id/cancel
func (h *AdminHandler) CancelBroadcastJob(c *gin.Context) {
	if h.broadcastService == nil {
		response.InternalError(c, "Broadcast service unavailable")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid broadcast job ID")
		return
	}

	if err := h.broadcastService.CancelJob(c.Request.Context(), id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Broadcast job cancelled successfully", gin.H{"id": id, "status": "cancelled"})
}

// PreviewBroadcast handles POST /api/v1/admin/broadcast/preview
func (h *AdminHandler) PreviewBroadcast(c *gin.Context) {
	if h.broadcastService == nil {
		response.InternalError(c, "Broadcast service unavailable")
		return
	}

	var req model.PreviewBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid preview payload")
		return
	}
	req.Normalize()

	if req.TelegramID == 0 {
		tgIDRaw, exists := c.Get("telegramID")
		if exists {
			if tid, ok := tgIDRaw.(int64); ok && tid != 0 {
				req.TelegramID = tid
			}
		}
	}

	if err := h.broadcastService.SendPreview(c.Request.Context(), &req); err != nil {
		response.BadRequest(c, fmt.Sprintf("Failed to send preview: %v", err))
		return
	}

	response.SuccessWithMessage(c, "Preview broadcast sent to your Telegram account", gin.H{"recipient": req.TelegramID})
}

type pgxRows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}

