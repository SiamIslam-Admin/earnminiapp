package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
)

type ReferralService struct {
	userRepo     *repository.UserRepository
	settingsRepo *repository.SystemSettingsRepository
	botClient    *telegram.BotClient
	cfg          *config.Config
}

func NewReferralService(
	userRepo *repository.UserRepository,
	settingsRepo *repository.SystemSettingsRepository,
	botClient *telegram.BotClient,
	cfg *config.Config,
) *ReferralService {
	return &ReferralService{
		userRepo:     userRepo,
		settingsRepo: settingsRepo,
		botClient:    botClient,
		cfg:          cfg,
	}
}

// GetReferralRewardSettings returns current admin-configured referral rewards
func (s *ReferralService) GetReferralRewardSettings(ctx context.Context) (*model.ReferralRewardSettings, error) {
	// Defaults
	cfg := model.ReferralRewardSettings{
		InitialOrganicSpins: 12,
		ReferrerSpins:       1,
		ReferrerDiamonds:    100,
		ReferrerUSD:         0.05,
		WelcomeSpins:        3,
		WelcomeDiamonds:     200,
		WelcomeUSD:          0.00,
	}

	if s.settingsRepo != nil {
		raw, err := s.settingsRepo.Get(ctx, "referral_rewards_config")
		if err == nil && raw != "" {
			_ = json.Unmarshal([]byte(raw), &cfg)
		}
	}

	if cfg.InitialOrganicSpins <= 0 {
		cfg.InitialOrganicSpins = 12
	}

	// Populate dual snake_case fields
	cfg.InitialOrganicSpinsSnake = cfg.InitialOrganicSpins
	cfg.InitialSpinsSnake = cfg.InitialOrganicSpins
	cfg.ReferrerSpinsSnake = cfg.ReferrerSpins
	cfg.ReferrerDiamondsSnake = cfg.ReferrerDiamonds
	cfg.ReferrerUSDSnake = cfg.ReferrerUSD
	cfg.WelcomeSpinsSnake = cfg.WelcomeSpins
	cfg.WelcomeDiamondsSnake = cfg.WelcomeDiamonds
	cfg.WelcomeUSDSnake = cfg.WelcomeUSD

	return &cfg, nil
}

// UpdateReferralRewardSettings saves new referral reward settings
func (s *ReferralService) UpdateReferralRewardSettings(ctx context.Context, req model.ReferralRewardSettings) (*model.ReferralRewardSettings, error) {
	if s.settingsRepo == nil {
		return nil, errors.New("settings repository unavailable")
	}

	// Handle snake_case fallbacks
	if req.InitialOrganicSpins == 0 {
		if req.InitialOrganicSpinsSnake > 0 {
			req.InitialOrganicSpins = req.InitialOrganicSpinsSnake
		} else if req.InitialSpinsSnake > 0 {
			req.InitialOrganicSpins = req.InitialSpinsSnake
		} else {
			req.InitialOrganicSpins = 12
		}
	}
	if req.ReferrerSpins == 0 && req.ReferrerSpinsSnake > 0 {
		req.ReferrerSpins = req.ReferrerSpinsSnake
	}
	if req.ReferrerDiamonds == 0 && req.ReferrerDiamondsSnake > 0 {
		req.ReferrerDiamonds = req.ReferrerDiamondsSnake
	}
	if req.ReferrerUSD == 0 && req.ReferrerUSDSnake > 0 {
		req.ReferrerUSD = req.ReferrerUSDSnake
	}
	if req.WelcomeSpins == 0 && req.WelcomeSpinsSnake > 0 {
		req.WelcomeSpins = req.WelcomeSpinsSnake
	}
	if req.WelcomeDiamonds == 0 && req.WelcomeDiamondsSnake > 0 {
		req.WelcomeDiamonds = req.WelcomeDiamondsSnake
	}
	if req.WelcomeUSD == 0 && req.WelcomeUSDSnake > 0 {
		req.WelcomeUSD = req.WelcomeUSDSnake
	}

	bytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal referral settings: %w", err)
	}

	if err := s.settingsRepo.Set(ctx, "referral_rewards_config", string(bytes)); err != nil {
		return nil, fmt.Errorf("failed to save referral settings: %w", err)
	}

	return s.GetReferralRewardSettings(ctx)
}

func (s *ReferralService) GetTeamStats(ctx context.Context, userID int64) (*model.TeamStatsResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	referrals, err := s.userRepo.GetReferrals(ctx, userID)
	if err != nil {
		return nil, err
	}

	totalFriends := len(referrals)
	activeCount := 0

	var members []model.TeamMemberResponse
	cutoff := time.Now().Add(-7 * 24 * time.Hour)

	for _, ref := range referrals {
		// High performance active detection without blocking N+1 HTTP network calls
		isActiveMember := ref.LastActiveAt.After(cutoff) || ref.Spins > 0 || ref.Diamonds > 0
		if isActiveMember {
			activeCount++
		}

		joinedStr := ref.CreatedAt.Format("Jan 02, 15:04")
		members = append(members, model.TeamMemberResponse{
			ID:            fmt.Sprintf("%d", ref.ID),
			Name:          ref.FirstName,
			JoinedDate:    joinedStr,
			JoinedChannel: isActiveMember,
		})
	}

	currentTier := "Bronze"
	if totalFriends >= 10 {
		currentTier = "Gold"
	} else if totalFriends >= 3 {
		currentTier = "Silver"
	}

	// Fetch dynamic reward descriptions
	refSettings, _ := s.GetReferralRewardSettings(ctx)
	refSpins := 1
	refDiamonds := int64(100)
	if refSettings != nil {
		if refSettings.ReferrerSpins > 0 {
			refSpins = refSettings.ReferrerSpins
		}
		if refSettings.ReferrerDiamonds > 0 {
			refDiamonds = refSettings.ReferrerDiamonds
		}
	}

	var inviteURL string
	if s.cfg != nil && s.cfg.MiniAppURL != "" {
		if strings.Contains(s.cfg.MiniAppURL, "?") {
			inviteURL = fmt.Sprintf("%s&startapp=ref_%d", s.cfg.MiniAppURL, user.TelegramID)
		} else {
			inviteURL = fmt.Sprintf("%s?startapp=ref_%d", s.cfg.MiniAppURL, user.TelegramID)
		}
	} else {
		inviteURL = fmt.Sprintf("https://t.me/SpinCraft_bot/earnnow?startapp=ref_%d", user.TelegramID)
	}
	shareText := fmt.Sprintf("🎁 Join me on Spin Craft! Spin the Lucky Wheel to win real USDT cash, diamonds, and free tickets! 🎰💰\n%s", inviteURL)

	return &model.TeamStatsResponse{
		TotalFriends: totalFriends,
		ActiveCount:  activeCount,
		InviteURL:    inviteURL,
		ShareText:    shareText,
		CurrentTier:  currentTier,
		TierRewards: []string{
			fmt.Sprintf("🥉 Bronze: +%d Spins, +%d 💎/friend", refSpins, refDiamonds),
			fmt.Sprintf("🥈 Silver: +%d Spins + 5%% bonus", refSpins+1),
			fmt.Sprintf("🥇 Gold: +%d Spins + 10%% bonus", refSpins+2),
		},
		Members: members,
	}, nil
}
