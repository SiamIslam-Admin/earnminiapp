package model

type BindWalletRequest struct {
	Address string `json:"address" binding:"required"`
}

type WithdrawRequest struct {
	AmountUSD float64 `json:"amount_usd" binding:"required,gt=0"`
}

type WithdrawResponse struct {
	WithdrawalID string       `json:"withdrawalId"`
	AmountUSD    float64      `json:"amountUsd"`
	FeeUSD       float64      `json:"feeUsd"`
	NetPayoutUSD float64      `json:"netPayoutUsd"`
	TONAddress   string       `json:"tonAddress"`
	Status       string       `json:"status"` // 'processing' or 'completed'
	TxID         string       `json:"txId"`
	TxHash       string       `json:"txHash,omitempty"`
	BscScanURL   string       `json:"bscScanUrl,omitempty"`
	Message      string        `json:"message,omitempty"`
	UserBalance  UserResponse  `json:"userBalance"`
	User         *UserResponse `json:"user,omitempty"`
}

type WalletInfoResponse struct {
	AvailableBalanceUSD float64                     `json:"availableBalanceUsd"`
	Connected           bool                        `json:"connected"`
	TONWalletAddress    string                      `json:"tonWalletAddress,omitempty"`
	PresetAmounts       []float64                   `json:"presetAmounts"` // [1.0, 2.5, 5.0, 10.0]
	GasFeePercent       float64                     `json:"gasFeePercent"` // 2.0
	PayoutMode          string                      `json:"payoutMode,omitempty"` // "manual" or "instant"
	MinWithdrawalUSD    float64                     `json:"minWithdrawalUsd,omitempty"`
	RecentTransactions  []TransactionRecordResponse `json:"recentTransactions"`
}
