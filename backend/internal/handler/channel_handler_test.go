package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"earnminiapp/internal/handler"
	"earnminiapp/internal/service"
	"github.com/gin-gonic/gin"
)

func TestOfficialChannelEndpointsUnauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)

	channelService := service.NewChannelService(nil, nil, nil, nil, nil)
	userHandler := handler.NewUserHandler(nil, channelService)

	router := gin.New()
	router.GET("/api/v1/user/official-channel/status", userHandler.GetOfficialChannelStatus)
	router.POST("/api/v1/user/official-channel/verify", userHandler.VerifyOfficialChannelJoin)

	// 1. Test GET /status unauthorized without user context
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/user/official-channel/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got: %d", w.Code)
	}

	// 2. Test POST /verify unauthorized without user context
	req2, _ := http.NewRequest(http.MethodPost, "/api/v1/user/official-channel/verify", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got: %d", w2.Code)
	}
}

func TestOfficialChannelGetStatusWithUserContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	channelService := service.NewChannelService(nil, nil, nil, nil, nil)
	userHandler := handler.NewUserHandler(nil, channelService)

	router := gin.New()
	router.GET("/api/v1/user/official-channel/status", func(c *gin.Context) {
		c.Set("userID", int64(12345))
		userHandler.GetOfficialChannelStatus(c)
	})

	req, _ := http.NewRequest(http.MethodGet, "/api/v1/user/official-channel/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got: %d (body: %s)", w.Code, w.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ChannelUsername string `json:"channel_username"`
			RewardSpins     int    `json:"reward_spins"`
			RewardDiamonds  int64  `json:"reward_diamonds"`
		} `json:"data"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success=true")
	}
	if resp.Data.ChannelUsername != "@SpinCraftNews" {
		t.Errorf("expected channel username @SpinCraftNews, got: %s", resp.Data.ChannelUsername)
	}
	if resp.Data.RewardSpins != 3 {
		t.Errorf("expected reward spins 3, got: %d", resp.Data.RewardSpins)
	}
	if resp.Data.RewardDiamonds != 500 {
		t.Errorf("expected reward diamonds 500, got: %d", resp.Data.RewardDiamonds)
	}
}
