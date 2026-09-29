package model

type TaskProgress struct {
	Current int `json:"current"`
	Total   int `json:"total"`
}

type TaskItemResponse struct {
	ID                  string        `json:"id"`
	TaskID              string        `json:"task_id,omitempty"`
	Category            string        `json:"category"` // 'special', 'daily', 'socials'
	Title               string        `json:"title"`
	Icon                string        `json:"icon"`
	IconURL             string        `json:"iconUrl,omitempty"`
	IconURLSnake        string        `json:"icon_url,omitempty"`
	IsIconImage         bool          `json:"isIconImage"`
	TaskType            string        `json:"taskType"` // 'external_link', 'invite_count', 'spin_count', 'level_reach', 'telegram_channel'
	TaskTypeSnake       string        `json:"task_type,omitempty"`
	TargetCount         int           `json:"targetCount"`
	TargetCountSnake    int           `json:"target_count,omitempty"`
	RewardGems          int           `json:"rewardGems"`
	RewardDiamondsSnake int           `json:"reward_diamonds,omitempty"`
	RewardGemsSnake     int           `json:"reward_gems,omitempty"`
	RewardSpins         int           `json:"rewardSpins,omitempty"`
	RewardSpinsSnake    int           `json:"reward_spins,omitempty"`
	SecondaryRewardGems int           `json:"secondaryRewardGems,omitempty"`
	Progress            *TaskProgress `json:"progress,omitempty"`
	Status              string        `json:"status"` // 'pending', 'verifying', 'completed'
	VerificationSeconds int           `json:"verificationSeconds,omitempty"`
	ActionURL           string        `json:"actionUrl,omitempty"`
	ActionURLSnake      string        `json:"action_url,omitempty"`
	ChannelID           string        `json:"channelId,omitempty"`
	ChannelIDSnake      string        `json:"channel_id,omitempty"`
}

type ReadyToClaimItemResponse struct {
	ID                  string `json:"id"`
	Title               string `json:"title"`
	Icon                string `json:"icon"`
	RewardGems          int    `json:"rewardGems"`
	RewardDiamondsSnake int    `json:"reward_diamonds,omitempty"`
	RewardGemsSnake     int    `json:"reward_gems,omitempty"`
}

type TasksPageResponse struct {
	ReadyToClaim *ReadyToClaimItemResponse `json:"readyToClaim"`
	Tasks        []TaskItemResponse        `json:"tasks"`
}
