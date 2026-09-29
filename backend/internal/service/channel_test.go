package service_test

import (
	"context"
	"testing"

	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
)

func TestOfficialChannelDefaults(t *testing.T) {
	channelService := service.NewChannelService(nil, nil, nil, nil, nil)
	status, err := channelService.GetOfficialChannelStatus(context.Background(), 123)
	if err != nil {
		t.Fatalf("expected nil error for nil repo default status, got: %v", err)
	}

	if status.ChannelUsername != "@SpinCraftNews" {
		t.Errorf("expected default username @SpinCraftNews, got: %s", status.ChannelUsername)
	}

	if status.ChannelLink != "https://t.me/SpinCraftNews" {
		t.Errorf("expected default link https://t.me/SpinCraftNews, got: %s", status.ChannelLink)
	}

	if status.RewardSpins != 3 {
		t.Errorf("expected default reward spins 3, got: %d", status.RewardSpins)
	}

	if status.RewardDiamonds != 500 {
		t.Errorf("expected default reward diamonds 500, got: %d", status.RewardDiamonds)
	}

	if status.HasClaimed {
		t.Errorf("expected has_claimed to be false, got true")
	}
}

func TestVerifyOfficialChannelJoinNilRepo(t *testing.T) {
	channelService := service.NewChannelService(nil, nil, nil, nil, nil)
	_, err := channelService.VerifyOfficialChannelJoin(context.Background(), 123)
	if err == nil {
		t.Fatalf("expected error when verifying join with nil repo, got nil")
	}
}

func TestToUserResponseWithHasClaimedChannelReward(t *testing.T) {
	user := &model.User{
		ID:                      1,
		TelegramID:              888888,
		FirstName:               "Alice",
		Username:                "alice_spin",
		HasClaimedChannelReward: true,
		Spins:                   10,
		Diamonds:                2500,
	}

	resp := service.ToUserResponse(user)
	if !resp.HasClaimedChannelReward {
		t.Errorf("expected HasClaimedChannelReward to be true, got false")
	}
	if !resp.HasClaimedChannelRewardCamel {
		t.Errorf("expected HasClaimedChannelRewardCamel to be true, got false")
	}
}
