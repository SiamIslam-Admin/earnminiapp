package model

import "time"

type RedeemGiftCodeRequest struct {
	Code string `json:"code" binding:"required"`
}

type RedeemGiftCodeResponse struct {
	RewardType   string        `json:"rewardType"` // 'diamonds', 'usd', 'spins'
	RewardAmount float64       `json:"rewardAmount"`
	RewardText   string        `json:"rewardText"` // e.g. "+500 💎"
	TxID         string        `json:"txId"`
	UserBalance  UserResponse  `json:"userBalance"`
	User         *UserResponse `json:"user,omitempty"`
}

type CreateGiftCodeRequest struct {
	Code           string  `json:"code" binding:"required"`
	RewardDiamonds int64   `json:"reward_diamonds"`
	RewardSpins    int     `json:"reward_spins"`
	RewardUSD      float64 `json:"reward_usd"`
	MaxClaims      int     `json:"max_claims"`
	ExpiresInDays  int     `json:"expires_in_days,omitempty"`
}

type BulkGenerateGiftCodesRequest struct {
	Quantity       int     `json:"quantity" binding:"required,min=1,max=1000"`
	Prefix         string  `json:"prefix"` // e.g. "VIP-" or "PROMO-"
	BatchName      string  `json:"batch_name,omitempty"`
	RewardDiamonds int64   `json:"reward_diamonds"`
	RewardSpins    int     `json:"reward_spins"`
	RewardUSD      float64 `json:"reward_usd"`
	ExpiresInDays  int     `json:"expires_in_days"`
}

type BulkGenerateGiftCodesResponse struct {
	BatchID   string   `json:"batchId"`
	Count     int      `json:"count"`
	Codes     []string `json:"codes"`
	CsvExport string   `json:"csvExport"`
}

type GiftCodeDetail struct {
	ID             int64      `json:"id"`
	Code           string     `json:"code"`
	BatchID        string     `json:"batchId,omitempty"`
	BatchName      string     `json:"batchName,omitempty"`
	RewardDiamonds int64      `json:"rewardDiamonds"`
	RewardSpins    int        `json:"rewardSpins"`
	RewardUSD      float64    `json:"rewardUsd"`
	MaxClaims      int        `json:"maxClaims"`
	CurrentClaims  int        `json:"currentClaims"`
	IsActive       bool       `json:"isActive"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type GiftCodeClaimer struct {
	UserID     int64     `json:"userId"`
	TelegramID int64     `json:"telegramId"`
	FirstName  string    `json:"firstName"`
	Username   string    `json:"username"`
	ClaimedAt  time.Time `json:"claimedAt"`
}

type GiftCodeBatchSummary struct {
	BatchID        string     `json:"batchId"`
	BatchName      string     `json:"batchName"`
	TotalCodes     int        `json:"totalCodes"`
	ClaimedCodes   int        `json:"claimedCodes"`
	UnclaimedCodes int        `json:"unclaimedCodes"`
	RewardDiamonds int64      `json:"rewardDiamonds"`
	RewardSpins    int        `json:"rewardSpins"`
	RewardUSD      float64    `json:"rewardUsd"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}
