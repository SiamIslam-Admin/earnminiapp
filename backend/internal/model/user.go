package model

import (
	"time"
)

type User struct {
	ID               int64     `json:"id"`
	TelegramID       int64     `json:"telegram_id"`
	Username         string    `json:"username"`
	FirstName        string    `json:"first_name"`
	PhotoURL         string    `json:"photo_url,omitempty"`
	LanguageCode     string    `json:"language_code"`
	IsPremium        bool      `json:"is_premium"`
	Level            int       `json:"level"`
	Energy           int       `json:"energy"`
	MaxEnergy        int       `json:"max_energy"`
	Spins            int       `json:"spins"`
	Diamonds         int64     `json:"diamonds"`
	BalanceUSD       float64   `json:"balance_usd"`
	ReferrerID       *int64    `json:"referrer_id,omitempty"`
	TONWallet        string    `json:"ton_wallet,omitempty"`
	IsBanned                bool      `json:"is_banned"`
	HasClaimedChannelReward bool      `json:"has_claimed_channel_reward"`
	LastEnergyRefill        time.Time `json:"last_energy_refill"`
	LastActiveAt            time.Time `json:"last_active_at"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

type TelegramAuthRequest struct {
	InitData   string `json:"init_data" binding:"required"`
	StartParam string `json:"start_param,omitempty"` // For ref_123 deep links
}

type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID                           int64   `json:"id"`
	TelegramID                   int64   `json:"telegram_id"`
	TelegramIDCamel              int64   `json:"telegramId,omitempty"`
	FirstName                    string  `json:"first_name"`
	FirstNameCamel               string  `json:"firstName,omitempty"`
	Username                     string  `json:"username"`
	PhotoURL                     string  `json:"photo_url,omitempty"`
	PhotoURLCamel                string  `json:"photoUrl,omitempty"`
	Level                        int     `json:"level"`
	Energy                       int     `json:"energy"`
	MaxEnergy                    int     `json:"max_energy"`
	MaxEnergyCamel               int     `json:"maxEnergy,omitempty"`
	Spins                        int     `json:"spins"`
	Diamonds                     int64   `json:"diamonds"`
	DiamondsCamel                int64   `json:"gems,omitempty"`
	BalanceUSD                   float64 `json:"balance_usd"`
	BalanceUSDCamel              float64 `json:"balanceUsd,omitempty"`
	TONWallet                    string  `json:"ton_wallet,omitempty"`
	TONWalletCamel               string  `json:"tonWallet,omitempty"`
	GoalUSD                      float64 `json:"goal_usd"`  // Default 1.00
	GoalUSDCamel                 float64 `json:"goalUsd,omitempty"`
	GoalLeft                     float64 `json:"goal_left"` // Math.max(0, 1.00 - BalanceUSD)
	GoalLeftCamel                float64 `json:"goalLeft,omitempty"`
	IsAdmin                      bool    `json:"is_admin"`
	IsAdminCamel                 bool    `json:"isAdmin,omitempty"`
	IsBanned                     bool    `json:"is_banned"`
	IsBannedCamel                bool    `json:"isBanned,omitempty"`
	HasClaimedChannelReward      bool    `json:"has_claimed_channel_reward"`
	HasClaimedChannelRewardCamel bool    `json:"hasClaimedChannelReward,omitempty"`
}

type UserProfileResponse = UserResponse

