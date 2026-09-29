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
	"earnminiapp/pkg/util"
)

type DailyRewardService struct {
	userRepo        *repository.UserRepository
	dailyRewardRepo *repository.DailyRewardRepository
	txRepo          *repository.TransactionRepository
	settingsRepo    *repository.SystemSettingsRepository
}

func NewDailyRewardService(
	userRepo *repository.UserRepository,
	dailyRewardRepo *repository.DailyRewardRepository,
	txRepo *repository.TransactionRepository,
	settingsRepo *repository.SystemSettingsRepository,
) *DailyRewardService {
	return &DailyRewardService{
		userRepo:        userRepo,
		dailyRewardRepo: dailyRewardRepo,
		txRepo:          txRepo,
		settingsRepo:    settingsRepo,
	}
}

var defaultDailyRewards = []model.DailyRewardConfigItem{
	{Day: 1, RewardGems: 80, RewardSpins: 0, RewardUSD: 0.0, Label: "Up to 80 💎", Icon: "./assets/purple-diamond.png", IsMega: false},
	{Day: 2, RewardGems: 80, RewardSpins: 0, RewardUSD: 0.0, Label: "+80 💎", Icon: "./assets/purple-diamond.png", IsMega: false},
	{Day: 3, RewardGems: 200, RewardSpins: 1, RewardUSD: 0.0, Label: "+200 💎 + 1 Spin", Icon: "./assets/giftIconInDailySignIn.png", IsMega: false},
	{Day: 4, RewardGems: 90, RewardSpins: 0, RewardUSD: 0.0, Label: "+90 💎", Icon: "./assets/purple-diamond.png", IsMega: false},
	{Day: 5, RewardGems: 90, RewardSpins: 0, RewardUSD: 0.0, Label: "+90 💎", Icon: "./assets/purple-diamond.png", IsMega: false},
	{Day: 6, RewardGems: 90, RewardSpins: 0, RewardUSD: 0.0, Label: "+90 💎", Icon: "./assets/purple-diamond.png", IsMega: false},
	{Day: 7, RewardGems: 6000, RewardSpins: 5, RewardUSD: 0.50, Label: "MEGA +6000 💎 + 5 Spins + $0.50", Icon: "./assets/giftIconInDailySignIn.png", IsMega: true},
}

// GetDailyRewardsConfig fetches the 7-day reward configuration
func (s *DailyRewardService) GetDailyRewardsConfig(ctx context.Context) (*model.DailyRewardsConfigResponse, error) {
	if s.settingsRepo != nil {
		raw, err := s.settingsRepo.Get(ctx, "daily_rewards_config")
		if err == nil && raw != "" {
			var days []model.DailyRewardConfigItem
			if err := json.Unmarshal([]byte(raw), &days); err == nil && len(days) > 0 {
				// Populate dual serialization fields
				for i := range days {
					days[i].RewardDiamondsSnake = days[i].RewardGems
					days[i].RewardGemsSnake = days[i].RewardGems
					days[i].RewardSpinsSnake = days[i].RewardSpins
					days[i].RewardUSDSnake = days[i].RewardUSD
					days[i].IsMegaSnake = days[i].IsMega
				}
				return &model.DailyRewardsConfigResponse{Days: days}, nil
			}
		}
	}

	days := make([]model.DailyRewardConfigItem, len(defaultDailyRewards))
	for i, d := range defaultDailyRewards {
		days[i] = d
		days[i].RewardDiamondsSnake = d.RewardGems
		days[i].RewardGemsSnake = d.RewardGems
		days[i].RewardSpinsSnake = d.RewardSpins
		days[i].RewardUSDSnake = d.RewardUSD
		days[i].IsMegaSnake = d.IsMega
	}
	return &model.DailyRewardsConfigResponse{Days: days}, nil
}

// UpdateDailyRewardsConfig saves custom 7-day reward configurations
func (s *DailyRewardService) UpdateDailyRewardsConfig(ctx context.Context, req model.DailyRewardsConfigResponse) (*model.DailyRewardsConfigResponse, error) {
	if s.settingsRepo == nil {
		return nil, errors.New("settings repository unavailable")
	}

	if len(req.Days) == 0 {
		return nil, errors.New("days configuration array cannot be empty")
	}

	// Auto-format labels and dual keys if missing
	for i := range req.Days {
		if req.Days[i].Day == 0 {
			req.Days[i].Day = i + 1
		}
		if req.Days[i].RewardGems == 0 {
			if req.Days[i].RewardGemsSnake > 0 {
				req.Days[i].RewardGems = req.Days[i].RewardGemsSnake
			} else if req.Days[i].RewardDiamondsSnake > 0 {
				req.Days[i].RewardGems = req.Days[i].RewardDiamondsSnake
			}
		}
		if req.Days[i].RewardSpins == 0 && req.Days[i].RewardSpinsSnake > 0 {
			req.Days[i].RewardSpins = req.Days[i].RewardSpinsSnake
		}
		if req.Days[i].RewardUSD == 0 && req.Days[i].RewardUSDSnake > 0 {
			req.Days[i].RewardUSD = req.Days[i].RewardUSDSnake
		}
		if !req.Days[i].IsMega && req.Days[i].IsMegaSnake {
			req.Days[i].IsMega = true
		}

		// Sync dual keys
		req.Days[i].RewardDiamondsSnake = req.Days[i].RewardGems
		req.Days[i].RewardGemsSnake = req.Days[i].RewardGems
		req.Days[i].RewardSpinsSnake = req.Days[i].RewardSpins
		req.Days[i].RewardUSDSnake = req.Days[i].RewardUSD
		req.Days[i].IsMegaSnake = req.Days[i].IsMega

		if req.Days[i].Icon == "" {
			if req.Days[i].IsMega || req.Days[i].Day == 7 {
				req.Days[i].Icon = "./assets/giftIconInDailySignIn.png"
			} else {
				req.Days[i].Icon = "./assets/purple-diamond.png"
			}
		}
		if req.Days[i].Label == "" {
			var parts []string
			if req.Days[i].RewardGems > 0 {
				parts = append(parts, fmt.Sprintf("+%d 💎", req.Days[i].RewardGems))
			}
			if req.Days[i].RewardSpins > 0 {
				parts = append(parts, fmt.Sprintf("+%d Spins", req.Days[i].RewardSpins))
			}
			if req.Days[i].RewardUSD > 0 {
				parts = append(parts, fmt.Sprintf("+$%.2f", req.Days[i].RewardUSD))
			}
			if len(parts) == 0 {
				parts = append(parts, "+80 💎")
			}
			req.Days[i].Label = strings.Join(parts, " ")
			if req.Days[i].IsMega {
				req.Days[i].Label = "MEGA " + req.Days[i].Label
			}
		}
	}

	bytes, err := json.Marshal(req.Days)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal daily rewards config: %w", err)
	}

	if err := s.settingsRepo.Set(ctx, "daily_rewards_config", string(bytes)); err != nil {
		return nil, fmt.Errorf("failed to save daily rewards config: %w", err)
	}

	return s.GetDailyRewardsConfig(ctx)
}

func (s *DailyRewardService) GetStatus(ctx context.Context, userID int64) (*model.DailyRewardsStatusResponse, error) {
	streak, err := s.dailyRewardRepo.GetStreak(ctx, userID)
	if err != nil {
		return nil, err
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	currentDay := 1
	canClaimToday := true

	if streak != nil && streak.LastClaimDate != nil {
		lastClaim := streak.LastClaimDate.UTC().Truncate(24 * time.Hour)
		diffDays := int(today.Sub(lastClaim).Hours() / 24)

		if diffDays == 0 {
			// Already claimed today
			canClaimToday = false
			currentDay = streak.CurrentDay
		} else if diffDays == 1 {
			// Continuous streak, next day
			canClaimToday = true
			currentDay = (streak.CurrentDay % 7) + 1
		} else {
			// Missed a day: reset streak to Day 1
			canClaimToday = true
			currentDay = 1
		}
	}

	configResp, _ := s.GetDailyRewardsConfig(ctx)
	cfgDays := configResp.Days

	days := make([]model.DailyRewardDay, len(cfgDays))
	for i, r := range cfgDays {
		days[i] = model.DailyRewardDay{
			Day:                 r.Day,
			Reward:              r.Label,
			Icon:                r.Icon,
			Active:              r.Day == currentDay && canClaimToday,
			IsMega:              r.IsMega,
			IsMegaSnake:         r.IsMega,
			RewardGems:          r.RewardGems,
			RewardDiamondsSnake: r.RewardGems,
			RewardSpins:         r.RewardSpins,
			RewardSpinsSnake:    r.RewardSpins,
			RewardUSD:           r.RewardUSD,
			RewardUSDSnake:      r.RewardUSD,
		}
	}

	serverDateStr := today.Format("2006-01-02")
	return &model.DailyRewardsStatusResponse{
		CurrentDay:           currentDay,
		CurrentDaySnake:      currentDay,
		CanClaimToday:        canClaimToday,
		CanClaimTodaySnake:   canClaimToday,
		HasClaimedToday:      !canClaimToday,
		HasClaimedTodaySnake: !canClaimToday,
		ServerDate:           serverDateStr,
		ServerDateSnake:      serverDateStr,
		StreakActive:         true,
		StreakBonus:          fmt.Sprintf("Day %d Streak Active (+10%% Spin Luck!)", currentDay),
		Days:                 days,
	}, nil
}

func (s *DailyRewardService) ClaimReward(ctx context.Context, userID int64, isDouble ...bool) (*model.ClaimDailyRewardResponse, error) {
	if s.dailyRewardRepo == nil || s.userRepo == nil {
		return nil, errors.New("daily reward service unavailable")
	}

	status, err := s.GetStatus(ctx, userID)
	if err != nil {
		return nil, err
	}

	if !status.CanClaimToday {
		return nil, errors.New("daily reward already claimed today. Come back tomorrow!")
	}

	currentDay := status.CurrentDay

	// Atomically reserve streak claim in DB before balance mutation
	claimed, err := s.dailyRewardRepo.ClaimStreakAtomic(ctx, userID, currentDay)
	if err != nil {
		return nil, fmt.Errorf("failed to process daily reward claim: %w", err)
	}
	if !claimed {
		return nil, errors.New("daily reward already claimed today. Come back tomorrow!")
	}

	configResp, _ := s.GetDailyRewardsConfig(ctx)
	dayIndex := currentDay - 1
	if dayIndex < 0 || dayIndex >= len(configResp.Days) {
		dayIndex = 0
	}
	rewardConfig := configResp.Days[dayIndex]

	rewardGems := rewardConfig.RewardGems
	rewardSpins := rewardConfig.RewardSpins
	rewardUSD := rewardConfig.RewardUSD

	if len(isDouble) > 0 && isDouble[0] {
		rewardGems *= 2
		rewardSpins *= 2
		rewardUSD *= 2
	}

	// Mutate balance atomically
	updatedUser, err := s.userRepo.MutateBalances(ctx, userID, rewardSpins, rewardGems, rewardUSD, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to credit daily reward: %w", err)
	}

	// Format reward description
	var parts []string
	if rewardGems > 0 {
		parts = append(parts, fmt.Sprintf("+%d 💎", rewardGems))
	}
	if rewardSpins > 0 {
		parts = append(parts, fmt.Sprintf("+%d Spins", rewardSpins))
	}
	if rewardUSD > 0 {
		parts = append(parts, fmt.Sprintf("+$%.2f", rewardUSD))
	}
	desc := strings.Join(parts, ", ")
	if desc == "" {
		desc = fmt.Sprintf("+%d 💎", rewardGems)
	}

	// Create audit ledger record
	txID := util.GenerateTXID("DAILY")
	if s.txRepo != nil {
		_ = s.txRepo.Create(ctx, &model.Transaction{
			UserID:         userID,
			Category:       "daily",
			Title:          fmt.Sprintf("Daily Check-in Day %d", currentDay),
			AmountUSD:      rewardUSD,
			AmountDiamonds: rewardGems,
			AmountSpins:    rewardSpins,
			Status:         "completed",
			ReferenceID:    txID,
			Description:    desc,
		})
	}

	userResp := ToUserResponse(updatedUser)
	return &model.ClaimDailyRewardResponse{
		ClaimedDay:          currentDay,
		ClaimedDaySnake:     currentDay,
		RewardGems:          rewardGems,
		RewardDiamondsSnake: rewardGems,
		RewardSpins:         rewardSpins,
		RewardSpinsSnake:    rewardSpins,
		RewardUSD:           rewardUSD,
		RewardUSDSnake:      rewardUSD,
		RewardLabel:         rewardConfig.Label,
		TxID:                txID,
		TxIDSnake:           txID,
		UserBalance:         userResp,
		User:                &userResp,
	}, nil
}
