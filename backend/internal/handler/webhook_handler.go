package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type AlchemyActivity struct {
	FromAddress     string  `json:"fromAddress"`
	ToAddress       string  `json:"toAddress"`
	Value           float64 `json:"value"`
	Asset           string  `json:"asset"`
	Hash            string  `json:"hash"`
	Category        string  `json:"category"`
	ContractAddress string  `json:"contractAddress,omitempty"`
	RawContract     struct {
		RawValue string `json:"rawValue,omitempty"`
		Address  string `json:"address,omitempty"`
		Decimals int    `json:"decimals,omitempty"`
	} `json:"rawContract"`
}

type AlchemyWebhookPayload struct {
	WebhookID string `json:"webhookId"`
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Type      string `json:"type"`
	Event     struct {
		Network  string            `json:"network"`
		Activity []AlchemyActivity `json:"activity"`
	} `json:"event"`
}

type WebhookHandler struct {
	bscClient      *bsc.BSCClient
	invoiceService *service.InvoiceService
	invoiceRepo    *repository.InvoiceRepository
	userRepo       *repository.UserRepository
	txRepo         *repository.TransactionRepository
}

func NewWebhookHandler(
	bscClient *bsc.BSCClient,
	invoiceService *service.InvoiceService,
	invoiceRepo *repository.InvoiceRepository,
	userRepo *repository.UserRepository,
	txRepo *repository.TransactionRepository,
) *WebhookHandler {
	return &WebhookHandler{
		bscClient:      bscClient,
		invoiceService: invoiceService,
		invoiceRepo:    invoiceRepo,
		userRepo:       userRepo,
		txRepo:         txRepo,
	}
}

const usdtBEP20ContractAddress = "0x55d398326f99059fF775485246999027B3197955"

// HandleAlchemyWebhook processes incoming Alchemy Address Activity webhooks
func (h *WebhookHandler) HandleAlchemyWebhook(c *gin.Context) {
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "Failed to read body")
		return
	}

	signature := c.GetHeader("X-Alchemy-Signature")
	if !h.bscClient.VerifyAlchemySignature(rawBody, signature) {
		log.Printf("[WARN] Unauthorized Alchemy webhook attempt - signature mismatch")
		response.Unauthorized(c, "Invalid signature")
		return
	}

	var payload AlchemyWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		response.BadRequest(c, "Invalid JSON payload")
		return
	}

	// Process activity events and immediately fulfill matched invoices
	fulfilledCount := 0
	for _, act := range payload.Event.Activity {
		contractAddr := act.RawContract.Address
		if contractAddr == "" {
			contractAddr = act.ContractAddress
		}

		// Strictly verify contract address matches USDT BEP-20 if contract address is present
		if contractAddr != "" && !strings.EqualFold(contractAddr, usdtBEP20ContractAddress) {
			log.Printf("[WARN] Alchemy deposit ignored: token contract %s does not match expected USDT contract %s",
				contractAddr, usdtBEP20ContractAddress)
			continue
		}

		isUSDT := act.Asset == "USDT" || strings.EqualFold(contractAddr, usdtBEP20ContractAddress)
		if isUSDT && act.Value > 0 {
			log.Printf("[INFO] Alchemy Webhook received: $%.2f USDT deposit from %s to %s | TxHash: %s",
				act.Value, act.FromAddress, act.ToAddress, act.Hash)

			if h.invoiceRepo != nil && h.invoiceService != nil {
				inv, err := h.invoiceRepo.GetByDepositAddress(c.Request.Context(), act.ToAddress)
				if err == nil && inv != nil {
					// Strictly verify deposit value is at least the requested invoice amount (anti-underpayment)
					if act.Value < inv.AmountUSD {
						log.Printf("[WARN] Alchemy deposit underpayment for invoice %s (User %d): received $%.4f < expected $%.4f. Invoice skipped.",
							inv.InvoiceID, inv.UserID, act.Value, inv.AmountUSD)
						continue
					}

					log.Printf("[INFO] Matched Alchemy deposit to Invoice %s (User %d). Fulfilling immediately...", inv.InvoiceID, inv.UserID)
					if err := h.invoiceService.FulfillPaidInvoice(c.Request.Context(), inv.InvoiceID, act.Hash); err == nil {
						fulfilledCount++
					} else {
						log.Printf("[ERROR] Failed to fulfill invoice %s: %v", inv.InvoiceID, err)
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "received",
		"events":    len(payload.Event.Activity),
		"fulfilled": fulfilledCount,
	})
}

