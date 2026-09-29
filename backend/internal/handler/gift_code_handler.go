package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type GiftCodeHandler struct {
	giftCodeService *service.GiftCodeService
}

func NewGiftCodeHandler(giftCodeService *service.GiftCodeService) *GiftCodeHandler {
	return &GiftCodeHandler{giftCodeService: giftCodeService}
}

// RedeemGiftCode handles POST /api/v1/gift-codes/redeem
func (h *GiftCodeHandler) RedeemGiftCode(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.RedeemGiftCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Please enter a valid gift code")
		return
	}

	res, err := h.giftCodeService.RedeemCode(c.Request.Context(), userID, req.Code)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Gift code redeemed successfully! 🎉", res)
}
