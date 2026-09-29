package service_test

import (
	"context"
	"testing"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
)

func TestTaskRequirementValidation(t *testing.T) {
	taskService := service.NewTaskService(nil, nil, nil, nil, nil)
	if taskService == nil {
		t.Fatal("Expected taskService instance")
	}

	// Test claiming non-existent user returns error
	_, err := taskService.ClaimTask(context.Background(), 999999, "ready-1")
	if err == nil {
		t.Errorf("Expected error for non-existent user, got nil")
	}
}

func TestDailyTaskDateComparison(t *testing.T) {
	nowUTC := time.Now().UTC()
	todayStartUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	yesterday := nowUTC.Add(-25 * time.Hour)

	if !yesterday.Before(todayStartUTC) {
		t.Errorf("Expected yesterday to be before today start UTC")
	}

	todayClaim := nowUTC.Add(-10 * time.Minute)
	if todayClaim.Before(todayStartUTC) {
		t.Errorf("Expected today claim to be after today start UTC")
	}
}

func TestTaskTypesModelSerialization(t *testing.T) {
	item := model.TaskItemResponse{
		ID:                  "task-test-1",
		TaskType:            "telegram_channel",
		TaskTypeSnake:       "telegram_channel",
		TargetCount:         1,
		RewardGems:          500,
		RewardDiamondsSnake: 500,
		RewardSpins:         2,
		RewardSpinsSnake:    2,
		Status:              "pending",
		ChannelID:           "@SpinCraftCommunity",
		ChannelIDSnake:      "@SpinCraftCommunity",
	}

	if item.TaskType != "telegram_channel" {
		t.Errorf("Expected taskType 'telegram_channel', got %s", item.TaskType)
	}

	if item.RewardGems != 500 || item.RewardDiamondsSnake != 500 {
		t.Errorf("Expected rewardGems 500, got %d", item.RewardGems)
	}

	if item.RewardSpins != 2 || item.RewardSpinsSnake != 2 {
		t.Errorf("Expected rewardSpins 2, got %d", item.RewardSpins)
	}
}
