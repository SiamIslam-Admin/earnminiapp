package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService    *service.UserService
	channelService *service.ChannelService
}

func NewUserHandler(userService *service.UserService, channelService *service.ChannelService) *UserHandler {
	return &UserHandler{
		userService:    userService,
		channelService: channelService,
	}
}

// GetProfile handles GET /api/v1/user/profile
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	profile, err := h.userService.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"user":                        profile,
		"id":                          profile.ID,
		"telegram_id":                 profile.TelegramID,
		"telegramId":                  profile.TelegramID,
		"username":                    profile.Username,
		"first_name":                  profile.FirstName,
		"firstName":                   profile.FirstName,
		"photo_url":                   profile.PhotoURL,
		"photoUrl":                    profile.PhotoURL,
		"level":                       profile.Level,
		"energy":                      profile.Energy,
		"max_energy":                  profile.MaxEnergy,
		"maxEnergy":                   profile.MaxEnergy,
		"spins":                       profile.Spins,
		"diamonds":                    profile.Diamonds,
		"gems":                        profile.Diamonds,
		"balance_usd":                 profile.BalanceUSD,
		"balanceUsd":                  profile.BalanceUSD,
		"ton_wallet":                  profile.TONWallet,
		"tonWallet":                   profile.TONWallet,
		"goal_usd":                    profile.GoalUSD,
		"goalUsd":                     profile.GoalUSD,
		"goal_left":                   profile.GoalLeft,
		"goalLeft":                    profile.GoalLeft,
		"is_admin":                    profile.IsAdmin,
		"isAdmin":                     profile.IsAdmin,
		"is_banned":                   profile.IsBanned,
		"isBanned":                    profile.IsBanned,
		"has_claimed_channel_reward":  profile.HasClaimedChannelReward,
		"hasClaimedChannelReward":     profile.HasClaimedChannelReward,
	})
}

// GetOfficialChannelStatus handles GET /api/v1/user/official-channel/status
func (h *UserHandler) GetOfficialChannelStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	if h.channelService == nil {
		response.InternalError(c, "channel service unavailable")
		return
	}

	status, err := h.channelService.GetOfficialChannelStatus(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, status)
}

// VerifyOfficialChannelJoin handles POST /api/v1/user/official-channel/verify
func (h *UserHandler) VerifyOfficialChannelJoin(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	if h.channelService == nil {
		response.InternalError(c, "channel service unavailable")
		return
	}

	result, err := h.channelService.VerifyOfficialChannelJoin(c.Request.Context(), userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Official channel join verified and reward claimed! 🎉", result)
}

