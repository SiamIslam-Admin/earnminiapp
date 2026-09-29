package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type RaffleHandler struct {
	raffleService *service.RaffleService
}

func NewRaffleHandler(raffleService *service.RaffleService) *RaffleHandler {
	return &RaffleHandler{raffleService: raffleService}
}

// GetRaffles handles GET /api/v1/raffles
func (h *RaffleHandler) GetRaffles(c *gin.Context) {
	userID := middleware.GetUserID(c)
	raffles, err := h.raffleService.GetRaffles(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, raffles)
}

// GetRaffleDetails handles GET /api/v1/raffles/:id
func (h *RaffleHandler) GetRaffleDetails(c *gin.Context) {
	raffleID := c.Param("id")
	userID := middleware.GetUserID(c)

	details, err := h.raffleService.GetRaffleDetails(c.Request.Context(), raffleID, userID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, details)
}

// BuyTickets handles POST /api/v1/raffles/:id/buy and POST /api/v1/raffles/:id/tickets
func (h *RaffleHandler) BuyTickets(c *gin.Context) {
	raffleID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.BuyRaffleTicketsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TicketCount = 1
		req.PaymentMethod = "gems"
	}

	if req.TicketCount <= 0 {
		if req.Tickets > 0 {
			req.TicketCount = req.Tickets
		} else {
			req.TicketCount = 1
		}
	}

	if req.PaymentMethod == "" {
		if req.Method != "" {
			req.PaymentMethod = req.Method
		} else {
			req.PaymentMethod = "gems"
		}
	}

	res, err := h.raffleService.BuyTickets(c.Request.Context(), raffleID, userID, req.TicketCount, req.PaymentMethod)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Tickets purchased successfully! 🎟️", res)
}

// GenerateStarsInvoice handles POST /api/v1/raffles/:id/stars-invoice
func (h *RaffleHandler) GenerateStarsInvoice(c *gin.Context) {
	raffleID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.RaffleStarsInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TicketCount = 1
	}

	if req.TicketCount <= 0 {
		if req.Tickets > 0 {
			req.TicketCount = req.Tickets
		} else {
			req.TicketCount = 1
		}
	}

	res, err := h.raffleService.GenerateStarsInvoice(c.Request.Context(), raffleID, userID, req.TicketCount)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, res)
}

// ClaimOrBuyTickets handles legacy POST /api/v1/raffles/:id/claim
func (h *RaffleHandler) ClaimOrBuyTickets(c *gin.Context) {
	h.BuyTickets(c)
}
