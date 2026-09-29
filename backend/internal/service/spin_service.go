package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"sync"
	"time"

	"earnminiapp/internal/db"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/pkg/rng"
	"earnminiapp/pkg/util"
)

type SpinService struct {
	userRepo     *repository.UserRepository
	txRepo       *repository.TransactionRepository
	taskRepo     *repository.TaskRepository
	walletRepo   *repository.WalletRepository
	settingsRepo *repository.SystemSettingsRepository
	redis        *db.RedisService
	userLocks    sync.Map
}

func NewSpinService(
	userRepo *repository.UserRepository,
	txRepo *repository.TransactionRepository,
	taskRepo *repository.TaskRepository,
	walletRepo *repository.WalletRepository,
	redis *db.RedisService,
	settingsRepo *repository.SystemSettingsRepository,
) *SpinService {
	return &SpinService{
		userRepo:     userRepo,
		txRepo:       txRepo,
		taskRepo:     taskRepo,
		walletRepo:   walletRepo,
		settingsRepo: settingsRepo,
		redis:        redis,
	}
}

func (s *SpinService) getUserLock(userID int64) *sync.Mutex {
	val, _ := s.userLocks.LoadOrStore(userID, &sync.Mutex{})
	return val.(*sync.Mutex)
}

// 6 Frontend wheel segments matching the UI
var defaultSegments = []model.SpinSegment{
	{Label: "Diamond", Value: "gem", Image: "./assets/purple-diamond.png"},
	{Label: "Coins", Value: "coins", Image: "./assets/coin_3d.png"},
	{Label: "Spin Ticket", Value: "spin_ticket", Image: "./assets/wheel-of-fortune.png"},
	{Label: "Double Reward", Value: "double_reward", Image: "./assets/gift.png"},
	{Label: "Spin Ticket x2", Value: "spin_ticket_2", Image: "./assets/wheel-of-fortune.png"},
	{Label: "Mega Diamonds", Value: "gem_large", Image: "./assets/purple-diamond.png"},
}

// GetWheelSettings fetches live probability weights and prize configurations
func (s *SpinService) GetWheelSettings(ctx context.Context) (*model.WheelSettingsResponse, error) {
	weightGem := 30
	weightCoins := 25
	weightTicket := 15
	weightDouble := 8
	weightTicket2 := 10
	weightGemLarge := 12

	diamondReward := int64(80)
	megaDiamondReward := int64(300)
	minCash := 0.01
	maxCash := 0.05

	if s.settingsRepo != nil {
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_gem"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightGem = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_coins"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightCoins = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_spin_ticket"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightTicket = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_double_reward"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightDouble = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_spin_ticket_2"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightTicket2 = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_weight_gem_large"); val != "" {
			if w, err := strconv.Atoi(val); err == nil && w >= 0 {
				weightGemLarge = w
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_diamond_reward"); val != "" {
			if d, err := strconv.ParseInt(val, 10, 64); err == nil && d > 0 {
				diamondReward = d
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_mega_diamond_reward"); val != "" {
			if d, err := strconv.ParseInt(val, 10, 64); err == nil && d > 0 {
				megaDiamondReward = d
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_min_cash_reward"); val != "" {
			if c, err := strconv.ParseFloat(val, 64); err == nil && c > 0 {
				minCash = c
			}
		}
		if val, _ := s.settingsRepo.Get(ctx, "wheel_max_cash_reward"); val != "" {
			if c, err := strconv.ParseFloat(val, 64); err == nil && c > 0 {
				maxCash = c
			}
		}
	}

	totalWeight := weightGem + weightCoins + weightTicket + weightDouble + weightTicket2 + weightGemLarge
	if totalWeight <= 0 {
		totalWeight = 100
	}

	calcPercent := func(w int) float64 {
		return math.Round((float64(w)/float64(totalWeight))*10000) / 100.0
	}

	items := []model.WheelItemSetting{
		{
			Index:             0,
			Value:             "gem",
			Label:             "Diamond",
			Weight:            weightGem,
			Percent:           calcPercent(weightGem),
			RewardAmount:      fmt.Sprintf("+%d 💎", diamondReward),
			RewardAmountSnake: fmt.Sprintf("+%d 💎", diamondReward),
		},
		{
			Index:             1,
			Value:             "coins",
			Label:             "Coins (USD Cash)",
			Weight:            weightCoins,
			Percent:           calcPercent(weightCoins),
			RewardAmount:      fmt.Sprintf("+$%.2f - $%.2f", minCash, maxCash),
			RewardAmountSnake: fmt.Sprintf("+$%.2f - $%.2f", minCash, maxCash),
		},
		{
			Index:             2,
			Value:             "spin_ticket",
			Label:             "Spin Ticket",
			Weight:            weightTicket,
			Percent:           calcPercent(weightTicket),
			RewardAmount:      "+1 Free Spin",
			RewardAmountSnake: "+1 Free Spin",
		},
		{
			Index:             3,
			Value:             "double_reward",
			Label:             "Double Reward",
			Weight:            weightDouble,
			Percent:           calcPercent(weightDouble),
			RewardAmount:      "2x Multiplier",
			RewardAmountSnake: "2x Multiplier",
		},
		{
			Index:             4,
			Value:             "spin_ticket_2",
			Label:             "Spin Ticket x2",
			Weight:            weightTicket2,
			Percent:           calcPercent(weightTicket2),
			RewardAmount:      "+2 Free Spins",
			RewardAmountSnake: "+2 Free Spins",
		},
		{
			Index:             5,
			Value:             "gem_large",
			Label:             "Mega Diamonds",
			Weight:            weightGemLarge,
			Percent:           calcPercent(weightGemLarge),
			RewardAmount:      fmt.Sprintf("+%d 💎", megaDiamondReward),
			RewardAmountSnake: fmt.Sprintf("+%d 💎", megaDiamondReward),
		},
	}

	return &model.WheelSettingsResponse{
		Items:                  items,
		TotalWeight:            totalWeight,
		TotalWeightSnake:       totalWeight,
		DiamondReward:          diamondReward,
		DiamondRewardSnake:     diamondReward,
		MegaDiamondReward:      megaDiamondReward,
		MegaDiamondRewardSnake: megaDiamondReward,
		MinCashReward:          minCash,
		MinCashRewardSnake:     minCash,
		MaxCashReward:          maxCash,
		MaxCashRewardSnake:     maxCash,
	}, nil
}

// UpdateWheelSettings saves probability weights and prize configs
func (s *SpinService) UpdateWheelSettings(ctx context.Context, settings map[string]string) (*model.WheelSettingsResponse, error) {
	if s.settingsRepo == nil {
		return nil, errors.New("settings repository unavailable")
	}

	for k, v := range settings {
		_ = s.settingsRepo.Set(ctx, k, v)
	}

	return s.GetWheelSettings(ctx)
}

func (s *SpinService) ExecuteSpin(ctx context.Context, userID int64, method string) (*model.ServerSpinResponse, error) {
	// 0. Concurrency Lock: Prevent parallel in-flight spin requests from same user
	mu := s.getUserLock(userID)
	if !mu.TryLock() {
		return nil, errors.New("a spin is already in progress, please wait")
	}
	defer mu.Unlock()

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// 1. Quota Validation & Atomic Deduction: Prioritize Free Spins, fallback to 1,000 Diamonds
	switch method {
	case "spins":
		if err := s.userRepo.DeductSpinCost(ctx, userID, "spins", 1); err != nil {
			return nil, errors.New("insufficient spins")
		}
	case "diamonds":
		if err := s.userRepo.DeductSpinCost(ctx, userID, "diamonds", 1000); err != nil {
			return nil, errors.New("insufficient diamonds (requires 1,000 💎)")
		}
	default: // "auto" or empty
		if err := s.userRepo.DeductSpinCost(ctx, userID, "spins", 1); err != nil {
			if errD := s.userRepo.DeductSpinCost(ctx, userID, "diamonds", 1000); errD != nil {
				return nil, errors.New("insufficient spins or diamonds")
			}
		}
	}

	// 2. Fetch live probability weights & configs
	wheelSettings, _ := s.GetWheelSettings(ctx)
	diamondReward := int64(80)
	megaDiamondReward := int64(300)
	minCash := 0.01
	maxCash := 0.05
	if wheelSettings != nil {
		if wheelSettings.DiamondReward > 0 {
			diamondReward = wheelSettings.DiamondReward
		}
		if wheelSettings.MegaDiamondReward > 0 {
			megaDiamondReward = wheelSettings.MegaDiamondReward
		}
		if wheelSettings.MinCashReward > 0 {
			minCash = wheelSettings.MinCashReward
		}
		if wheelSettings.MaxCashReward > 0 {
			maxCash = wheelSettings.MaxCashReward
		}
	}

	// Dynamic Cash Reward Calculation based on progress to $1.00 and withdrawal history
	dynamicCashUSD := s.calculateDynamicCashReward(ctx, userID, user.BalanceUSD, minCash, maxCash)

	// 3. Weighted Probability Roll (Dynamic Weights)
	var weightedItems []rng.WeightedItem
	if wheelSettings != nil && len(wheelSettings.Items) >= 6 {
		for _, item := range wheelSettings.Items {
			amount := item.RewardAmount
			if item.Value == "coins" {
				amount = fmt.Sprintf("+$%.2f", dynamicCashUSD)
			}
			weightedItems = append(weightedItems, rng.WeightedItem{
				Index:  item.Index,
				Weight: item.Weight,
				Value:  item.Value,
				Label:  item.Label,
				Amount: amount,
			})
		}
	} else {
		weightedItems = []rng.WeightedItem{
			{Index: 0, Weight: 30 + rand.Intn(5), Value: "gem", Label: "Diamond", Amount: fmt.Sprintf("+%d 💎", diamondReward)},
			{Index: 1, Weight: 25 + rand.Intn(5), Value: "coins", Label: "Coins", Amount: fmt.Sprintf("+$%.2f", dynamicCashUSD)},
			{Index: 2, Weight: 15 + rand.Intn(4), Value: "spin_ticket", Label: "Spin Ticket", Amount: "+1 Free Spin"},
			{Index: 3, Weight: 8 + rand.Intn(3), Value: "double_reward", Label: "Double Reward", Amount: "2x Multiplier"},
			{Index: 4, Weight: 10 + rand.Intn(3), Value: "spin_ticket_2", Label: "Spin Ticket x2", Amount: "+2 Free Spins"},
			{Index: 5, Weight: 12 + rand.Intn(4), Value: "gem_large", Label: "Mega Diamonds", Amount: fmt.Sprintf("+%d 💎", megaDiamondReward)},
		}
	}

	wonItem, err := rng.RollWeighted(weightedItems)
	if err != nil {
		return nil, fmt.Errorf("failed to roll spin: %w", err)
	}

	// 4. Resolve Reward Deltas & Handle Double Reward Multiplier
	var prizeUSD float64 = 0.0
	var prizeDiamonds int64 = 0
	var prizeSpins int = 0
	isDouble := false
	multiplier := 1
	baseAmount := wonItem.Amount
	finalAmount := wonItem.Amount

	if wonItem.Value == "double_reward" {
		isDouble = true
		multiplier = 2
		// Roll a base prize to double
		subRoll := rand.Intn(3)
		switch subRoll {
		case 0: // Double Cash
			prizeUSD = dynamicCashUSD * 2.0
			baseAmount = fmt.Sprintf("+$%.2f", dynamicCashUSD)
			finalAmount = fmt.Sprintf("+$%.2f (2x)", prizeUSD)
		case 1: // Double Diamonds
			prizeDiamonds = megaDiamondReward * 2
			baseAmount = fmt.Sprintf("+%d 💎", megaDiamondReward)
			finalAmount = fmt.Sprintf("+%d 💎 (2x)", prizeDiamonds)
		default: // Double Spins
			prizeSpins = 2 * 2 // 4 Spins
			baseAmount = "+2 Free Spins"
			finalAmount = "+4 Free Spins (2x)"
		}
	} else {
		switch wonItem.Value {
		case "coins":
			prizeUSD = dynamicCashUSD
		case "spin_ticket":
			prizeSpins = 1
		case "spin_ticket_2":
			prizeSpins = 2
		case "gem_large":
			prizeDiamonds = megaDiamondReward
		default: // "gem"
			prizeDiamonds = diamondReward
		}
	}

	// 5. Update balances atomically in DB (cost already deducted atomically)
	updatedUser, err := s.userRepo.MutateBalances(ctx, userID, prizeSpins, prizeDiamonds, prizeUSD, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to adjust user balance: %w", err)
	}

	// 6. Record transaction ledger with unique ReferenceID
	spinTxID := util.GenerateTXID("SPIN")
	if s.txRepo != nil {
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:         userID,
			Category:       "spins",
			Title:          "Wheel of Fortune Win",
			AmountUSD:      prizeUSD,
			AmountDiamonds: prizeDiamonds,
			AmountSpins:    prizeSpins,
			Status:         "completed",
			ReferenceID:    spinTxID,
			Description:    fmt.Sprintf("Spin reward: %s (%s)", wonItem.Label, finalAmount),
		})
	}

	// 7. Increment Weekly Tournament Leaderboard score in Redis
	if s.redis != nil {
		_, _ = s.redis.ZIncrBy(ctx, "tournament:spins:current_week", 1, fmt.Sprintf("%d", userID))
	}

	// 8. Update Task Progress (e.g. daily spin tasks & milestone spin quests)
	if s.taskRepo != nil {
		_ = s.taskRepo.UpsertProgress(ctx, userID, "daily-1", 1, "pending")
		_ = s.taskRepo.IncrementSpinProgress(ctx, userID)
	}

	return &model.ServerSpinResponse{
		TargetIndex: wonItem.Index,
		IsDouble:    isDouble,
		Reward: model.SpinReward{
			ID:          fmt.Sprintf("rew-%d", time.Now().UnixNano()),
			Label:       wonItem.Label,
			Value:       wonItem.Value,
			Amount:      finalAmount,
			Image:       defaultSegments[wonItem.Index].Image,
			IsDouble:    isDouble,
			Multiplier:  multiplier,
			BaseAmount:  baseAmount,
			FinalAmount: finalAmount,
		},
		TxID:      spinTxID,
		Timestamp: time.Now().Unix(),
		UserBalance: model.SpinBalance{
			Spins:           updatedUser.Spins,
			Diamonds:        updatedUser.Diamonds,
			DiamondsSnake:   updatedUser.Diamonds,
			BalanceUSD:      updatedUser.BalanceUSD,
			BalanceUSDSnake: updatedUser.BalanceUSD,
			Level:           updatedUser.Level,
			Energy:          updatedUser.Energy,
			MaxEnergy:       updatedUser.MaxEnergy,
			MaxEnergyCamel:  updatedUser.MaxEnergy,
		},
		User: &model.SpinBalance{
			Spins:           updatedUser.Spins,
			Diamonds:        updatedUser.Diamonds,
			DiamondsSnake:   updatedUser.Diamonds,
			BalanceUSD:      updatedUser.BalanceUSD,
			BalanceUSDSnake: updatedUser.BalanceUSD,
			Level:           updatedUser.Level,
			Energy:          updatedUser.Energy,
			MaxEnergy:       updatedUser.MaxEnergy,
			MaxEnergyCamel:  updatedUser.MaxEnergy,
		},
	}, nil
}

func (s *SpinService) calculateDynamicCashReward(ctx context.Context, userID int64, currentBalanceUSD float64, minCash, maxCash float64) float64 {
	hasWithdrawn := false
	if s.walletRepo != nil && userID != 0 {
		if hw, err := s.walletRepo.HasUserWithdrawn(ctx, userID); err == nil {
			hasWithdrawn = hw
		}
	}

	if minCash <= 0 {
		minCash = 0.01
	}
	if maxCash <= minCash {
		maxCash = minCash + 0.04
	}

	var dynamicCashUSD float64

	// If the user has already requested or completed a withdrawal before:
	// They receive standard baseline cash rewards (minCash to maxCash), never the high initial starter boost.
	if hasWithdrawn {
		spread := maxCash - minCash
		dynamicCashUSD = minCash + rand.Float64()*spread
		res := math.Round(dynamicCashUSD*100) / 100
		if res < 0.01 {
			res = 0.01
		}
		return res
	}

	// For first-time users progressing towards their $1.00 goal:
	if currentBalanceUSD < 0.40 {
		// First big starter win
		dynamicCashUSD = 0.40 + rand.Float64()*0.20 // 0.40 - 0.60
	} else if currentBalanceUSD < 0.65 {
		// Second progression step
		dynamicCashUSD = 0.15 + rand.Float64()*0.10 // 0.15 - 0.25
	} else if currentBalanceUSD < 0.85 {
		// Third progression step
		dynamicCashUSD = 0.06 + rand.Float64()*0.06 // 0.06 - 0.12
	} else if currentBalanceUSD < 0.95 {
		// Approaching $1.00
		dynamicCashUSD = 0.02 + rand.Float64()*0.03 // 0.02 - 0.05
	} else if currentBalanceUSD < 1.00 {
		// Final step to hit $1.00
		dynamicCashUSD = 0.01 + rand.Float64()*0.01 // 0.01 - 0.02
	} else {
		// At $1.00 or higher balance:
		// Curve becomes a flat steady line - users can STILL win USD cash in the steady range ($0.01 - $0.10), NEVER $0.00!
		spread := math.Max(0.04, maxCash-minCash)
		dynamicCashUSD = minCash + rand.Float64()*spread
	}

	res := math.Round(dynamicCashUSD*100) / 100
	if res < 0.01 {
		res = 0.01
	}
	return res
}
