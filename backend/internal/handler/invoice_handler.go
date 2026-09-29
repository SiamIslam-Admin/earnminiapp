package handler

import (
	"fmt"

	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/internal/telegram"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type InvoiceHandler struct {
	invoiceService *service.InvoiceService
	botClient      *telegram.BotClient
}

func NewInvoiceHandler(invoiceService *service.InvoiceService, botClient *telegram.BotClient) *InvoiceHandler {
	return &InvoiceHandler{
		invoiceService: invoiceService,
		botClient:      botClient,
	}
}

// CreateCryptoInvoice handles POST /api/v1/invoices/crypto
func (h *InvoiceHandler) CreateCryptoInvoice(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.CreateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Valid amount_usd and purpose are required")
		return
	}

	res, err := h.invoiceService.CreateCryptoInvoice(c.Request.Context(), userID, &req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Deposit invoice generated successfully", res)
}

// CreateStarsInvoice handles POST /api/v1/telegram/stars/invoice
func (h *InvoiceHandler) CreateStarsInvoice(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.StarsInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Valid stars_count and purpose are required")
		return
	}

	title := fmt.Sprintf("%d Telegram Stars", req.StarsCount)
	desc := "Spin Craft Mini App Purchase"
	payload := fmt.Sprintf("stars:%d:%s:%s", userID, req.Purpose, req.RaffleID)

	if req.Purpose == "raffle_tickets" {
		title = fmt.Sprintf("Raffle Ticket (%s)", req.RaffleID)
		desc = fmt.Sprintf("Enter Raffle with %d Stars", req.StarsCount)
	}

	link, err := h.botClient.CreateStarsInvoiceLink(title, desc, payload, req.StarsCount)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("Failed to generate Telegram Stars invoice: %v", err))
		return
	}

	response.Success(c, model.StarsInvoiceResponse{
		InvoiceLink: link,
		Payload:     payload,
		Stars:       req.StarsCount,
	})
}

// GetInvoiceStatus handles GET /api/v1/invoices/:id/status and GET /api/v1/invoices/:id
func (h *InvoiceHandler) GetInvoiceStatus(c *gin.Context) {
	invoiceID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	res, err := h.invoiceService.GetInvoiceStatus(c.Request.Context(), invoiceID, userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, res)
}
