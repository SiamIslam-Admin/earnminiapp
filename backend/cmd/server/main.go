package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/config"
	"earnminiapp/internal/db"
	"earnminiapp/internal/handler"
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/service"
	"earnminiapp/internal/telegram"
	"earnminiapp/pkg/jwt"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

func main() {
	log.Println("══════════════════════════════════════════════════════════════════════")
	log.Println("           STARTING EARN MINI APP BACKEND ENGINE                      ")
	log.Println("══════════════════════════════════════════════════════════════════════")

	// 1. Load Configurations
	cfg := config.LoadConfig()

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. Initialize Database & Cache Layers
	postgresDB, err := db.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("[FATAL] PostgreSQL initialization failed: %v", err)
	}
	defer postgresDB.Close()

	redisService := db.NewRedisService(cfg)
	defer redisService.Close()

	// 3. Initialize BSC (BEP-20) Engine & Utilities
	bscClient := bsc.NewBSCClient(cfg)
	jwtManager := jwt.NewJWTManager(cfg.JWTSecret, cfg.JWTExpirationHours)
	authValidator := telegram.NewAuthValidator(cfg.TelegramBotToken)
	botClient := telegram.NewBotClient(cfg.TelegramBotToken)
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitRequests, time.Duration(cfg.RateLimitWindowSecs)*time.Second)

	// 4. Initialize Repositories
	userRepo := repository.NewUserRepository(postgresDB.Pool)
	txRepo := repository.NewTransactionRepository(postgresDB.Pool)
	dailyRewardRepo := repository.NewDailyRewardRepository(postgresDB.Pool)
	giftCodeRepo := repository.NewGiftCodeRepository(postgresDB.Pool)
	taskRepo := repository.NewTaskRepository(postgresDB.Pool)
	raffleRepo := repository.NewRaffleRepository(postgresDB.Pool)
	walletRepo := repository.NewWalletRepository(postgresDB.Pool)
	supportRepo := repository.NewSupportRepository(postgresDB.Pool)
	invoiceRepo := repository.NewInvoiceRepository(postgresDB.Pool)
	settingsRepo := repository.NewSystemSettingsRepository(postgresDB.Pool)
	contestRepo := repository.NewContestRepository(postgresDB.Pool)
	subAdminRepo := repository.NewSubAdminRepository(postgresDB.Pool)
	broadcastRepo := repository.NewBroadcastRepository(postgresDB.Pool)
	joinRequestRepo := repository.NewJoinRequestRepository(postgresDB.Pool)

	// Sync existing database master wallet mnemonic to bscClient and backup to wallet.json
	if dbMnemonic, _ := settingsRepo.Get(context.Background(), "master_mnemonic"); dbMnemonic != "" {
		_, _ = bscClient.SetMnemonic(dbMnemonic)
	}

	// 5. Initialize Application Services
	userService := service.NewUserService(userRepo, cfg)
	authService := service.NewAuthService(userRepo, txRepo, settingsRepo, authValidator, jwtManager, botClient, cfg)
	spinService := service.NewSpinService(userRepo, txRepo, taskRepo, walletRepo, redisService, settingsRepo)
	dailyRewardService := service.NewDailyRewardService(userRepo, dailyRewardRepo, txRepo, settingsRepo)
	referralService := service.NewReferralService(userRepo, settingsRepo, botClient, cfg)
	contestService := service.NewContestService(userRepo, contestRepo, txRepo, redisService, settingsRepo)
	raffleService := service.NewRaffleService(userRepo, raffleRepo, txRepo, botClient)
	taskService := service.NewTaskService(userRepo, taskRepo, txRepo, joinRequestRepo, botClient)
	giftCodeService := service.NewGiftCodeService(userRepo, giftCodeRepo, txRepo)
	walletService := service.NewWalletService(userRepo, walletRepo, txRepo, settingsRepo, bscClient)
	supportService := service.NewSupportService(supportRepo)
	invoiceService := service.NewInvoiceService(userRepo, invoiceRepo, raffleRepo, txRepo, settingsRepo, bscClient)
	adminService := service.NewAdminService(cfg, settingsRepo, bscClient, jwtManager)
	analyticsService := service.NewAnalyticsService(postgresDB.Pool, redisService)
	subAdminService := service.NewSubAdminService(subAdminRepo, userRepo, cfg)
	broadcastService := service.NewBroadcastService(broadcastRepo, userRepo, botClient)
	channelService := service.NewChannelService(userRepo, settingsRepo, txRepo, joinRequestRepo, botClient)

	// 6. Start Background Workers
	invoicePoller := service.NewInvoicePoller(invoiceRepo, invoiceService, bscClient, 30*time.Second)
	invoicePoller.Start()
	defer invoicePoller.Stop()

	broadcastService.StartWorker(context.Background())

	// 7. Initialize Handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService, channelService)
	spinHandler := handler.NewSpinHandler(spinService)
	dailyRewardHandler := handler.NewDailyRewardHandler(dailyRewardService)
	referralHandler := handler.NewReferralHandler(referralService)
	contestHandler := handler.NewContestHandler(contestService)
	raffleHandler := handler.NewRaffleHandler(raffleService)
	taskHandler := handler.NewTaskHandler(taskService)
	giftCodeHandler := handler.NewGiftCodeHandler(giftCodeService)
	walletHandler := handler.NewWalletHandler(walletService)
	supportHandler := handler.NewSupportHandler(supportService)
	invoiceHandler := handler.NewInvoiceHandler(invoiceService, botClient)
	adminHandler := handler.NewAdminHandler(postgresDB.Pool, userRepo, walletRepo, txRepo, bscClient, botClient, adminService, analyticsService, giftCodeService, invoiceService, spinService, dailyRewardService, referralService, contestRepo, contestService, subAdminService, broadcastService, jwtManager, cfg)
	webhookHandler := handler.NewWebhookHandler(bscClient, invoiceService, invoiceRepo, userRepo, txRepo)
	telegramWebhookHandler := handler.NewTelegramWebhookHandler(postgresDB.Pool, redisService, botClient, userRepo, raffleRepo, txRepo, joinRequestRepo, cfg)

	// 8. Setup Router & Middlewares
	router := gin.New()
	router.Use(middleware.DetailedRequestResponseLogger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.TrafficTrackingMiddleware(redisService))
	router.Use(rateLimiter.Middleware())

	// Static file serving for feedback attachments
	_ = os.MkdirAll("./uploads", os.ModePerm)
	router.Static("/uploads", "./uploads")

	// Health check
	router.GET("/health", func(c *gin.Context) {
		response.SuccessWithMessage(c, "EarnMiniApp Backend Healthy & Operational", gin.H{
			"status":        "UP",
			"timestamp":     time.Now().Unix(),
			"bscConnected":  bscClient.IsReady(),
			"masterAddress": bscClient.GetMasterAddress(),
		})
	})

	// 9. Register API Routes
	apiV1 := router.Group("/api/v1")
	{
		// Public Authentication, Config, Raffles & Webhooks
		apiV1.POST("/auth/telegram", authHandler.TelegramAuth)
		apiV1.GET("/config/ads", adminHandler.GetAdsConfig)
		apiV1.GET("/raffles", raffleHandler.GetRaffles)
		apiV1.GET("/raffles/:id", middleware.OptionalAuthMiddleware(jwtManager), raffleHandler.GetRaffleDetails)
		apiV1.GET("/raffle/:id", middleware.OptionalAuthMiddleware(jwtManager), raffleHandler.GetRaffleDetails)
		apiV1.GET("/contests/active", contestHandler.GetActiveContests)
		apiV1.GET("/contests/spins", middleware.OptionalAuthMiddleware(jwtManager), contestHandler.GetSpinLeaderboard)
		apiV1.GET("/contests/referrals", middleware.OptionalAuthMiddleware(jwtManager), contestHandler.GetReferralLeaderboard)
		apiV1.POST("/support/feedback", middleware.OptionalAuthMiddleware(jwtManager), supportHandler.SubmitFeedback)
		apiV1.POST("/webhook/alchemy", webhookHandler.HandleAlchemyWebhook)
		apiV1.POST("/webhook/telegram", telegramWebhookHandler.HandleTelegramWebhook)

		// Admin Authentication (Public)
		apiV1.POST("/admin/auth", adminHandler.Authenticate)

		// Protected User Routes (JWT)
		protected := apiV1.Group("")
		protected.Use(middleware.AuthMiddleware(jwtManager))
		{
			// Profile & Energy
			protected.GET("/user/profile", userHandler.GetProfile)
			protected.GET("/user/official-channel/status", userHandler.GetOfficialChannelStatus)
			protected.POST("/user/official-channel/verify", userHandler.VerifyOfficialChannelJoin)

			// Server-Authoritative Spin Wheel
			protected.POST("/spin", spinHandler.SpinWheel)
			protected.POST("/spin/wheel", spinHandler.SpinWheel)

			// Daily Rewards Streak (7 Days)
			protected.GET("/daily-rewards", dailyRewardHandler.GetStatus)
			protected.POST("/daily-rewards/claim", dailyRewardHandler.ClaimReward)

			// Referral Team & Channel Verification
			protected.GET("/team", referralHandler.GetTeamStats)
			protected.GET("/referrals", referralHandler.GetTeamStats)

			// Weekly Contest Leaderboard
			protected.GET("/contest/leaderboard", contestHandler.GetLeaderboard)

			// Raffles Claim, Buy & Stars Invoicing
			protected.POST("/raffles/:id/buy", raffleHandler.BuyTickets)
			protected.POST("/raffles/:id/tickets", raffleHandler.BuyTickets)
			protected.POST("/raffles/:id/claim", raffleHandler.ClaimOrBuyTickets)
			protected.POST("/raffles/:id/stars-invoice", raffleHandler.GenerateStarsInvoice)

			// Tasks & Quests
			protected.GET("/tasks", taskHandler.GetTasks)
			protected.POST("/tasks/:id/start", taskHandler.StartTask)
			protected.POST("/tasks/:id/claim", taskHandler.ClaimTask)
			protected.POST("/tasks/:id/verify", taskHandler.VerifyTask)

			// Gift Code Redemption (claim alias kept for frontend compatibility)
			protected.POST("/gift-codes/redeem", giftCodeHandler.RedeemGiftCode)
			protected.POST("/gift-codes/claim", giftCodeHandler.RedeemGiftCode)

			// Wallet & Withdrawals (BEP-20 USDT)
			protected.GET("/wallet", walletHandler.GetWalletInfo)
			protected.POST("/wallet/bind", walletHandler.BindWallet)
			protected.POST("/wallet/withdraw", walletHandler.Withdraw)
			protected.GET("/wallet/records", walletHandler.GetRecords)

			// Invoices & Payments (Crypto & Telegram Stars)
			protected.POST("/invoices/crypto", invoiceHandler.CreateCryptoInvoice)
			protected.POST("/invoices/create", invoiceHandler.CreateCryptoInvoice)
			protected.GET("/invoices/:id/status", invoiceHandler.GetInvoiceStatus)
			protected.GET("/invoices/:id", invoiceHandler.GetInvoiceStatus)
			protected.GET("/invoices/crypto/:id", invoiceHandler.GetInvoiceStatus)
			protected.POST("/telegram/stars/invoice", invoiceHandler.CreateStarsInvoice)
		}

		// Admin Panel Routes (Protected by Admin Auth / Session & SubAdmin RBAC)
		adminGroup := apiV1.Group("/admin")
		adminGroup.Use(middleware.AdminAuthMiddleware(cfg.AdminSecretKey, jwtManager, cfg, subAdminRepo))
		{
			// Live Traffic Analytics & Graphs
			adminGroup.GET("/analytics/traffic", adminHandler.GetTrafficAnalytics)
			adminGroup.GET("/stats/overview", adminHandler.GetOverviewStats)

			// Wallet & Financial Vault
			adminGroup.GET("/wallet-status", adminHandler.GetWalletStatus)
			adminGroup.GET("/financial-stats", adminHandler.GetFinancialStats)
			adminGroup.GET("/payout-settings", adminHandler.GetPayoutSettings)
			adminGroup.POST("/payout-settings", adminHandler.UpdatePayoutSettings)
			adminGroup.POST("/wallet/generate", adminHandler.GenerateMasterWallet)
			adminGroup.POST("/wallet/import", adminHandler.ImportMasterWallet)
			adminGroup.POST("/wallet/confirm-init", adminHandler.ConfirmVaultInitialization)
			adminGroup.GET("/wallet/secrets", adminHandler.ExportVaultSecrets)
			adminGroup.GET("/wallet/export-secrets", adminHandler.DownloadVaultSecretsFile)
			adminGroup.POST("/wallet/transfer", middleware.RequireMainAdmin(), adminHandler.TransferVaultFunds)

			// Invoices Deep-Inspection & Manual Sweep
			adminGroup.GET("/invoices/inspect", adminHandler.InspectInvoice)
			adminGroup.POST("/invoices/:id/force-sweep", adminHandler.ForceSweepInvoice)

			// CSV Data Exports & Signed Temporary Download Links
			adminGroup.POST("/export/temp-link", adminHandler.GenerateExportTempLink)
			adminGroup.GET("/export/users.csv", adminHandler.ExportUsersCSV)
			adminGroup.GET("/export/users", adminHandler.ExportUsersCSV)
			adminGroup.GET("/export/withdrawals.csv", adminHandler.ExportWithdrawalsCSV)
			adminGroup.GET("/export/withdrawals", adminHandler.ExportWithdrawalsCSV)
			adminGroup.GET("/export/gift-codes.csv", adminHandler.ExportGiftCodesCSV)
			adminGroup.GET("/export/gift-codes", adminHandler.ExportGiftCodesCSV)
			adminGroup.GET("/export/batches.csv", adminHandler.ExportBatchesCSV)
			adminGroup.GET("/export/batches", adminHandler.ExportBatchesCSV)

			// Failed Transactions & Stuck Sweeps Auditor
			adminGroup.GET("/transactions/failed", adminHandler.GetFailedTransactions)

			// Withdrawal Cashout Queue & Payouts
			adminGroup.GET("/withdrawals", adminHandler.GetPendingWithdrawals)
			adminGroup.POST("/withdrawals/:id/payout", adminHandler.ProcessWithdrawalPayout)
			adminGroup.POST("/withdrawals/:id/manual-paid", adminHandler.MarkWithdrawalManualPaid)
			adminGroup.POST("/withdrawals/:id/reject", adminHandler.RejectWithdrawal)

			// User Management, Deep Lookup & Support Adjustments
			adminGroup.GET("/users", adminHandler.GetUsers)
			adminGroup.GET("/users/lookup", adminHandler.LookupUserDetail)
			adminGroup.POST("/users/:id/adjust-balance", adminHandler.AdjustUserBalance)
			adminGroup.POST("/users/:id/ban", adminHandler.ToggleBanUser)

			// Wheel Dynamic Odds & Segments
			adminGroup.GET("/wheel/config", adminHandler.GetWheelConfig)
			adminGroup.POST("/wheel/config", adminHandler.UpdateWheelConfig)

			// Adsgram Rewarded Ads Config
			adminGroup.GET("/ads/config", adminHandler.GetAdsConfig)
			adminGroup.POST("/ads/config", adminHandler.UpdateAdsConfig)

			// Bulk Gift Codes Generator & Manager
			adminGroup.GET("/gift-codes", adminHandler.GetGiftCodes)
			adminGroup.POST("/gift-codes", adminHandler.CreateGiftCode)
			adminGroup.POST("/gift-codes/bulk-generate", adminHandler.BulkGenerateGiftCodes)
			adminGroup.GET("/gift-codes/batches", adminHandler.GetGiftCodeBatches)
			adminGroup.GET("/gift-codes/batches/:batch_id", adminHandler.GetBatchCodes)
			adminGroup.GET("/gift-codes/batches/:batch_id/export-csv", adminHandler.ExportBatchCSV)
			adminGroup.DELETE("/gift-codes/batches/:batch_id", adminHandler.DeleteGiftCodeBatch)
			adminGroup.GET("/gift-codes/:id/claims", adminHandler.GetGiftCodeClaimers)
			adminGroup.GET("/gift-codes/:id/export-csv", adminHandler.ExportGiftCodeClaimsCSV)
			adminGroup.DELETE("/gift-codes/:id", adminHandler.DeleteGiftCode)

			// Raffles & Winner Draw
			adminGroup.GET("/raffles", adminHandler.GetRaffles)
			adminGroup.POST("/raffles", adminHandler.CreateRaffle)
			adminGroup.POST("/raffles/:id/draw", adminHandler.DrawRaffleWinner)
			adminGroup.POST("/raffles/:id/end", adminHandler.EndRaffle)
			adminGroup.DELETE("/raffles/:id", adminHandler.DeleteRaffle)

			// Dual Contests Tournaments (Referrals & Spins)
			adminGroup.GET("/contests", adminHandler.GetContests)
			adminGroup.POST("/contests", adminHandler.CreateContest)
			adminGroup.PUT("/contests/:id", adminHandler.UpdateContest)
			adminGroup.DELETE("/contests/:id", adminHandler.DeleteContest)
			adminGroup.POST("/contests/:id/distribute-prizes", adminHandler.DistributeContestPrizes)

			// Support Feedback Inbox
			adminGroup.GET("/support/feedback", adminHandler.GetFeedbackList)
			adminGroup.POST("/support/feedback/:id/resolve", adminHandler.ResolveFeedback)

			// Tasks & Quests Manager (Direct Picture Upload & URL support)
			adminGroup.GET("/tasks", adminHandler.GetTasks)
			adminGroup.POST("/tasks", adminHandler.CreateTask)
			adminGroup.PUT("/tasks/:id", adminHandler.UpdateTask)
			adminGroup.DELETE("/tasks/:id", adminHandler.DeleteTask)
			adminGroup.POST("/upload", adminHandler.UploadImage)

			// Connected Telegram Channels & Groups (Auto-pulled for task creation)
			adminGroup.GET("/connected-chats", adminHandler.GetConnectedChats)
			adminGroup.POST("/connected-chats", adminHandler.CreateConnectedChat)
			adminGroup.DELETE("/connected-chats/:id", adminHandler.DeleteConnectedChat)

			// Dynamic System Settings
			adminGroup.GET("/settings", adminHandler.GetSystemSettings)
			adminGroup.POST("/settings", adminHandler.UpdateSystemSettings)
			adminGroup.POST("/settings/verify-channel", adminHandler.VerifyAndConnectChannel)

			// Wheel of Fortune / Spin Probabilities
			adminGroup.GET("/wheel/settings", adminHandler.GetWheelSettings)
			adminGroup.POST("/wheel/settings", adminHandler.UpdateWheelSettings)
			adminGroup.GET("/spin/probabilities", adminHandler.GetWheelSettings)
			adminGroup.POST("/spin/probabilities", adminHandler.UpdateWheelSettings)

			// 7-Day Daily Streak Rewards Config
			adminGroup.GET("/rewards/daily", adminHandler.GetDailyRewardsSettings)
			adminGroup.POST("/rewards/daily", adminHandler.UpdateDailyRewardsSettings)

			// Referral Multi-Asset Rewards Config
			adminGroup.GET("/rewards/referral", adminHandler.GetReferralRewardsSettings)
			adminGroup.POST("/rewards/referral", adminHandler.UpdateReferralRewardsSettings)
			adminGroup.GET("/referral-settings", adminHandler.GetReferralRewardsSettings)
			adminGroup.POST("/referral-settings", adminHandler.UpdateReferralRewardsSettings)

			// Sub-Admin RBAC Management (Main Administrator Only Guard)
			adminGroup.GET("/sub-admins", middleware.RequireMainAdmin(), adminHandler.GetSubAdmins)
			adminGroup.POST("/sub-admins", middleware.RequireMainAdmin(), adminHandler.CreateSubAdmin)
			adminGroup.PUT("/sub-admins/:id", middleware.RequireMainAdmin(), adminHandler.UpdateSubAdmin)
			adminGroup.DELETE("/sub-admins/:id", middleware.RequireMainAdmin(), adminHandler.DeleteSubAdmin)

			// Broadcast Campaign System & Queue
			adminGroup.GET("/broadcast", adminHandler.GetBroadcastJobs)
			adminGroup.POST("/broadcast", adminHandler.CreateBroadcastJob)
			adminGroup.GET("/broadcast/:id", adminHandler.GetBroadcastJob)
			adminGroup.POST("/broadcast/:id/cancel", adminHandler.CancelBroadcastJob)
			adminGroup.POST("/broadcast/preview", adminHandler.PreviewBroadcast)
		}
	}

	// 10. Automatically Register Telegram Webhook if SERVER_BASE_URL is configured
	if cfg.ServerBaseURL != "" && cfg.TelegramBotToken != "" {
		webhookEndpoint := strings.TrimRight(cfg.ServerBaseURL, "/") + "/api/v1/webhook/telegram"
		if err := botClient.SetWebhook(webhookEndpoint); err != nil {
			log.Printf("[WARN] Failed to auto-register Telegram webhook: %v", err)
		} else {
			log.Printf("[INFO] Telegram webhook registered: %s", webhookEndpoint)
		}
	}

	// 11. Start HTTP Server
	addr := ":" + cfg.ServerPort
	if cfg.ServerPort == "" {
		addr = ":8080"
	}
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[INFO] HTTP server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[INFO] Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Println("[INFO] Server stopped cleanly")
}
