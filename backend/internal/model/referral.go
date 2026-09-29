package model

type TeamMemberResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	JoinedDate    string `json:"joinedDate"`
	JoinedChannel bool   `json:"joinedChannel"`
}

type TeamStatsResponse struct {
	TotalFriends  int                  `json:"totalCount"`
	ActiveCount   int                  `json:"activeCount"`
	InviteURL     string               `json:"inviteUrl"`
	ShareText     string               `json:"shareText"`
	CurrentTier   string               `json:"currentTier"` // 'Bronze', 'Silver', 'Gold'
	TierRewards   []string             `json:"tierRewards"`
	Members       []TeamMemberResponse `json:"members"`
}

type ReferralRewardSettings struct {
	InitialOrganicSpins      int     `json:"initialOrganicSpins"`
	InitialOrganicSpinsSnake int     `json:"initial_organic_spins,omitempty"`
	InitialSpinsSnake        int     `json:"initial_spins,omitempty"`
	ReferrerSpins            int     `json:"referrerSpins"`
	ReferrerSpinsSnake       int     `json:"referrer_spins,omitempty"`
	ReferrerDiamonds         int64   `json:"referrerDiamonds"`
	ReferrerDiamondsSnake    int64   `json:"referrer_diamonds,omitempty"`
	ReferrerUSD              float64 `json:"referrerUsd"`
	ReferrerUSDSnake         float64 `json:"referrer_usd,omitempty"`
	WelcomeSpins             int     `json:"welcomeSpins"`
	WelcomeSpinsSnake        int     `json:"welcome_spins,omitempty"`
	WelcomeDiamonds          int64   `json:"welcomeDiamonds"`
	WelcomeDiamondsSnake     int64   `json:"welcome_diamonds,omitempty"`
	WelcomeUSD               float64 `json:"welcomeUsd"`
	WelcomeUSDSnake          float64 `json:"welcome_usd,omitempty"`
}
