package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
	"earnminiapp/pkg/jwt"
)

type AuthService struct {
	userRepo      *repository.UserRepository
	txRepo        *repository.TransactionRepository
	settingsRepo  *repository.SystemSettingsRepository
	authValidator *telegram.AuthValidator
	jwtManager    *jwt.JWTManager
	botClient     *telegram.BotClient
	cfg           *config.Config
}

func NewAuthService(
	userRepo *repository.UserRepository,
	txRepo *repository.TransactionRepository,
	settingsRepo *repository.SystemSettingsRepository,
	authValidator *telegram.AuthValidator,
	jwtManager *jwt.JWTManager,
	botClient *telegram.BotClient,
	cfg *config.Config,
) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		txRepo:        txRepo,
		settingsRepo:  settingsRepo,
		authValidator: authValidator,
		jwtManager:    jwtManager,
		botClient:     botClient,
		cfg:           cfg,
	}
}

func (s *AuthService) AuthenticateTelegram(ctx context.Context, initDataRaw, startParam string) (*model.AuthResponse, error) {
	authData, err := s.authValidator.ValidateInitData(initDataRaw)
	if err != nil {
		return nil, fmt.Errorf("invalid telegram authentication: %w", err)
	}

	if authData.User == nil {
		return nil, fmt.Errorf("telegram user payload is missing")
	}

	// Parse referrer if passed via startParam (e.g. "ref_123456789" or "123456789")
	var referrerTGID *int64
	param := authData.StartParam
	if param == "" {
		param = startParam
	}
	if param != "" {
		trimmed := strings.TrimPrefix(param, "ref_")
		if refID, err := strconv.ParseInt(trimmed, 10, 64); err == nil && refID > 0 {
			referrerTGID = &refID
		}
	}

	photoURL := authData.User.PhotoURL

	user, isNew, err := s.userRepo.UpsertFromTelegram(
		ctx,
		authData.User.ID,
		authData.User.Username,
		authData.User.FirstName,
		photoURL,
		authData.User.IsPremium,
		referrerTGID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to sync user: %w", err)
	}

	// If newly registered user, handle rewards
	if isNew {
		refConfig := model.ReferralRewardSettings{
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
				_ = json.Unmarshal([]byte(raw), &refConfig)
			}
		}

		if user.ReferrerID != nil {
			// 1. Grant welcome rewards to the invited new user
			user, _ = s.userRepo.MutateBalances(ctx, user.ID, refConfig.WelcomeSpins, refConfig.WelcomeDiamonds, refConfig.WelcomeUSD, 0)
			var welcomeDesc []string
			if refConfig.WelcomeSpins > 0 {
				welcomeDesc = append(welcomeDesc, fmt.Sprintf("+%d Free Spins", refConfig.WelcomeSpins))
			}
			if refConfig.WelcomeDiamonds > 0 {
				welcomeDesc = append(welcomeDesc, fmt.Sprintf("+%d 💎", refConfig.WelcomeDiamonds))
			}
			if refConfig.WelcomeUSD > 0 {
				welcomeDesc = append(welcomeDesc, fmt.Sprintf("+$%.2f", refConfig.WelcomeUSD))
			}
			welcomeText := strings.Join(welcomeDesc, ", ")
			if welcomeText == "" {
				welcomeText = "+3 Free Spins"
			}

			_ = s.txRepo.Create(ctx, &model.Transaction{
				UserID:         user.ID,
				Category:       "team",
				Title:          "Welcome Referral Gift",
				AmountUSD:      refConfig.WelcomeUSD,
				AmountDiamonds: refConfig.WelcomeDiamonds,
				AmountSpins:    refConfig.WelcomeSpins,
				Status:         "completed",
				ReferenceID:    fmt.Sprintf("WELCOME-REF-%d", user.ID),
				Description:    fmt.Sprintf("%s for joining via invite link! 🎁", welcomeText),
			})

			// 2. Grant rewards to the referrer
			_, _ = s.userRepo.MutateBalances(ctx, *user.ReferrerID, refConfig.ReferrerSpins, refConfig.ReferrerDiamonds, refConfig.ReferrerUSD, 0)
			var referrerDesc []string
			if refConfig.ReferrerSpins > 0 {
				referrerDesc = append(referrerDesc, fmt.Sprintf("+%d Free Spins", refConfig.ReferrerSpins))
			}
			if refConfig.ReferrerDiamonds > 0 {
				referrerDesc = append(referrerDesc, fmt.Sprintf("+%d 💎", refConfig.ReferrerDiamonds))
			}
			if refConfig.ReferrerUSD > 0 {
				referrerDesc = append(referrerDesc, fmt.Sprintf("+$%.2f", refConfig.ReferrerUSD))
			}
			referrerText := strings.Join(referrerDesc, ", ")
			if referrerText == "" {
				referrerText = "+1 Free Spin"
			}

			_ = s.txRepo.Create(ctx, &model.Transaction{
				UserID:         *user.ReferrerID,
				Category:       "team",
				Title:          fmt.Sprintf("New Referral (%s)", user.FirstName),
				AmountUSD:      refConfig.ReferrerUSD,
				AmountDiamonds: refConfig.ReferrerDiamonds,
				AmountSpins:    refConfig.ReferrerSpins,
				Status:         "completed",
				ReferenceID:    fmt.Sprintf("REF-%d-%d", *user.ReferrerID, user.ID),
				Description:    fmt.Sprintf("%s for inviting a friend! 👥", referrerText),
			})

			// 3. Notify the referrer in private Telegram chat
			if s.botClient != nil {
				referrer, _ := s.userRepo.GetByID(ctx, *user.ReferrerID)
				if referrer != nil && referrer.TelegramID != 0 {
					notifyText := fmt.Sprintf(
						"🎉 <b>New Referral Joined Your Team!</b> 👥\n\n"+
							"👤 <b>%s</b> just launched EarnMiniApp using your invite link!\n\n"+
							"🎁 <b>Your Reward:</b> %s credited to your balance 🎰\n"+
							"🏆 Keep inviting friends to climb the Referral Leaderboard!",
						user.FirstName,
						referrerText,
					)
					_ = s.botClient.SendMessage(referrer.TelegramID, notifyText, nil)
				}
			}
		} else {
			// Direct organic user without invite link
			if refConfig.InitialOrganicSpins > 0 && refConfig.InitialOrganicSpins != 12 {
				delta := refConfig.InitialOrganicSpins - 12
				user, _ = s.userRepo.MutateBalances(ctx, user.ID, delta, 0, 0, 0)
			}
		}
	}

	// Generate high-speed JWT session token
	token, err := s.jwtManager.GenerateToken(user.ID, user.TelegramID, user.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	userResp := ToUserResponse(user)
	if s.cfg != nil && s.cfg.IsAdminTelegramID(user.TelegramID) {
		userResp.IsAdmin = true
	}

	return &model.AuthResponse{
		Token: token,
		User:  userResp,
	}, nil
}
