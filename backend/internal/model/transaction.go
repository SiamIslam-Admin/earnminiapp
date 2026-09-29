package model

import (
	"time"
)

type Transaction struct {
	ID             int64     `json:"id"`
	UserID         int64     `json:"user_id"`
	Category       string    `json:"category"` // 'spins', 'daily', 'tasks', 'team', 'withdrawals', 'raffles', 'gift'
	Title          string    `json:"title"`
	AmountUSD      float64   `json:"amount_usd"`
	AmountDiamonds int64     `json:"amount_diamonds"`
	AmountSpins    int       `json:"amount_spins"`
	AmountTickets  int       `json:"amount_tickets"`
	Status         string    `json:"status"` // 'completed', 'processing', 'failed'
	ReferenceID    string    `json:"reference_id"`
	TxHash         string    `json:"tx_hash,omitempty"`
	Description    string    `json:"description,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type TransactionRecordResponse struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Category    string `json:"category"` // 'all', 'withdrawals', 'spins', 'tasks'
	Date        string `json:"date"`
	TxID        string `json:"txId"`
	Icon        string `json:"icon"`
	IsImageIcon bool   `json:"isImageIcon"`
	Amount      string `json:"amount"` // e.g. "+$0.20", "+80", "-$1.00"
	IsDiamond   bool   `json:"isDiamond"`
	Status      string `json:"status"` // 'completed', 'processing', 'failed'
	Hash        string `json:"hash,omitempty"`
}
