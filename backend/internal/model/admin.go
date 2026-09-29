package model

type AdminAuthRequest struct {
	SecretKey string `json:"secret_key" binding:"required"`
}

type AdminAuthResponse struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"` // seconds
}

type AdminWalletStatusResponse struct {
	IsInitialized    bool    `json:"is_initialized"`
	MasterAddress    string  `json:"master_address"`
	BnbBalance       float64 `json:"bnb_balance"`
	UsdtBalance      float64 `json:"usdt_balance"`
	UsdtContract     string  `json:"usdt_contract"`
	Network          string  `json:"network"`
	ChainID          int64   `json:"chain_id"`
	LowBnbGasWarning bool    `json:"low_bnb_gas_warning"`
	IsPayoutReady    bool    `json:"is_payout_ready"`
}

type GenerateWalletResponse struct {
	MasterAddress  string `json:"master_address"`
	SeedPhrase     string `json:"seed_phrase"`
	PrivateKey     string `json:"private_key"`
	DerivationPath string `json:"derivation_path"`
	Notice         string `json:"notice"`
}

type ImportWalletRequest struct {
	SeedPhrase string `json:"seed_phrase,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
}

type VaultSecretsResponse struct {
	MasterAddress  string `json:"master_address"`
	SeedPhrase     string `json:"seed_phrase"`
	PrivateKey     string `json:"private_key"`
	DerivationPath string `json:"derivation_path"`
	Network        string `json:"network"`
	ChainID        int64  `json:"chain_id"`
	UsdtContract   string `json:"usdt_contract"`
	ExportedAt     string `json:"exported_at"`
}

type PayoutSettings struct {
	PayoutMode          string  `json:"payout_mode"`            // "manual" or "instant"
	MinWithdrawalUSD    float64 `json:"min_withdrawal_usd"`      // e.g. 1.00
	FeePercentage       float64 `json:"fee_percentage"`         // e.g. 2.0
	InstantPayoutMaxUSD float64 `json:"instant_payout_max_usd"`  // e.g. 50.00
}

type UpdatePayoutSettingsRequest struct {
	PayoutMode          string   `json:"payout_mode,omitempty"`
	MinWithdrawalUSD    *float64 `json:"min_withdrawal_usd,omitempty"`
	FeePercentage       *float64 `json:"fee_percentage,omitempty"`
	InstantPayoutMaxUSD *float64 `json:"instant_payout_max_usd,omitempty"`
}

type ManualPaidRequest struct {
	TxHash string `json:"tx_hash,omitempty"`
	Notes  string `json:"notes,omitempty"`
}

type RejectWithdrawalRequest struct {
	Reason string `json:"reason,omitempty"`
}

type VaultTransferRequest struct {
	Asset            string  `json:"asset" binding:"required"` // "usdt" or "bnb"
	RecipientAddress string  `json:"recipient_address" binding:"required"`
	Amount           float64 `json:"amount" binding:"required"`
	Notes            string  `json:"notes,omitempty"`
}

type VaultTransferResponse struct {
	TxHash           string  `json:"tx_hash"`
	Asset            string  `json:"asset"`
	Amount           float64 `json:"amount"`
	RecipientAddress string  `json:"recipient_address"`
	ExplorerURL      string  `json:"explorer_url"`
	TransferredAt    string  `json:"transferred_at"`
}
