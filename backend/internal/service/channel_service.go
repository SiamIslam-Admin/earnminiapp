package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
)

type ChannelService struct {
	userRepo        *repository.UserRepository
	settingsRepo    *repository.SystemSettingsRepository
	txRepo          *repository.TransactionRepository
	joinRequestRepo *repository.JoinRequestRepository
	botClient       *telegram.BotClient
}

func NewChannelService(
	userRepo *repository.UserRepository,
	settingsRepo *repository.SystemSettingsRepository,
	txRepo *repository.TransactionRepository,
	joinRequestRepo *repository.JoinRequestRepository,
	botClient *telegram.BotClient,
) *ChannelService {
	return &ChannelService{
		userRepo:        userRepo,
		settingsRepo:    settingsRepo,
		txRepo:          txRepo,
		joinRequestRepo: joinRequestRepo,
		botClient:       botClient,
	}
}

func (s *ChannelService) getOfficialChannelConfig(ctx context.Context) (username, link, channelID string, spins int, diamonds int64) {
	username = "@SpinCraftNews"
	link = "https://t.me/SpinCraftNews"
	channelID = ""
	spins = 3
	diamonds = 500

	if s.settingsRepo != nil {
		if val, err := s.settingsRepo.Get(ctx, "official_channel_username"); err == nil && val != "" {
			username = val
		}
		if val, err := s.settingsRepo.Get(ctx, "official_channel_link"); err == nil && val != "" {
			link = val
		}
		if val, err := s.settingsRepo.Get(ctx, "official_channel_id"); err == nil && val != "" {
			channelID = val
			if (link == "" || link == "https://t.me/SpinCraftNews") && s.botClient != nil {
				if exported, err := s.botClient.ExportChatInviteLink(channelID); err == nil && exported != "" {
					link = exported
				}
			}
		}
		if (link == "" || link == "https://t.me/SpinCraftNews") && username != "" && username != "@SpinCraftNews" {
			cleanUser := strings.TrimPrefix(username, "@")
			if cleanUser != "" {
				link = fmt.Sprintf("https://t.me/%s", cleanUser)
			}
		}
		if val, err := s.settingsRepo.Get(ctx, "official_channel_reward_spins"); err == nil && val != "" {
			if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
				spins = parsed
			}
		}
		if val, err := s.settingsRepo.Get(ctx, "official_channel_reward_diamonds"); err == nil && val != "" {
			if parsed, err := strconv.ParseInt(val, 10, 64); err == nil && parsed > 0 {
				diamonds = parsed
			}
		}
	}

	return username, link, channelID, spins, diamonds
}

func (s *ChannelService) GetOfficialChannelStatus(ctx context.Context, userID int64) (*model.OfficialChannelStatusResponse, error) {
	if s.userRepo == nil {
		username, link, _, spins, diamonds := s.getOfficialChannelConfig(ctx)
		return &model.OfficialChannelStatusResponse{
			ChannelUsername:      username,
			ChannelUsernameCamel: username,
			ChannelLink:          link,
			ChannelLinkCamel:     link,
			RewardSpins:          spins,
			RewardSpinsCamel:     spins,
			RewardDiamonds:       diamonds,
			RewardDiamondsCamel:  diamonds,
			RewardGemsCamel:      diamonds,
			HasClaimed:           false,
			HasClaimedCamel:      false,
			HasClaimedReward:     false,
		}, nil
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	username, link, _, spins, diamonds := s.getOfficialChannelConfig(ctx)

	return &model.OfficialChannelStatusResponse{
		ChannelUsername:      username,
		ChannelUsernameCamel: username,
		ChannelLink:          link,
		ChannelLinkCamel:     link,
		RewardSpins:          spins,
		RewardSpinsCamel:     spins,
		RewardDiamonds:       diamonds,
		RewardDiamondsCamel:  diamonds,
		RewardGemsCamel:      diamonds,
		HasClaimed:           user.HasClaimedChannelReward,
		HasClaimedCamel:      user.HasClaimedChannelReward,
		HasClaimedReward:     user.HasClaimedChannelReward,
	}, nil
}

func (s *ChannelService) VerifyOfficialChannelJoin(ctx context.Context, userID int64) (*model.OfficialChannelClaimResponse, error) {
	if s.userRepo == nil {
		return nil, errors.New("user repository unavailable")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if user.HasClaimedChannelReward {
		return nil, errors.New("official channel reward has already been claimed")
	}

	username, _, channelID, spins, diamonds := s.getOfficialChannelConfig(ctx)

	targetChannel := channelID
	if targetChannel == "" {
		targetChannel = username
	}
	if targetChannel == "" {
		targetChannel = "@SpinCraftNews"
	}

	isMember := false
	if s.botClient != nil && targetChannel != "" {
		var err error
		isMember, err = s.botClient.IsUserInChannel(targetChannel, user.TelegramID)
		if err != nil || !isMember {
			if s.joinRequestRepo != nil {
				hasRequested, _ := s.joinRequestRepo.HasUserRequestedJoin(ctx, targetChannel, user.TelegramID)
				if hasRequested {
					isMember = true
				}
			}
		}
	}

	if !isMember {
		return nil, errors.New("please join the official Telegram channel or send a join request first before claiming your reward")
	}

	desc := fmt.Sprintf("+%d Spins, +%d 💎", spins, diamonds)
	updatedUser, err := s.userRepo.ClaimChannelRewardAtomic(ctx, userID, spins, diamonds, "Official Channel Join Reward", desc)
	if err != nil {
		return nil, err
	}

	userResp := ToUserResponse(updatedUser)
	return &model.OfficialChannelClaimResponse{
		Success:             true,
		Message:             "Official channel join verified and reward claimed! 🎉",
		RewardSpins:         spins,
		RewardSpinsCamel:    spins,
		RewardDiamonds:      diamonds,
		RewardDiamondsCamel: diamonds,
		User:                &userResp,
		UserBalance:         &userResp,
	}, nil
}
