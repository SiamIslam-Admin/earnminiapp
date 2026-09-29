package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type ReferralHandler struct {
	referralService *service.ReferralService
}

func NewReferralHandler(referralService *service.ReferralService) *ReferralHandler {
	return &ReferralHandler{referralService: referralService}
}

// GetTeamStats handles GET /api/v1/team
func (h *ReferralHandler) GetTeamStats(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	stats, err := h.referralService.GetTeamStats(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, stats)
}
