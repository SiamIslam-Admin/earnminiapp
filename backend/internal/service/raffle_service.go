package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
)

type RaffleService struct {
	userRepo   *repository.UserRepository
	raffleRepo *repository.RaffleRepository
	txRepo     *repository.TransactionRepository
	botClient  *telegram.BotClient
}

func NewRaffleService(
	userRepo *repository.UserRepository,
	raffleRepo *repository.RaffleRepository,
	txRepo *repository.TransactionRepository,
	botClient *telegram.BotClient,
) *RaffleService {
	return &RaffleService{
		userRepo:   userRepo,
		raffleRepo: raffleRepo,
		txRepo:     txRepo,
		botClient:  botClient,
	}
}

func (s *RaffleService) GetRaffles(ctx context.Context, userID int64) ([]model.RaffleCardResponse, error) {
	list, err := s.raffleRepo.GetRaffles(ctx)
	if err != nil {
		return nil, err
	}

	var res []model.RaffleCardResponse
	for _, r := range list {
		userTickets := 0
		if userID > 0 {
			userTickets, _ = s.raffleRepo.GetUserTicketsCount(ctx, r.ID, userID)
		}

		tiers := parsePrizeTiers(r.PrizeTiers, r.CashReward)
		winners := parseWinnersJSON(r.WinnersJSON)

		res = append(res, model.RaffleCardResponse{
			ID:                 r.ID,
			Title:              r.Title,
			CashReward:         r.CashReward,
			CashRewardSnake:    r.CashReward,
			CoinRewardStr:      r.CoinRewardStr,
			CoinRewardStrSnake: r.CoinRewardStr,
			TicketPriceGems:    r.TicketPriceGems,
			TicketPriceUSD:     r.TicketPriceUSD,
			TicketPriceStars:   r.TicketPriceStars,
			TicketGemPrice:     r.TicketGemPrice,
			EnableUSDPayment:   r.EnableUSDPayment,
			EnableStarsPayment: r.EnableStarsPayment,
			EnableGemsPayment:  r.EnableGemsPayment,
			MaxTicketsPerUser:  r.MaxTicketsPerUser,
			TotalTicketsSold:   r.TotalTicketsSold,
			Participants:       r.ParticipantsCount,
			Tickets:            r.TotalTicketsCount,
			UserTickets:        userTickets,
			UserTicketsSnake:   userTickets,
			Status:             r.Status,
			StartsAt:           r.StartsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			EndsAt:             r.EndsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			PrizeTiers:         tiers,
			Winners:            winners,
		})
	}
	return res, nil
}

func (s *RaffleService) GetRaffleDetails(ctx context.Context, raffleID string, userID int64) (*model.RaffleDetailsResponse, error) {
	r, err := s.raffleRepo.GetRaffleByID(ctx, raffleID)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, errors.New("raffle not found")
	}

	userTickets := 0
	if userID > 0 {
		userTickets, _ = s.raffleRepo.GetUserTicketsCount(ctx, raffleID, userID)
	}

	secondsLeft := int64(time.Until(r.EndsAt).Seconds())
	if secondsLeft < 0 {
		secondsLeft = 0
	}

	prizeTiers := parsePrizeTiers(r.PrizeTiers, r.CashReward)
	winners := parseWinnersJSON(r.WinnersJSON)

	raffleCard := model.RaffleCardResponse{
		ID:                 r.ID,
		Title:              r.Title,
		CashReward:         r.CashReward,
		CashRewardSnake:    r.CashReward,
		CoinRewardStr:      r.CoinRewardStr,
		CoinRewardStrSnake: r.CoinRewardStr,
		TicketPriceGems:    r.TicketPriceGems,
		TicketPriceUSD:     r.TicketPriceUSD,
		TicketPriceStars:   r.TicketPriceStars,
		TicketGemPrice:     r.TicketGemPrice,
		EnableUSDPayment:   r.EnableUSDPayment,
		EnableStarsPayment: r.EnableStarsPayment,
		EnableGemsPayment:  r.EnableGemsPayment,
		MaxTicketsPerUser:  r.MaxTicketsPerUser,
		TotalTicketsSold:   r.TotalTicketsSold,
		Participants:       r.ParticipantsCount,
		Tickets:            r.TotalTicketsCount,
		UserTickets:        userTickets,
		UserTicketsSnake:   userTickets,
		Status:             r.Status,
		StartsAt:           r.StartsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		EndsAt:             r.EndsAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		PrizeTiers:         prizeTiers,
		Winners:            winners,
	}

	return &model.RaffleDetailsResponse{
		Raffle:              raffleCard,
		UserTickets:         userTickets,
		UserTicketsSnake:    userTickets,
		TicketPriceGems:     r.TicketPriceGems,
		TicketPriceGemsS:    r.TicketPriceGems,
		TicketPriceUSD:      r.TicketPriceUSD,
		TicketPriceUSDS:     r.TicketPriceUSD,
		TicketPriceStars:    r.TicketPriceStars,
		TicketPriceStarsS:   r.TicketPriceStars,
		TicketGemPrice:      r.TicketGemPrice,
		TicketGemPriceS:     r.TicketGemPrice,
		EnableUSDPayment:    r.EnableUSDPayment,
		EnableUSDPaymentS:   r.EnableUSDPayment,
		EnableStarsPayment:  r.EnableStarsPayment,
		EnableStarsPaymentS: r.EnableStarsPayment,
		EnableGemsPayment:   r.EnableGemsPayment,
		EnableGemsPaymentS:  r.EnableGemsPayment,
		MaxTicketsPerUser:   r.MaxTicketsPerUser,
		MaxTicketsPerUserS:  r.MaxTicketsPerUser,
		TotalTicketsSold:    r.TotalTicketsSold,
		TotalTicketsSoldS:   r.TotalTicketsSold,
		EndsTimestamp:       r.EndsAt.UnixMilli(),
		EndsTimestampSnake:  r.EndsAt.UnixMilli(),
		SecondsLeft:         secondsLeft,
		SecondsLeftSnake:    secondsLeft,
		PrizeTiers:          prizeTiers,
		Winners:             winners,
	}, nil
}

func parsePrizeTiers(raw []byte, cashReward float64) []model.PrizeTier {
	var list []model.PrizeTierConfig
	if len(raw) > 0 && string(raw) != "[]" && string(raw) != "null" {
		_ = json.Unmarshal(raw, &list)
	}

	if len(list) == 0 {
		return []model.PrizeTier{
			{Medal: "🥇", Rank: "1st Prize", RewardType: "usd", Amount: fmt.Sprintf("$%.2f", cashReward*0.50), AmountVal: cashReward * 0.50, Multiplier: "x 1 Winner", WinnersCount: 1, Highlight: true},
			{Medal: "🥈", Rank: "2nd Prize", RewardType: "usd", Amount: fmt.Sprintf("$%.2f", cashReward*0.30), AmountVal: cashReward * 0.30, Multiplier: "x 2 Winners", WinnersCount: 2, Highlight: false},
			{Medal: "🥉", Rank: "3rd Prize", RewardType: "usd", Amount: fmt.Sprintf("$%.2f", cashReward*0.20), AmountVal: cashReward * 0.20, Multiplier: "x 6 Winners", WinnersCount: 6, Highlight: false},
			{Medal: "💎", Rank: "4th Prize", RewardType: "diamonds", Amount: "5,000", AmountVal: 5000, Icon: "./assets/purple-diamond.png", Multiplier: "x 20 Winners", WinnersCount: 20, Highlight: false},
			{Medal: "💎", Rank: "5th Prize", RewardType: "diamonds", Amount: "800", AmountVal: 800, Icon: "./assets/purple-diamond.png", Multiplier: "x 100 Winners", WinnersCount: 100, Highlight: false},
		}
	}

	var res []model.PrizeTier
	for _, t := range list {
		multiplier := t.Multiplier
		if multiplier == "" {
			if t.WinnersCount > 1 {
				multiplier = fmt.Sprintf("x %d Winners", t.WinnersCount)
			} else {
				multiplier = "x 1 Winner"
			}
		}

		amtStr := t.AmountStr
		if amtStr == "" {
			if t.RewardType == "diamonds" {
				amtStr = formatNumberCommas(int64(t.Amount))
			} else {
				amtStr = fmt.Sprintf("$%.2f", t.Amount)
			}
		}

		icon := t.Icon
		if icon == "" && t.RewardType == "diamonds" {
			icon = "./assets/purple-diamond.png"
		}

		winnersCount := t.WinnersCount
		if winnersCount <= 0 {
			winnersCount = 1
		}

		res = append(res, model.PrizeTier{
			Medal:        t.Medal,
			Rank:         t.Rank,
			RewardType:   t.RewardType,
			Amount:       amtStr,
			AmountVal:    t.Amount,
			Icon:         icon,
			Multiplier:   multiplier,
			WinnersCount: winnersCount,
			Highlight:    t.Highlight,
		})
	}
	return res
}

func parseWinnersJSON(raw []byte) []model.RaffleWinnerResult {
	if len(raw) == 0 || string(raw) == "[]" || string(raw) == "null" {
		return nil
	}
	var res []model.RaffleWinnerResult
	_ = json.Unmarshal(raw, &res)
	return res
}

func formatNumberCommas(n int64) string {
	in := fmt.Sprintf("%d", n)
	var out []rune
	l := len(in)
	for i, r := range in {
		out = append(out, r)
		if (l-i-1)%3 == 0 && i != l-1 {
			out = append(out, ',')
		}
	}
	return string(out)
}

// BuyTickets handles ticket purchasing via USDT balance, Diamonds/Gems, or VIP bonus
func (s *RaffleService) BuyTickets(ctx context.Context, raffleID string, userID int64, ticketCount int, paymentMethod string) (*model.ClaimRaffleTicketResponse, error) {
	if ticketCount <= 0 {
		ticketCount = 1
	}

	if s.userRepo == nil {
		return nil, errors.New("user repository unavailable")
	}
	if s.raffleRepo == nil {
		return nil, errors.New("raffle repository unavailable")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	r, err := s.raffleRepo.GetRaffleByID(ctx, raffleID)
	if err != nil || r == nil {
		return nil, errors.New("raffle not found")
	}

	if r.Status == "ended" || time.Now().After(r.EndsAt) {
		return nil, errors.New("this raffle has already ended")
	}

	userTickets, _ := s.raffleRepo.GetUserTicketsCount(ctx, raffleID, userID)
	if r.MaxTicketsPerUser > 0 && userTickets+ticketCount > r.MaxTicketsPerUser {
		return nil, fmt.Errorf("exceeds max limit of %d tickets per user (you have %d)", r.MaxTicketsPerUser, userTickets)
	}

	paymentMethod = strings.ToLower(strings.TrimSpace(paymentMethod))
	var diamondCost int64 = 0
	var usdCost float64 = 0.0

	switch paymentMethod {
	case "usdt", "usd", "cash":
		if !r.EnableUSDPayment {
			return nil, errors.New("USDT payment is not enabled for this raffle")
		}
		unitPrice := r.TicketPriceUSD
		if unitPrice <= 0 {
			unitPrice = 0.50
		}
		usdCost = float64(ticketCount) * unitPrice
		if user.BalanceUSD < usdCost {
			return nil, fmt.Errorf("insufficient USDT balance (required: $%.2f, available: $%.2f)", usdCost, user.BalanceUSD)
		}

	case "gems", "diamonds", "diamond", "":
		if !r.EnableGemsPayment {
			return nil, errors.New("diamonds exchange is not enabled for this raffle")
		}
		unitPrice := int64(r.TicketGemPrice)
		if unitPrice <= 0 {
			unitPrice = int64(r.TicketPriceGems)
		}
		if unitPrice <= 0 {
			unitPrice = 200
		}
		diamondCost = int64(ticketCount) * unitPrice
		if user.Diamonds < diamondCost {
			return nil, fmt.Errorf("insufficient diamonds (required: %d 💎, available: %d 💎)", diamondCost, user.Diamonds)
		}
		paymentMethod = "gems"

	default:
		// Strictly reject unauthorized bypass methods like "vip", "stars_5", "stars_20"
		return nil, errors.New("invalid or unsupported payment method")
	}

	if diamondCost <= 0 && usdCost <= 0 {
		return nil, errors.New("invalid payment amount")
	}

	// Atomically deduct cost from user balance with strict conditional check
	var updatedUser *model.User = user
	updatedUser, err = s.userRepo.DeductRaffleCost(ctx, userID, diamondCost, usdCost)
	if err != nil {
		return nil, fmt.Errorf("insufficient balance to purchase tickets: %w", err)
	}

	// Add tickets
	txID := fmt.Sprintf("TX-%d-%d", userID, time.Now().UnixNano()/1e6)
	if err := s.raffleRepo.AddTicketsWithDetails(ctx, raffleID, userID, ticketCount, paymentMethod, paymentMethod, txID); err != nil {
		if diamondCost > 0 || usdCost > 0 {
			_, _ = s.userRepo.MutateBalances(ctx, userID, 0, diamondCost, usdCost, 0)
		}
		return nil, fmt.Errorf("failed to add raffle tickets: %w", err)
	}

	totalUserTickets, _ := s.raffleRepo.GetUserTicketsCount(ctx, raffleID, userID)

	// Ledger transaction
	desc := fmt.Sprintf("+%d Tickets for %s", ticketCount, r.Title)
	if usdCost > 0 {
		desc += fmt.Sprintf(" (Paid $%.2f USDT)", usdCost)
	} else if diamondCost > 0 {
		desc += fmt.Sprintf(" (Paid %d 💎)", diamondCost)
	}

	_ = s.txRepo.Create(ctx, &model.Transaction{
		UserID:         userID,
		Category:       "raffles",
		Title:          fmt.Sprintf("Raffle Tickets (%s)", r.Title),
		AmountUSD:      -usdCost,
		AmountDiamonds: -diamondCost,
		AmountTickets:  ticketCount,
		Status:         "completed",
		ReferenceID:    txID,
		Description:    desc,
	})

	userResp := ToUserResponse(updatedUser)
	return &model.ClaimRaffleTicketResponse{
		TicketsAdded:      ticketCount,
		TicketsAddedS:     ticketCount,
		TicketsPurchased:  ticketCount,
		TicketsPurchasedS: ticketCount,
		TotalTickets:      totalUserTickets,
		TotalTicketsS:     totalUserTickets,
		TotalUserTickets:  totalUserTickets,
		TotalUserTicketsS: totalUserTickets,
		TxID:              txID,
		TxIDS:             txID,
		UserBalance:       userResp,
		User:              &userResp,
	}, nil
}

// ClaimOrBuyTicket maintains backward compatibility with legacy endpoints
func (s *RaffleService) ClaimOrBuyTicket(ctx context.Context, raffleID string, userID int64, method string) (*model.ClaimRaffleTicketResponse, error) {
	return s.BuyTickets(ctx, raffleID, userID, 1, method)
}

// GenerateStarsInvoice generates a Telegram Stars invoice link
func (s *RaffleService) GenerateStarsInvoice(ctx context.Context, raffleID string, userID int64, ticketCount int) (*model.RaffleStarsInvoiceResponse, error) {
	if ticketCount <= 0 {
		ticketCount = 1
	}

	r, err := s.raffleRepo.GetRaffleByID(ctx, raffleID)
	if err != nil || r == nil {
		return nil, errors.New("raffle not found")
	}

	if !r.EnableStarsPayment {
		return nil, errors.New("Telegram Stars payment is not enabled for this raffle")
	}

	userTickets, _ := s.raffleRepo.GetUserTicketsCount(ctx, raffleID, userID)
	if r.MaxTicketsPerUser > 0 && userTickets+ticketCount > r.MaxTicketsPerUser {
		return nil, fmt.Errorf("exceeds max limit of %d tickets per user (you have %d)", r.MaxTicketsPerUser, userTickets)
	}

	unitStars := r.TicketPriceStars
	if unitStars <= 0 {
		unitStars = 25
	}
	totalStars := ticketCount * unitStars

	title := fmt.Sprintf("%dx Tickets: %s", ticketCount, r.Title)
	desc := fmt.Sprintf("Enter %s to win $%.2f USDT cash prize!", r.Title, r.CashReward)
	payload := fmt.Sprintf("stars:%d:raffle_tickets:%s:%d", userID, raffleID, ticketCount)

	invoiceLink := fmt.Sprintf("https://t.me/$mock_raffle_invoice_%d_stars", totalStars)
	if s.botClient != nil {
		link, err := s.botClient.CreateStarsInvoiceLink(title, desc, payload, totalStars)
		if err == nil && link != "" {
			invoiceLink = link
		}
	}

	return &model.RaffleStarsInvoiceResponse{
		InvoiceLink:  invoiceLink,
		InvoiceLinkS: invoiceLink,
		TotalStars:   totalStars,
		TotalStarsS:  totalStars,
		TicketCount:  ticketCount,
		TicketCountS: ticketCount,
	}, nil
}
