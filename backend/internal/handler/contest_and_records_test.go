package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/config"
	"earnminiapp/internal/db"
	"earnminiapp/internal/handler"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"github.com/gin-gonic/gin"
)

func TestActiveContestsAndLeaderboards(t *testing.T) {
	cfg := &config.Config{
		RedisURL: "redis://localhost:6379/0",
	}
	redisService := db.NewRedisService(cfg)
	contestService := service.NewContestService(nil, nil, nil, redisService, nil)

	// 1. Test Active Contests
	activeResp, err := contestService.GetActiveContests(context.Background())
	if err != nil {
		t.Fatalf("Failed to fetch active contests: %v", err)
	}
	if len(activeResp.Contests) < 2 {
		t.Fatalf("Expected at least 2 active contests (spin and referral), got: %d", len(activeResp.Contests))
	}

	// 2. Test Spin Leaderboard (Real mode with 0 players returns clean empty top winners list)
	spinResp, err := contestService.GetSpinLeaderboard(context.Background(), 123)
	if err != nil {
		t.Fatalf("Failed to fetch spin leaderboard: %v", err)
	}
	if spinResp.Category != "spins" || spinResp.ContestID != "spin_weekly" {
		t.Errorf("Unexpected spin leaderboard response: %+v", spinResp)
	}

	// 3. Test Referral Leaderboard
	refResp, err := contestService.GetReferralLeaderboard(context.Background(), 123)
	if err != nil {
		t.Fatalf("Failed to fetch referral leaderboard: %v", err)
	}
	if refResp.Category != "referrals" || refResp.ContestID != "referral_monthly" {
		t.Errorf("Unexpected referral leaderboard response: %+v", refResp)
	}
}

func TestZeroDustGasCalculation(t *testing.T) {
	cfg := &config.Config{
		BscRPCURL:           "",
		BscChainID:          56,
		UsdtContractAddress: "0x55d398326f99059fF775485246999027B3197955",
	}
	client := bsc.NewBSCClient(cfg)

	// Test CalculateMinimumBnbForSweep offline fallback (3 Gwei * 65000 gas = 195,000,000,000,000 Wei = 0.000195 BNB)
	missingWei, err := client.CalculateMinimumBnbForSweep(context.Background(), "0x58c679f291079d3E01a6132712217c4618e7E1d2")
	if err != nil {
		t.Fatalf("Failed to calculate minimum BNB: %v", err)
	}

	expectedWei := big.NewInt(195000000000000)
	if missingWei.Cmp(expectedWei) != 0 {
		t.Errorf("Expected exact zero-dust gas %s Wei, got %s Wei", expectedWei.String(), missingWei.String())
	}
}

func TestToUserResponseWithPhotoURL(t *testing.T) {
	userWithPhoto := &model.User{
		ID:         1,
		TelegramID: 999999,
		FirstName:  "Shebin",
		Username:   "shebin_dev",
		PhotoURL:   "https://t.me/i/userpic/320/avatar.jpg",
		BalanceUSD: 0.45,
		Spins:      5,
		Diamonds:   1200,
	}

	resp := service.ToUserResponse(userWithPhoto)
	if resp.PhotoURL != "https://t.me/i/userpic/320/avatar.jpg" {
		t.Errorf("Expected real photo URL to be preserved, got: %s", resp.PhotoURL)
	}
	if resp.GoalLeft != 0.55 {
		t.Errorf("Expected GoalLeft = 0.55, got: %f", resp.GoalLeft)
	}
}

func TestDynamicContestPrizeTiers(t *testing.T) {
	cfg := &config.Config{
		RedisURL: "redis://localhost:6379/0",
	}
	redisService := db.NewRedisService(cfg)
	_ = redisService.ZAdd(context.Background(), "tournament:spins:current_week", 250, "101")
	_ = redisService.ZAdd(context.Background(), "tournament:spins:current_week", 180, "102")
	_ = redisService.ZAdd(context.Background(), "tournament:spins:current_week", 90, "103")

	contestService := service.NewContestService(nil, nil, nil, redisService, nil)

	spinResp, err := contestService.GetSpinLeaderboard(context.Background(), 101)
	if err != nil {
		t.Fatalf("Failed to fetch dynamic spin leaderboard: %v", err)
	}

	if spinResp.ContestID != "spin_weekly" || spinResp.PrizePool == "" {
		t.Fatalf("Invalid contest leaderboard structure: %+v", spinResp)
	}

	if spinResp.EndsIn == "" || spinResp.EndsTimestamp == 0 {
		t.Errorf("Expected valid countdown deadline, got: %s (%d)", spinResp.EndsIn, spinResp.EndsTimestamp)
	}
}

func TestContestCreateOrUpdateValidation(t *testing.T) {
	contestService := service.NewContestService(nil, nil, nil, nil, nil)

	// Test invalid contest type rejection
	_, err := contestService.CreateOrUpdateContest(context.Background(), &model.CreateContestRequest{
		ContestID: "invalid_contest",
		Type:      "unsupported_type",
		Title:     "Invalid Contest",
	})
	if err == nil {
		t.Errorf("Expected error for invalid contest type")
	}

	// Test DistributePrizes on nil repo
	_, err = contestService.DistributePrizes(context.Background(), "spin_weekly")
	if err == nil {
		t.Errorf("Expected error when repository is unavailable")
	}
}

func TestAlchemyWebhookContractAndUnderpayment(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		UsdtContractAddress: "0x55d398326f99059fF775485246999027B3197955",
	}
	bscClient := bsc.NewBSCClient(cfg)
	webhookHandler := handler.NewWebhookHandler(bscClient, nil, nil, nil, nil)

	router := gin.New()
	router.POST("/api/v1/webhook/alchemy", webhookHandler.HandleAlchemyWebhook)

	// 1. Scam contract token payload
	payload := handler.AlchemyWebhookPayload{
		WebhookID: "wh_test",
		ID:        "evt_1",
		Type:      "ADDRESS_ACTIVITY",
	}
	payload.Event.Network = "BNB_MAINNET"
	actFake := handler.AlchemyActivity{
		FromAddress:     "0xAttacker",
		ToAddress:       "0xVictim",
		Value:           500.0,
		Asset:           "USDT",
		Hash:            "0xScamTxHash",
		ContractAddress: "0xFakeContractAddress1234567890abcdef",
	}
	payload.Event.Activity = []handler.AlchemyActivity{actFake}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/webhook/alchemy", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got: %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["fulfilled"] != float64(0) {
		t.Errorf("expected 0 fulfilled for fake contract address, got: %v", resp["fulfilled"])
	}
}

func TestWalletSubmitWithdrawalValidation(t *testing.T) {
	walletService := service.NewWalletService(nil, nil, nil, nil, nil)

	// Test below minimum withdrawal
	_, err := walletService.SubmitWithdrawal(context.Background(), 101, 0.50)
	if err == nil {
		t.Errorf("Expected error for withdrawal below $1.00 minimum")
	}

	// Test user not found / nil repo
	_, err = walletService.SubmitWithdrawal(context.Background(), 101, 5.00)
	if err == nil {
		t.Errorf("Expected error when user repo is unavailable")
	}
}

