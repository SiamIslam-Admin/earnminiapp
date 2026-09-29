package service

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"earnminiapp/internal/model"
)

func TestMultiCurrencyRaffleSerialization(t *testing.T) {
	card := model.RaffleCardResponse{
		ID:                 "#VIP-TEST-1",
		Title:              "Mega $500 Raffle",
		CashReward:         500.0,
		CoinRewardStr:      "$500.00 USDT",
		TicketPriceUSD:     0.50,
		TicketPriceStars:   25,
		TicketGemPrice:     200,
		EnableUSDPayment:   true,
		EnableStarsPayment: true,
		EnableGemsPayment:  true,
		MaxTicketsPerUser:  50,
		TotalTicketsSold:   120,
		Participants:       45,
		Tickets:            120,
		Status:             "ongoing",
	}

	data, err := json.Marshal(card)
	if err != nil {
		t.Fatalf("Failed to marshal RaffleCardResponse: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal RaffleCardResponse: %v", err)
	}

	if parsed["ticketPriceUsd"] != 0.50 {
		t.Errorf("Expected ticketPriceUsd 0.50, got %v", parsed["ticketPriceUsd"])
	}
	if parsed["ticketPriceStars"] != float64(25) {
		t.Errorf("Expected ticketPriceStars 25, got %v", parsed["ticketPriceStars"])
	}
	if parsed["maxTicketsPerUser"] != float64(50) {
		t.Errorf("Expected maxTicketsPerUser 50, got %v", parsed["maxTicketsPerUser"])
	}
}

func TestStarsPayloadParsing(t *testing.T) {
	payload := "stars:101:raffle_tickets:#VIP-99:5"
	parts := strings.Split(payload, ":")

	if len(parts) < 5 {
		t.Fatalf("Expected 5 parts, got %d", len(parts))
	}

	userID, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || userID != 101 {
		t.Errorf("Expected userID 101, got %d (err: %v)", userID, err)
	}

	purpose := parts[2]
	if purpose != "raffle_tickets" {
		t.Errorf("Expected purpose raffle_tickets, got %s", purpose)
	}

	raffleID := parts[3]
	if raffleID != "#VIP-99" {
		t.Errorf("Expected raffleID #VIP-99, got %s", raffleID)
	}

	ticketCount, err := strconv.Atoi(parts[4])
	if err != nil || ticketCount != 5 {
		t.Errorf("Expected ticketCount 5, got %d (err: %v)", ticketCount, err)
	}
}

func TestAdminCreateRaffleRequestDefaults(t *testing.T) {
	rawJSON := `{
		"title": "Weekly Mega Draw",
		"cash_prize_usd": 300.0,
		"ticket_price_usd": 0.75,
		"ticket_price_stars": 35,
		"ticket_gem_price": 300,
		"enable_usd_payment": true,
		"enable_stars_payment": true,
		"enable_gems_payment": false,
		"max_tickets_per_user": 20
	}`

	var req model.AdminCreateRaffleRequest
	if err := json.Unmarshal([]byte(rawJSON), &req); err != nil {
		t.Fatalf("Failed to unmarshal AdminCreateRaffleRequest: %v", err)
	}

	if req.CashPrizeUSD != 300.0 {
		t.Errorf("Expected CashPrizeUSD 300.0, got %f", req.CashPrizeUSD)
	}
	if req.TicketPriceUSD != 0.75 {
		t.Errorf("Expected TicketPriceUSD 0.75, got %f", req.TicketPriceUSD)
	}
	if req.TicketPriceStars != 35 {
		t.Errorf("Expected TicketPriceStars 35, got %d", req.TicketPriceStars)
	}
	if req.EnableGemsPayment == nil || *req.EnableGemsPayment != false {
		t.Errorf("Expected EnableGemsPayment to be false")
	}
	if req.MaxTicketsPerUser != 20 {
		t.Errorf("Expected MaxTicketsPerUser 20, got %d", req.MaxTicketsPerUser)
	}
}

func TestStarsInvoiceResponse(t *testing.T) {
	resp := model.RaffleStarsInvoiceResponse{
		InvoiceLink:  "https://t.me/$invoice_123",
		InvoiceLinkS: "https://t.me/$invoice_123",
		TotalStars:   125,
		TotalStarsS:  125,
		TicketCount:  5,
		TicketCountS: 5,
	}

	bytes, _ := json.Marshal(resp)
	var m map[string]interface{}
	_ = json.Unmarshal(bytes, &m)

	if m["invoiceLink"] != "https://t.me/$invoice_123" || m["invoice_link"] != "https://t.me/$invoice_123" {
		t.Errorf("Dual invoice link fields not properly serialized: %v", m)
	}
	if m["totalStars"] != float64(125) || m["total_stars"] != float64(125) {
		t.Errorf("Dual total stars fields not properly serialized: %v", m)
	}
}

func TestClaimRaffleTicketResponseDualKeys(t *testing.T) {
	resp := model.ClaimRaffleTicketResponse{
		TicketsAdded:      3,
		TicketsAddedS:     3,
		TicketsPurchased:  3,
		TicketsPurchasedS: 3,
		TotalTickets:      10,
		TotalTicketsS:     10,
		TotalUserTickets:  10,
		TotalUserTicketsS: 10,
		TxID:              "TX-9999",
		TxIDS:             "TX-9999",
		UserBalance: model.UserResponse{
			Diamonds:   500,
			BalanceUSD: 12.50,
			Spins:      8,
		},
	}

	bytes, _ := json.Marshal(resp)
	var m map[string]interface{}
	_ = json.Unmarshal(bytes, &m)

	if m["ticketsPurchased"] != float64(3) || m["tickets_purchased"] != float64(3) {
		t.Errorf("Tickets purchased dual tags failed: %v", m)
	}
	if m["totalUserTickets"] != float64(10) || m["total_user_tickets"] != float64(10) {
		t.Errorf("Total user tickets dual tags failed: %v", m)
	}
}

func TestInvoiceStatusResponseSerialization(t *testing.T) {
	statusResp := model.InvoiceStatusResponse{
		InvoiceID:       "INV-101-999",
		InvoiceIDS:      "INV-101-999",
		Status:          "paid",
		AmountUSD:       2.50,
		AmountUSDS:      2.50,
		Purpose:         "raffle_tickets",
		ReferenceID:     "#VIP-TEST",
		ReferenceIDS:    "#VIP-TEST",
		DepositAddress:  "0x58c679f291079d3E01a6132712217c4618e7E1d2",
		DepositAddressS: "0x58c679f291079d3E01a6132712217c4618e7E1d2",
		SecondsLeft:     840,
		SecondsLeftS:    840,
		ExpiresAt:       1788567600000,
		ExpiresAtS:      1788567600000,
		TicketsAwarded:  5,
		TicketsAwardedS: 5,
	}

	bytes, err := json.Marshal(statusResp)
	if err != nil {
		t.Fatalf("Failed to marshal InvoiceStatusResponse: %v", err)
	}

	var m map[string]interface{}
	_ = json.Unmarshal(bytes, &m)

	if m["invoiceId"] != "INV-101-999" || m["invoice_id"] != "INV-101-999" {
		t.Errorf("Invoice ID dual tags failed: %v", m)
	}
	if m["status"] != "paid" {
		t.Errorf("Status failed: %v", m)
	}
	if m["ticketsAwarded"] != float64(5) || m["tickets_awarded"] != float64(5) {
		t.Errorf("Tickets awarded dual tags failed: %v", m)
	}
}

func TestBuyTicketsRejectsBypassPaymentMethods(t *testing.T) {
	// Initialize service with nil repos
	s := NewRaffleService(nil, nil, nil, nil)
	ctx := context.Background()

	// When user is not found, it should error before purchasing
	_, err := s.BuyTickets(ctx, "raffle_1", 9999, 1, "vip")
	if err == nil {
		t.Errorf("expected error for vip method without verified user/balance")
	}

	_, err = s.BuyTickets(ctx, "raffle_1", 9999, 5, "stars_20")
	if err == nil {
		t.Errorf("expected error for stars_20 method without verified user/balance")
	}

	_, err = s.BuyTickets(ctx, "raffle_1", 9999, 1, "stars_5")
	if err == nil {
		t.Errorf("expected error for stars_5 method without verified user/balance")
	}
}

