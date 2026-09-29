package service_test

import (
	"context"
	"testing"

	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
)

func TestDailyRewardsConfigDefaults(t *testing.T) {
	dailyService := service.NewDailyRewardService(nil, nil, nil, nil)
	config, err := dailyService.GetDailyRewardsConfig(context.Background())
	if err != nil {
		t.Fatalf("failed to get daily rewards config: %v", err)
	}

	if len(config.Days) != 7 {
		t.Fatalf("expected 7 days in config, got %d", len(config.Days))
	}

	// Verify Day 1
	if config.Days[0].Day != 1 || config.Days[0].RewardGems != 80 {
		t.Errorf("expected Day 1 reward 80 gems, got %d", config.Days[0].RewardGems)
	}

	// Verify Day 7 Mega
	if config.Days[6].Day != 7 || !config.Days[6].IsMega || config.Days[6].RewardGems != 6000 {
		t.Errorf("expected Day 7 Mega reward 6000 gems, got %d", config.Days[6].RewardGems)
	}
}

func TestReferralRewardSettingsDefaults(t *testing.T) {
	refService := service.NewReferralService(nil, nil, nil, nil)
	settings, err := refService.GetReferralRewardSettings(context.Background())
	if err != nil {
		t.Fatalf("failed to get referral reward settings: %v", err)
	}

	if settings.ReferrerSpins != 1 {
		t.Errorf("expected referrer spins 1, got %d", settings.ReferrerSpins)
	}

	if settings.WelcomeSpins != 3 {
		t.Errorf("expected welcome spins 3, got %d", settings.WelcomeSpins)
	}

	if settings.ReferrerDiamonds != 100 {
		t.Errorf("expected referrer diamonds 100, got %d", settings.ReferrerDiamonds)
	}
}

func TestDailyRewardSerialization(t *testing.T) {
	day := model.DailyRewardConfigItem{
		Day:                 3,
		RewardGems:          200,
		RewardDiamondsSnake: 200,
		RewardSpins:         1,
		RewardSpinsSnake:    1,
		RewardUSD:           0.05,
		RewardUSDSnake:      0.05,
		Label:               "+200 💎 + 1 Spin",
		IsMega:              false,
	}

	if day.RewardGems != 200 || day.RewardSpins != 1 || day.RewardUSD != 0.05 {
		t.Errorf("daily reward serialization mismatch")
	}
}
