package rng

import (
	"crypto/rand"
	"math/big"
)

type WeightedItem struct {
	Index  int
	Weight int
	Value  string
	Label  string
	Amount string
}

// CryptoRandInt returns a cryptographically secure random integer in [0, max)
func CryptoRandInt(max int64) (int64, error) {
	if max <= 0 {
		return 0, nil
	}
	nBig, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0, err
	}
	return nBig.Int64(), nil
}

// RollWeighted selects an item based on integer weights
func RollWeighted(items []WeightedItem) (WeightedItem, error) {
	var totalWeight int64
	for _, item := range items {
		totalWeight += int64(item.Weight)
	}

	if totalWeight <= 0 {
		return items[0], nil
	}

	roll, err := CryptoRandInt(totalWeight)
	if err != nil {
		return items[0], err
	}

	var currentWeight int64
	for _, item := range items {
		currentWeight += int64(item.Weight)
		if roll < currentWeight {
			return item, nil
		}
	}

	return items[len(items)-1], nil
}
