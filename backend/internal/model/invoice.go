package model

import "time"

type CreateInvoiceRequest struct {
	AmountUSD float64 `json:"amount_usd" binding:"required,gt=0"`
	Purpose   string  `json:"purpose" binding:"required"` // 'diamonds', 'raffle_tickets', 'vip'
	RaffleID  string  `json:"raffle_id,omitempty"`
}

type InvoiceResponse struct {
	InvoiceID      string  `json:"invoice_id"`
	DepositAddress string  `json:"deposit_address"`
	AmountUSD      float64 `json:"amount_usd"`
	AmountUSDT     string  `json:"amount_usdt"`
	Purpose        string  `json:"purpose"`
	Status         string  `json:"status"` // 'pending', 'paid', 'expired'
	Network        string  `json:"network"`
	ExpiresAt      int64   `json:"expires_at"` // Unix timestamp in ms
	QRCodeData     string  `json:"qr_code_data"`
	TxHash         string  `json:"tx_hash,omitempty"`
}

type Invoice struct {
	ID             int64      `json:"id"`
	InvoiceID      string     `json:"invoice_id"`
	UserID         int64      `json:"user_id"`
	WalletIndex    int64      `json:"wallet_index"`
	DepositAddress string     `json:"deposit_address"`
	AmountUSD      float64    `json:"amount_usd"`
	Purpose        string     `json:"purpose"`
	ReferenceID    string     `json:"reference_id"`
	Status         string     `json:"status"`
	SweepStatus    string     `json:"sweep_status"` // 'unclaimed', 'sweeping', 'swept', 'failed'
	TxHash         *string    `json:"tx_hash,omitempty"`
	SweepTxHash    *string    `json:"sweep_tx_hash,omitempty"`
	ExpiresAt      time.Time  `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
}

type StarsInvoiceRequest struct {
	StarsCount int    `json:"stars_count" binding:"required,gt=0"` // e.g. 5 or 20
	Purpose    string `json:"purpose" binding:"required"`          // 'raffle_tickets', 'diamonds'
	RaffleID   string `json:"raffle_id,omitempty"`
}

type StarsInvoiceResponse struct {
	InvoiceLink string `json:"invoice_link"`
	Payload     string `json:"payload"`
	Stars       int    `json:"stars"`
}

type InvoiceStatusResponse struct {
	InvoiceID      string        `json:"invoiceId"`
	InvoiceIDS     string        `json:"invoice_id,omitempty"`
	Status         string        `json:"status"` // 'pending', 'paid', 'expired'
	AmountUSD      float64       `json:"amountUsd"`
	AmountUSDS     float64       `json:"amount_usd,omitempty"`
	Purpose        string        `json:"purpose"`
	ReferenceID    string        `json:"referenceId,omitempty"`
	ReferenceIDS   string        `json:"reference_id,omitempty"`
	DepositAddress string        `json:"depositAddress,omitempty"`
	DepositAddressS string       `json:"deposit_address,omitempty"`
	Network        string        `json:"network,omitempty"`
	SecondsLeft    int64         `json:"secondsLeft"`
	SecondsLeftS   int64         `json:"seconds_left,omitempty"`
	ExpiresAt      int64         `json:"expiresAt"`
	ExpiresAtS     int64         `json:"expires_at,omitempty"`
	CreatedAt      string        `json:"createdAt,omitempty"`
	CreatedAtS     string        `json:"created_at,omitempty"`
	PaidAt         *string       `json:"paidAt,omitempty"`
	PaidAtS        *string       `json:"paid_at,omitempty"`
	TxHash         *string       `json:"txHash,omitempty"`
	TxHashS        *string       `json:"tx_hash,omitempty"`
	TicketsAwarded int           `json:"ticketsAwarded,omitempty"`
	TicketsAwardedS int          `json:"tickets_awarded,omitempty"`
	UserBalance    *UserResponse `json:"userBalance,omitempty"`
	User           *UserResponse `json:"user,omitempty"`
}
