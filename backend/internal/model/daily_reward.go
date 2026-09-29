package model

type DailyRewardDay struct {
	Day                 int     `json:"day"`
	Reward              string  `json:"reward"`
	Icon                string  `json:"icon"`
	Active              bool    `json:"active"`
	IsMega              bool    `json:"isMega,omitempty"`
	IsMegaSnake         bool    `json:"is_mega,omitempty"`
	RewardGems          int64   `json:"rewardGems,omitempty"`
	RewardDiamondsSnake int64   `json:"reward_diamonds,omitempty"`
	RewardSpins         int     `json:"rewardSpins,omitempty"`
	RewardSpinsSnake    int     `json:"reward_spins,omitempty"`
	RewardUSD           float64 `json:"rewardUsd,omitempty"`
	RewardUSDSnake      float64 `json:"reward_usd,omitempty"`
}

type DailyRewardsStatusResponse struct {
	CurrentDay          int              `json:"currentDay"`
	CurrentDaySnake     int              `json:"current_day,omitempty"`
	CanClaimToday       bool             `json:"canClaimToday"`
	CanClaimTodaySnake  bool             `json:"can_claim_today"`
	HasClaimedToday     bool             `json:"hasClaimedToday"`
	HasClaimedTodaySnake bool            `json:"has_claimed_today"`
	ServerDate          string           `json:"serverDate,omitempty"`
	ServerDateSnake     string           `json:"server_date,omitempty"`
	StreakActive        bool             `json:"streakActive"`
	StreakBonus         string           `json:"streakBonus"` // e.g. "+10% Spin Luck!"
	Days                []DailyRewardDay `json:"days"`
}

type ClaimDailyRewardResponse struct {
	ClaimedDay          int          `json:"claimedDay"`
	ClaimedDaySnake     int          `json:"claimed_day,omitempty"`
	RewardGems          int64        `json:"rewardGems"`
	RewardDiamondsSnake int64        `json:"reward_diamonds,omitempty"`
	RewardSpins         int          `json:"rewardSpins"`
	RewardSpinsSnake    int          `json:"reward_spins,omitempty"`
	RewardUSD           float64      `json:"rewardUsd"`
	RewardUSDSnake      float64      `json:"reward_usd,omitempty"`
	RewardLabel         string       `json:"rewardLabel,omitempty"`
	TxID                string       `json:"txId"`
	TxIDSnake           string       `json:"tx_id,omitempty"`
	UserBalance         UserResponse  `json:"userBalance"`
	User                *UserResponse `json:"user,omitempty"`
}

type DailyRewardConfigItem struct {
	Day                 int     `json:"day"`
	RewardGems          int64   `json:"rewardGems"`
	RewardDiamondsSnake int64   `json:"reward_diamonds,omitempty"`
	RewardGemsSnake     int64   `json:"reward_gems,omitempty"`
	RewardSpins         int     `json:"rewardSpins"`
	RewardSpinsSnake    int     `json:"reward_spins,omitempty"`
	RewardUSD           float64 `json:"rewardUsd"`
	RewardUSDSnake      float64 `json:"reward_usd,omitempty"`
	Label               string  `json:"label"`
	Icon                string  `json:"icon"`
	IsMega              bool    `json:"isMega"`
	IsMegaSnake         bool    `json:"is_mega,omitempty"`
}

type DailyRewardsConfigResponse struct {
	Days []DailyRewardConfigItem `json:"days"`
}
