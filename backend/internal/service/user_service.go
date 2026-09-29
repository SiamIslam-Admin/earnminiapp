package service

import (
	"context"
	"fmt"
	"time"

	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
)

type UserService struct {
	userRepo *repository.UserRepository
	cfg      *config.Config
}

func NewUserService(userRepo *repository.UserRepository, cfg *config.Config) *UserService {
	return &UserService{
		userRepo: userRepo,
		cfg:      cfg,
	}
}

func ToUserResponse(user *model.User) model.UserResponse {
	if user == nil {
		return model.UserResponse{}
	}

	goalUSD := 1.00
	goalLeft := goalUSD - user.BalanceUSD
	if goalLeft < 0 {
		goalLeft = 0
	}

	return model.UserResponse{
		ID:              user.ID,
		TelegramID:      user.TelegramID,
		TelegramIDCamel: user.TelegramID,
		FirstName:       user.FirstName,
		FirstNameCamel:  user.FirstName,
		Username:        user.Username,
		PhotoURL:        user.PhotoURL,
		PhotoURLCamel:   user.PhotoURL,
		Level:           user.Level,
		Energy:          user.Energy,
		MaxEnergy:       user.MaxEnergy,
		MaxEnergyCamel:  user.MaxEnergy,
		Spins:           user.Spins,
		Diamonds:        user.Diamonds,
		DiamondsCamel:   user.Diamonds,
		BalanceUSD:      user.BalanceUSD,
		BalanceUSDCamel: user.BalanceUSD,
		TONWallet:       user.TONWallet,
		TONWalletCamel:  user.TONWallet,
		GoalUSD:         goalUSD,
		GoalUSDCamel:    goalUSD,
		GoalLeft:        goalLeft,
		GoalLeftCamel:   goalLeft,
		IsAdmin:         false,
		IsAdminCamel:    false,
		IsBanned:                     user.IsBanned,
		IsBannedCamel:                user.IsBanned,
		HasClaimedChannelReward:      user.HasClaimedChannelReward,
		HasClaimedChannelRewardCamel: user.HasClaimedChannelReward,
	}
}

func (s *UserService) GetProfile(ctx context.Context, userID int64) (*model.UserResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	// Dynamic Energy Refill: +1 energy per 2 minutes elapsed since last refill
	now := time.Now()
	elapsed := now.Sub(user.LastEnergyRefill)
	refillPoints := int(elapsed / (2 * time.Minute))

	if refillPoints > 0 && user.Energy < user.MaxEnergy {
		updatedUser, err := s.userRepo.MutateBalances(ctx, userID, 0, 0, 0, refillPoints)
		if err == nil {
			user = updatedUser
		}
	}

	resp := ToUserResponse(user)
	if s.cfg != nil && s.cfg.IsAdminTelegramID(user.TelegramID) {
		resp.IsAdmin = true
	}
	return &resp, nil
}
