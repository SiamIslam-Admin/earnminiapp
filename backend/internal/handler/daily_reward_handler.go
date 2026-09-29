package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type DailyRewardHandler struct {
	dailyRewardService *service.DailyRewardService
}

func NewDailyRewardHandler(dailyRewardService *service.DailyRewardService) *DailyRewardHandler {
	return &DailyRewardHandler{dailyRewardService: dailyRewardService}
}

// GetStatus handles GET /api/v1/daily-rewards
func (h *DailyRewardHandler) GetStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	status, err := h.dailyRewardService.GetStatus(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, status)
}

// ClaimReward handles POST /api/v1/daily-rewards/claim
func (h *DailyRewardHandler) ClaimReward(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req struct {
		IsDouble      bool `json:"is_double"`
		IsDoubleCamel bool `json:"isDouble"`
	}
	_ = c.ShouldBindJSON(&req)
	isDouble := req.IsDouble || req.IsDoubleCamel

	res, err := h.dailyRewardService.ClaimReward(c.Request.Context(), userID, isDouble)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Daily reward claimed successfully", res)
}
