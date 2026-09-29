package model

type SpinSegment struct {
	Label string `json:"label"`
	Value string `json:"value"` // 'coins', 'gem', 'spin_ticket', 'double_reward', 'gem_large'
	Image string `json:"image"`
}

var DefaultWheelSegments = []SpinSegment{
	{Label: "Diamond", Value: "gem", Image: "./assets/purple-diamond.png"},
	{Label: "Coins", Value: "coins", Image: "./assets/coin_3d.png"},
	{Label: "Spin Ticket", Value: "spin_ticket", Image: "./assets/wheel-of-fortune.png"},
	{Label: "Double Reward", Value: "double_reward", Image: "./assets/gift.png"},
	{Label: "Spin Ticket x2", Value: "spin_ticket_2", Image: "./assets/wheel-of-fortune.png"},
	{Label: "Mega Diamonds", Value: "gem_large", Image: "./assets/purple-diamond.png"},
}

type SpinReward struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Value       string `json:"value"`
	Amount      string `json:"amount"` // e.g. "+$0.45" or "+80 💎" or "+1 Free Spin"
	Image       string `json:"image"`
	IsDouble    bool   `json:"is_double"`
	Multiplier  int    `json:"multiplier"`
	BaseAmount  string `json:"base_amount,omitempty"`
	FinalAmount string `json:"final_amount,omitempty"`
}

type ServerSpinResponse struct {
	TargetIndex int          `json:"targetIndex"` // 0 to 5 matching wheel segments
	IsDouble    bool         `json:"isDouble"`
	Reward      SpinReward   `json:"reward"`
	TxID        string       `json:"txId"`
	Timestamp   int64        `json:"timestamp"`
	UserBalance SpinBalance  `json:"userBalance"`
	User        *SpinBalance `json:"user,omitempty"`
}

type SpinRequest struct {
	Method string `json:"method,omitempty"` // "auto" | "spins" | "diamonds"
}

type SpinBalance struct {
	Spins          int     `json:"spins"`
	Diamonds       int64   `json:"diamonds"`
	DiamondsSnake  int64   `json:"gems,omitempty"`
	BalanceUSD     float64 `json:"balanceUsd"`
	BalanceUSDSnake float64 `json:"balance_usd,omitempty"`
	Level          int     `json:"level"`
	Energy         int     `json:"energy,omitempty"`
	MaxEnergy      int     `json:"max_energy,omitempty"`
	MaxEnergyCamel int     `json:"maxEnergy,omitempty"`
}

type WheelItemSetting struct {
	Index             int     `json:"index"`
	Value             string  `json:"value"`
	Label             string  `json:"label"`
	Weight            int     `json:"weight"`
	Percent           float64 `json:"percent"`
	RewardAmount      string  `json:"rewardAmount"`
	RewardAmountSnake string  `json:"reward_amount,omitempty"`
}

type WheelSettingsResponse struct {
	Items                  []WheelItemSetting `json:"items"`
	TotalWeight            int                `json:"totalWeight"`
	TotalWeightSnake       int                `json:"total_weight,omitempty"`
	DiamondReward          int64              `json:"diamondReward"`
	DiamondRewardSnake     int64              `json:"diamond_reward,omitempty"`
	MegaDiamondReward      int64              `json:"megaDiamondReward"`
	MegaDiamondRewardSnake int64              `json:"mega_diamond_reward,omitempty"`
	MinCashReward          float64            `json:"minCashReward"`
	MinCashRewardSnake     float64            `json:"min_cash_reward,omitempty"`
	MaxCashReward          float64            `json:"maxCashReward"`
	MaxCashRewardSnake     float64            `json:"max_cash_reward,omitempty"`
}
