package handler

import (
	"strconv"

	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type WalletHandler struct {
	walletService *service.WalletService
}

func NewWalletHandler(walletService *service.WalletService) *WalletHandler {
	return &WalletHandler{walletService: walletService}
}

// GetWalletInfo handles GET /api/v1/wallet
func (h *WalletHandler) GetWalletInfo(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	info, err := h.walletService.GetWalletInfo(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, info)
}

// BindWallet handles POST /api/v1/wallet/bind
func (h *WalletHandler) BindWallet(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.BindWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Valid wallet address is required")
		return
	}

	updatedUser, err := h.walletService.BindWallet(c.Request.Context(), userID, req.Address)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "BEP-20 Wallet connected successfully", gin.H{
		"user":        updatedUser,
		"userBalance": updatedUser,
	})
}

// Withdraw handles POST /api/v1/wallet/withdraw
func (h *WalletHandler) Withdraw(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.WithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Valid withdrawal amount is required")
		return
	}

	res, err := h.walletService.SubmitWithdrawal(c.Request.Context(), userID, req.AmountUSD)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Withdrawal request submitted successfully", res)
}

// GetRecords handles GET /api/v1/wallet/records
func (h *WalletHandler) GetRecords(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	category := c.Query("type")
	if category == "" {
		category = c.DefaultQuery("category", "all")
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	offset := 0
	if pageStr := c.Query("page"); pageStr != "" {
		page, _ := strconv.Atoi(pageStr)
		if page > 1 {
			offset = (page - 1) * limit
		}
	} else if offsetStr := c.Query("offset"); offsetStr != "" {
		offset, _ = strconv.Atoi(offsetStr)
	}

	records, err := h.walletService.GetRecords(c.Request.Context(), userID, category, limit, offset)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, records)
}
