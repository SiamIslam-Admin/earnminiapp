package model

type OfficialChannelStatusResponse struct {
	ChannelUsername      string `json:"channel_username"`
	ChannelUsernameCamel string `json:"channelUsername,omitempty"`
	ChannelLink          string `json:"channel_link"`
	ChannelLinkCamel     string `json:"channelLink,omitempty"`
	RewardSpins          int    `json:"reward_spins"`
	RewardSpinsCamel     int    `json:"rewardSpins,omitempty"`
	RewardDiamonds       int64  `json:"reward_diamonds"`
	RewardDiamondsCamel  int64  `json:"rewardDiamonds,omitempty"`
	RewardGemsCamel      int64  `json:"rewardGems,omitempty"`
	HasClaimed           bool   `json:"has_claimed"`
	HasClaimedCamel      bool   `json:"hasClaimed,omitempty"`
	HasClaimedReward     bool   `json:"has_claimed_channel_reward"`
}

type OfficialChannelClaimResponse struct {
	Success             bool          `json:"success"`
	Message             string        `json:"message"`
	RewardSpins         int           `json:"reward_spins"`
	RewardSpinsCamel    int           `json:"rewardSpins,omitempty"`
	RewardDiamonds      int64         `json:"reward_diamonds"`
	RewardDiamondsCamel int64         `json:"rewardDiamonds,omitempty"`
	User                *UserResponse `json:"user,omitempty"`
	UserBalance         *UserResponse `json:"userBalance,omitempty"`
}

