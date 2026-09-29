package rng_test

import (
	"testing"

	"earnminiapp/pkg/rng"
)

func TestWeightedRoll(t *testing.T) {
	items := []rng.WeightedItem{
		{Index: 0, Weight: 5, Value: "jackpot", Label: "Jackpot", Amount: "$10.00"},
		{Index: 1, Weight: 25, Value: "coins", Label: "Coins", Amount: "$0.20"},
		{Index: 2, Weight: 70, Value: "gem", Label: "Diamond", Amount: "80 💎"},
	}

	counts := make(map[string]int)
	iterations := 1000

	for i := 0; i < iterations; i++ {
		won, err := rng.RollWeighted(items)
		if err != nil {
			t.Fatalf("RollWeighted returned error: %v", err)
		}
		counts[won.Value]++
	}

	if counts["gem"] < counts["coins"] {
		t.Errorf("Expected gem count (%d) to exceed coins count (%d) due to higher weight", counts["gem"], counts["coins"])
	}

	if counts["coins"] < counts["jackpot"] {
		t.Errorf("Expected coins count (%d) to exceed jackpot count (%d) due to higher weight", counts["coins"], counts["jackpot"])
	}
}
