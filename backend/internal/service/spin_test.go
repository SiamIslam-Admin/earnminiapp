package service

import (
	"context"
	"strings"
	"testing"

	"earnminiapp/pkg/util"
)

func TestCalculateDynamicCashReward(t *testing.T) {
	s := &SpinService{}
	ctx := context.Background()

	// 1. Test 0 balance fresh user -> should return between 0.40 and 0.60
	r0 := s.calculateDynamicCashReward(ctx, 1, 0.0, 0.01, 0.05)
	if r0 < 0.40 || r0 > 0.60 {
		t.Errorf("expected 0 balance cash reward between 0.40 and 0.60, got %.2f", r0)
	}

	// 2. Test 0.45 balance -> should return between 0.15 and 0.25
	r1 := s.calculateDynamicCashReward(ctx, 1, 0.45, 0.01, 0.05)
	if r1 < 0.15 || r1 > 0.25 {
		t.Errorf("expected 0.45 balance cash reward between 0.15 and 0.25, got %.2f", r1)
	}

	// 3. Test 0.70 balance -> should return between 0.06 and 0.12
	r2 := s.calculateDynamicCashReward(ctx, 1, 0.70, 0.01, 0.05)
	if r2 < 0.06 || r2 > 0.12 {
		t.Errorf("expected 0.70 balance cash reward between 0.06 and 0.12, got %.2f", r2)
	}

	// 4. Test 0.99 balance -> should return between 0.01 and 0.02
	r3 := s.calculateDynamicCashReward(ctx, 1, 0.99, 0.01, 0.05)
	if r3 < 0.01 || r3 > 0.02 {
		t.Errorf("expected 0.99 balance cash reward of 0.01-0.02, got %.2f", r3)
	}

	// 5. Test >= 1.00 balance -> flat steady line, should return between 0.01 and 0.10, NEVER 0.00
	r4 := s.calculateDynamicCashReward(ctx, 1, 1.25, 0.01, 0.05)
	if r4 < 0.01 || r4 > 0.10 {
		t.Errorf("expected >= 1.00 balance cash reward between 0.01 and 0.10, got %.2f", r4)
	}
}

func TestGetWheelSettingsDefaults(t *testing.T) {
	s := &SpinService{}
	settings, err := s.GetWheelSettings(context.Background())
	if err != nil {
		t.Fatalf("failed to get default wheel settings: %v", err)
	}

	if len(settings.Items) != 6 {
		t.Errorf("expected 6 wheel items, got %d", len(settings.Items))
	}

	if settings.TotalWeight != 100 {
		t.Errorf("expected total weight 100, got %d", settings.TotalWeight)
	}

	if settings.DiamondReward != 80 {
		t.Errorf("expected diamond reward 80, got %d", settings.DiamondReward)
	}
}

func TestSpinTXIDGeneration(t *testing.T) {
	tx1 := util.GenerateTXID("SPIN")
	tx2 := util.GenerateTXID("SPIN")

	if tx1 == "" || tx2 == "" {
		t.Fatalf("expected non-empty transaction IDs")
	}
	if tx1 == tx2 {
		t.Errorf("expected unique transaction IDs, but got identical: %s", tx1)
	}
	if !strings.HasPrefix(tx1, "SPIN-") {
		t.Errorf("expected prefix 'SPIN-', got: %s", tx1)
	}
}

