package model

import "time"

type RaffleCardResponse struct {
	ID                 string  `json:"id"`
	Title              string  `json:"title"`
	CashReward         float64 `json:"cashReward"`
	CashRewardSnake    float64 `json:"cash_reward,omitempty"`
	CoinRewardStr      string  `json:"coinRewardStr"`
	CoinRewardStrSnake string  `json:"coin_reward_str,omitempty"`
	TicketPriceGems    int     `json:"ticketPriceGems"`
	TicketPriceUSD     float64 `json:"ticketPriceUsd"`
	TicketPriceStars   int     `json:"ticketPriceStars"`
	TicketGemPrice     int     `json:"ticketGemPrice"`
	EnableUSDPayment   bool    `json:"enableUsdPayment"`
	EnableStarsPayment bool    `json:"enableStarsPayment"`
	EnableGemsPayment  bool    `json:"enableGemsPayment"`
	MaxTicketsPerUser  int     `json:"maxTicketsPerUser"`
	TotalTicketsSold   int     `json:"totalTicketsSold"`
	Participants       int     `json:"participants"`
	Tickets            int     `json:"tickets"`
	UserTickets        int                  `json:"userTickets"`
	UserTicketsSnake   int                  `json:"user_tickets"`
	Status             string               `json:"status"` // 'ongoing', 'ended'
	StartsAt           string               `json:"startsAt,omitempty"`
	EndsAt             string               `json:"endsAt,omitempty"`
	PrizeTiers         []PrizeTier          `json:"prizeTiers,omitempty"`
	Winners            []RaffleWinnerResult `json:"winners,omitempty"`
}

type PrizeTierConfig struct {
	Rank         string  `json:"rank"`
	Medal        string  `json:"medal"`
	RewardType   string  `json:"reward_type"` // "usd", "diamonds"
	Amount       float64 `json:"amount"`
	AmountStr    string  `json:"amount_str"`
	Icon         string  `json:"icon,omitempty"`
	Multiplier   string  `json:"multiplier,omitempty"`
	WinnersCount int     `json:"winners_count"`
	Highlight    bool    `json:"highlight"`
}

type PrizeTier struct {
	Medal        string  `json:"medal"`
	Rank         string  `json:"rank"`
	RewardType   string  `json:"reward_type,omitempty"`
	Amount       string  `json:"amount"`
	AmountVal    float64 `json:"amount_val,omitempty"`
	Icon         string  `json:"icon,omitempty"`
	Multiplier   string  `json:"multiplier"`
	WinnersCount int     `json:"winners_count,omitempty"`
	Highlight    bool    `json:"highlight"`
}

type RaffleWinnerResult struct {
	TierRank   string  `json:"tier_rank"`
	UserID     int64   `json:"user_id"`
	TelegramID int64   `json:"telegram_id,omitempty"`
	Name       string  `json:"name"`
	Username   string  `json:"username,omitempty"`
	Prize      string  `json:"prize"`
	RewardType string  `json:"reward_type"`
	Amount     float64 `json:"amount"`
	WonAt      string  `json:"won_at,omitempty"`
}

type RaffleDetailsResponse struct {
	Raffle             RaffleCardResponse   `json:"raffle"`
	UserTickets        int                  `json:"userTickets"`
	UserTicketsSnake   int                  `json:"user_tickets"`
	TicketPriceGems    int                  `json:"ticketPriceGems"`
	TicketPriceGemsS   int                  `json:"ticket_price_gems,omitempty"`
	TicketPriceUSD     float64              `json:"ticketPriceUsd"`
	TicketPriceUSDS    float64              `json:"ticket_price_usd,omitempty"`
	TicketPriceStars   int                  `json:"ticketPriceStars"`
	TicketPriceStarsS  int                  `json:"ticket_price_stars,omitempty"`
	TicketGemPrice     int                  `json:"ticketGemPrice"`
	TicketGemPriceS    int                  `json:"ticket_gem_price,omitempty"`
	EnableUSDPayment   bool                 `json:"enableUsdPayment"`
	EnableUSDPaymentS  bool                 `json:"enable_usd_payment,omitempty"`
	EnableStarsPayment bool                 `json:"enableStarsPayment"`
	EnableStarsPaymentS bool                `json:"enable_stars_payment,omitempty"`
	EnableGemsPayment  bool                 `json:"enableGemsPayment"`
	EnableGemsPaymentS bool                 `json:"enable_gems_payment,omitempty"`
	MaxTicketsPerUser  int                  `json:"maxTicketsPerUser"`
	MaxTicketsPerUserS int                  `json:"max_tickets_per_user,omitempty"`
	TotalTicketsSold   int                  `json:"totalTicketsSold"`
	TotalTicketsSoldS  int                  `json:"total_tickets_sold,omitempty"`
	EndsTimestamp      int64                `json:"endsTimestamp"`
	EndsTimestampSnake int64                `json:"ends_timestamp,omitempty"`
	SecondsLeft        int64                `json:"secondsLeft"`
	SecondsLeftSnake   int64                `json:"seconds_left,omitempty"`
	PrizeTiers         []PrizeTier          `json:"prizeTiers"`
	Winners            []RaffleWinnerResult `json:"winners,omitempty"`
}

type ClaimRaffleTicketRequest struct {
	Method        string `json:"method"`         // 'gems', 'vip', 'stars_5', 'stars_20', 'usdt'
	PaymentMethod string `json:"payment_method"` // 'usdt', 'gems', 'diamonds', 'stars'
	TicketCount   int    `json:"ticket_count"`
	Tickets       int    `json:"tickets"`
}

type BuyRaffleTicketsRequest struct {
	TicketCount   int    `json:"ticket_count"`
	Tickets       int    `json:"tickets"`
	PaymentMethod string `json:"payment_method"` // 'usdt', 'gems', 'diamonds', 'stars'
	Method        string `json:"method"`
}

type ClaimRaffleTicketResponse struct {
	TicketsAdded     int           `json:"ticketsAdded"`
	TicketsAddedS    int           `json:"tickets_added,omitempty"`
	TicketsPurchased int           `json:"ticketsPurchased"`
	TicketsPurchasedS int          `json:"tickets_purchased,omitempty"`
	TotalTickets     int           `json:"totalTickets"`
	TotalTicketsS    int           `json:"total_tickets,omitempty"`
	TotalUserTickets int           `json:"totalUserTickets"`
	TotalUserTicketsS int          `json:"total_user_tickets,omitempty"`
	TxID             string        `json:"txId"`
	TxIDS            string        `json:"tx_id,omitempty"`
	UserBalance      UserResponse  `json:"userBalance"`
	User             *UserResponse `json:"user,omitempty"`
}

type RaffleStarsInvoiceRequest struct {
	TicketCount int `json:"ticket_count"`
	Tickets     int `json:"tickets"`
}

type RaffleStarsInvoiceResponse struct {
	InvoiceLink  string `json:"invoiceLink"`
	InvoiceLinkS string `json:"invoice_link,omitempty"`
	TotalStars   int    `json:"totalStars"`
	TotalStarsS  int    `json:"total_stars,omitempty"`
	TicketCount  int    `json:"ticketCount"`
	TicketCountS int    `json:"ticket_count,omitempty"`
}

type AdminCreateRaffleRequest struct {
	RaffleID           string     `json:"raffle_id"`
	ID                 string     `json:"id"`
	Title              string     `json:"title" binding:"required"`
	CashReward         float64    `json:"cash_reward"`
	CashPrizeUSD       float64    `json:"cash_prize_usd"`
	CoinRewardStr      string     `json:"coin_reward_str"`
	TicketPriceUSD     float64    `json:"ticket_price_usd"`
	TicketPriceStars   int        `json:"ticket_price_stars"`
	TicketGemPrice     int        `json:"ticket_gem_price"`
	TicketPriceGems    int        `json:"ticket_price_gems"`
	EnableUSDPayment   *bool      `json:"enable_usd_payment"`
	EnableStarsPayment *bool      `json:"enable_stars_payment"`
	EnableGemsPayment  *bool      `json:"enable_gems_payment"`
	MaxTicketsPerUser  int               `json:"max_tickets_per_user"`
	DurationDays       int               `json:"duration_days"`
	EndsAt             *time.Time        `json:"ends_at"`
	PrizeTiers         []PrizeTierConfig `json:"prize_tiers,omitempty"`
}
