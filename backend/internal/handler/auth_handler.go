package handler

import (
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// TelegramAuth handles POST /api/v1/auth/telegram
func (h *AuthHandler) TelegramAuth(c *gin.Context) {
	var req model.TelegramAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload (init_data required)")
		return
	}

	authResp, err := h.authService.AuthenticateTelegram(c.Request.Context(), req.InitData, req.StartParam)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Authentication successful", authResp)
}
