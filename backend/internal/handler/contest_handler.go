package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type ContestHandler struct {
	contestService *service.ContestService
}

func NewContestHandler(contestService *service.ContestService) *ContestHandler {
	return &ContestHandler{contestService: contestService}
}

// GetLeaderboard handles GET /api/v1/contest/leaderboard (Legacy & Default Spin Leaderboard)
func (h *ContestHandler) GetLeaderboard(c *gin.Context) {
	userID := middleware.GetUserID(c)
	leaderboard, err := h.contestService.GetSpinLeaderboard(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, leaderboard)
}

// GetSpinLeaderboard handles GET /api/v1/contests/spins
func (h *ContestHandler) GetSpinLeaderboard(c *gin.Context) {
	userID := middleware.GetUserID(c)
	leaderboard, err := h.contestService.GetSpinLeaderboard(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, leaderboard)
}

// GetReferralLeaderboard handles GET /api/v1/contests/referrals
func (h *ContestHandler) GetReferralLeaderboard(c *gin.Context) {
	userID := middleware.GetUserID(c)
	leaderboard, err := h.contestService.GetReferralLeaderboard(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, leaderboard)
}

// GetActiveContests handles GET /api/v1/contests/active
func (h *ContestHandler) GetActiveContests(c *gin.Context) {
	activeContests, err := h.contestService.GetActiveContests(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, activeContests)
}
