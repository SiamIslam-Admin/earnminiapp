package model

import "time"

type ContestPrizeTier struct {
	Rank      int     `json:"rank"`
	RankEnd   int     `json:"rankEnd,omitempty"` // For rank ranges, e.g. 6 to 10
	Prize     string  `json:"prize"`              // e.g. "$200.00"
	AmountUSD float64 `json:"amount_usd"`         // e.g. 200.00
}

type Contest struct {
	ID                int64              `json:"id"`
	ContestID         string             `json:"contestId"` // 'spin_weekly', 'referral_monthly'
	Type              string             `json:"type"`      // 'spins', 'referrals'
	Title             string             `json:"title"`
	PrizePoolUSD      float64            `json:"prizePoolUsd"`
	PrizePoolStr      string             `json:"prizePoolStr"`
	Icon              string             `json:"icon"`
	PrizeDistribution []ContestPrizeTier `json:"prizeDistribution"`
	StartsAt          time.Time          `json:"startsAt"`
	EndsAt            time.Time          `json:"endsAt"`
	Status            string             `json:"status"` // 'active', 'upcoming', 'ended'
	IsActive          bool               `json:"isActive"`
	WinnersJSON       string             `json:"winnersJson,omitempty"`
	CreatedAt         time.Time          `json:"createdAt"`
	UpdatedAt         time.Time          `json:"updatedAt"`
}

type CreateContestRequest struct {
	ContestID         string             `json:"contest_id" binding:"required"`
	Type              string             `json:"type" binding:"required"` // 'spins' or 'referrals'
	Title             string             `json:"title" binding:"required"`
	PrizePoolUSD      float64            `json:"prize_pool_usd"`
	PrizePoolStr      string             `json:"prize_pool_str"`
	Icon              string             `json:"icon"`
	PrizeDistribution []ContestPrizeTier `json:"prize_distribution" binding:"required"`
	DurationDays      int                `json:"duration_days"`
	StartsAt          *time.Time         `json:"starts_at,omitempty"`
	EndsAt            *time.Time         `json:"ends_at,omitempty"`
}

type UpdateContestRequest struct {
	Title             *string             `json:"title,omitempty"`
	PrizePoolUSD      *float64            `json:"prize_pool_usd,omitempty"`
	PrizePoolStr      *string             `json:"prize_pool_str,omitempty"`
	Icon              *string             `json:"icon,omitempty"`
	PrizeDistribution *[]ContestPrizeTier `json:"prize_distribution,omitempty"`
	Status            *string             `json:"status,omitempty"`
	IsActive          *bool               `json:"is_active,omitempty"`
	StartsAt          *time.Time          `json:"starts_at,omitempty"`
	EndsAt            *time.Time          `json:"ends_at,omitempty"`
}

type ContestLeaderboardUser struct {
	Rank   int    `json:"rank"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	Score  int    `json:"score"`
	Spins  int    `json:"spins"` // Backwards compatibility with frontend
	Prize  string `json:"prize"`
}

type UserTournamentStatus struct {
	Rank           int    `json:"rank"`
	Score          int    `json:"score"`
	Spins          int    `json:"spins"` // Backwards compatibility with frontend
	ProjectedPrize string `json:"projectedPrize"`
}

type ContestLeaderboardResponse struct {
	ContestID     string                   `json:"contestId"`
	Title         string                   `json:"title"`
	Category      string                   `json:"category"` // 'spins' or 'referrals'
	PrizePool     string                   `json:"prizePool"` // e.g. "$500.00 USDT"
	EndsIn        string                   `json:"endsIn"`
	EndsTimestamp int64                    `json:"endsTimestamp"`
	TopWinners    []ContestLeaderboardUser `json:"topWinners"`    // Ranks 1-3
	OtherRankings []ContestLeaderboardUser `json:"otherRankings"` // Ranks 4-20
	UserStatus    UserTournamentStatus     `json:"userStatus"`
}

type ContestSummary struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Category      string `json:"category"` // 'spins', 'referrals'
	PrizePool     string `json:"prizePool"`
	IsActive      bool   `json:"isActive"`
	EndsIn        string `json:"endsIn"`
	EndsTimestamp int64  `json:"endsTimestamp"`
	Icon          string `json:"icon"`
}

type ActiveContestsResponse struct {
	Contests []ContestSummary `json:"contests"`
}
