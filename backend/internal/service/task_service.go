package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
)

type TaskService struct {
	userRepo        *repository.UserRepository
	taskRepo        *repository.TaskRepository
	txRepo          *repository.TransactionRepository
	joinRequestRepo *repository.JoinRequestRepository
	botClient       *telegram.BotClient
}

func NewTaskService(
	userRepo *repository.UserRepository,
	taskRepo *repository.TaskRepository,
	txRepo *repository.TransactionRepository,
	joinRequestRepo *repository.JoinRequestRepository,
	botClient *telegram.BotClient,
) *TaskService {
	return &TaskService{
		userRepo:        userRepo,
		taskRepo:        taskRepo,
		txRepo:          txRepo,
		joinRequestRepo: joinRequestRepo,
		botClient:       botClient,
	}
}

func (s *TaskService) GetTasksPage(ctx context.Context, userID int64) (*model.TasksPageResponse, error) {
	if s.taskRepo == nil || s.userRepo == nil {
		return &model.TasksPageResponse{
			Tasks: []model.TaskItemResponse{},
		}, nil
	}

	allTasks, err := s.taskRepo.GetAllActiveTasks(ctx)
	if err != nil {
		return nil, err
	}

	userTasksMap, err := s.taskRepo.GetUserTasksMap(ctx, userID)
	if err != nil {
		return nil, err
	}

	referralsCount, _ := s.userRepo.CountReferrals(ctx, userID)
	user, _ := s.userRepo.GetByID(ctx, userID)

	nowUTC := time.Now().UTC()
	todayStartUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)

	var taskItems []model.TaskItemResponse
	for _, t := range allTasks {
		taskIdentifier := t.ID
		if t.TaskID != "" {
			taskIdentifier = t.TaskID
		}

		ut, exists := userTasksMap[taskIdentifier]
		status := "pending"
		currentProgress := 0
		verificationSeconds := 0

		if exists {
			status = ut.Status
			currentProgress = ut.Progress

			// 1. Daily task reset check (resets at UTC 00:00)
			if t.Category == "daily" && status == "completed" && ut.ClaimedAt != nil {
				if ut.ClaimedAt.UTC().Before(todayStartUTC) {
					status = "pending"
					currentProgress = 0
				}
			}

			// 2. External social task verification countdown check
			if status == "verifying" && ut.StartedAt != nil {
				elapsed := int(time.Since(ut.StartedAt.UTC()).Seconds())
				if elapsed < 15 {
					verificationSeconds = 15 - elapsed
				} else {
					verificationSeconds = 0
					status = "pending" // Ready to claim
				}
			}
		}

		// 3. Evaluate dynamic in-app milestone progress
		switch t.TaskType {
		case "invite_count":
			currentProgress = referralsCount
		case "spin_count":
			// currentProgress already set from ut.Progress
		case "level_reach":
			if user != nil {
				currentProgress = user.Level
			}
		}

		item := model.TaskItemResponse{
			ID:                  taskIdentifier,
			TaskID:              taskIdentifier,
			Category:            t.Category,
			Title:               t.Title,
			Icon:                t.Icon,
			IconURL:             t.IconURL,
			IconURLSnake:        t.IconURL,
			IsIconImage:         t.IsIconImage || t.IconURL != "",
			TaskType:            t.TaskType,
			TaskTypeSnake:       t.TaskType,
			TargetCount:         t.TargetCount,
			TargetCountSnake:    t.TargetCount,
			RewardGems:          t.RewardGems,
			RewardDiamondsSnake: t.RewardGems,
			RewardGemsSnake:     t.RewardGems,
			RewardSpins:         t.RewardSpins,
			RewardSpinsSnake:    t.RewardSpins,
			SecondaryRewardGems: t.SecondaryRewardGems,
			Status:              status,
			VerificationSeconds: verificationSeconds,
			ActionURL:           t.ActionURL,
			ActionURLSnake:      t.ActionURL,
			ChannelID:           t.ChannelID,
			ChannelIDSnake:      t.ChannelID,
		}

		if t.TargetCount > 1 {
			item.Progress = &model.TaskProgress{
				Current: currentProgress,
				Total:   t.TargetCount,
			}
		}

		taskItems = append(taskItems, item)
	}

	// Ready to claim banner if user has at least 1 referral
	var readyToClaim *model.ReadyToClaimItemResponse
	if referralsCount >= 1 {
		if ut, ok := userTasksMap["ready-1"]; !ok || ut.Status != "completed" {
			readyToClaim = &model.ReadyToClaimItemResponse{
				ID:                  "ready-1",
				Title:               "Extra for 1 invitation",
				Icon:                "./assets/inviteFeatureCardIcon.png",
				RewardGems:          300,
				RewardDiamondsSnake: 300,
				RewardGemsSnake:     300,
			}
		}
	}

	return &model.TasksPageResponse{
		ReadyToClaim: readyToClaim,
		Tasks:        taskItems,
	}, nil
}

// StartTask tracks when a user opens/clicks an external link task or channel join (sets status to 'verifying')
func (s *TaskService) StartTask(ctx context.Context, userID int64, taskID string) error {
	if s.taskRepo == nil {
		return errors.New("task repository unavailable")
	}

	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil || task == nil {
		return errors.New("task not found")
	}

	return s.taskRepo.StartTask(ctx, userID, taskID)
}

// ClaimTask validates requirements, prevents double-claims, and atomically credits rewards
func (s *TaskService) ClaimTask(ctx context.Context, userID int64, taskID string) (*model.UserResponse, error) {
	if s.userRepo == nil || s.taskRepo == nil {
		return nil, errors.New("task repository unavailable")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	var rewardGems int64 = 0
	var rewardSpins int = 0
	var taskTitle string = taskID
	var isDaily bool = false

	if taskID == "ready-1" {
		// Verify invite requirement
		referralsCount, _ := s.userRepo.CountReferrals(ctx, userID)
		if referralsCount < 1 {
			return nil, errors.New("you need at least 1 invited friend to claim this reward")
		}
		rewardGems = 300
		taskTitle = "Extra for 1 invitation"
	} else {
		task, err := s.taskRepo.GetByID(ctx, taskID)
		if err != nil || task == nil {
			return nil, errors.New("task not found or expired")
		}

		isDaily = (task.Category == "daily")
		taskTitle = task.Title
		rewardGems = int64(task.RewardGems)
		rewardSpins = task.RewardSpins

		// 1. Channel / Group Membership Verification (Type 3)
		if task.ChannelID != "" || task.TaskType == "telegram_channel" {
			targetChannel := task.ChannelID
			if targetChannel == "" {
				targetChannel = task.ActionURL
			}
			if targetChannel != "" {
				if s.botClient == nil {
					return nil, errors.New("telegram bot verification service is unavailable")
				}
				isMember, _ := s.botClient.IsUserInChannel(targetChannel, user.TelegramID)
				if !isMember && s.joinRequestRepo != nil {
					// Also check if user submitted a Telegram join request
					hasRequested, _ := s.joinRequestRepo.HasUserRequestedJoin(ctx, targetChannel, user.TelegramID)
					if hasRequested {
						isMember = true
					}
				}

				if !isMember {
					return nil, errors.New("please join the official Telegram channel/group or send a join request first before claiming your reward")
				}
			}
		}

		// 2. In-App Requirement Verification (Type 2)
		switch task.TaskType {
		case "invite_count":
			referralsCount, _ := s.userRepo.CountReferrals(ctx, userID)
			if referralsCount < task.TargetCount {
				return nil, fmt.Errorf("you need %d referrals to claim this reward (current: %d)", task.TargetCount, referralsCount)
			}
		case "spin_count":
			ut, _ := s.taskRepo.GetUserTask(ctx, userID, taskID)
			spinProgress := 0
			if ut != nil {
				spinProgress = ut.Progress
			}
			if spinProgress < task.TargetCount {
				return nil, fmt.Errorf("you need %d wheel spins to claim this reward (current: %d)", task.TargetCount, spinProgress)
			}
		case "level_reach":
			if user.Level < task.TargetCount {
				return nil, fmt.Errorf("you must reach level %d to claim this reward (current level: %d)", task.TargetCount, user.Level)
			}
		}

		// 3. External Social Task Verification (Type 1: Timer Check)
		if (task.TaskType == "external_link" || task.TaskType == "social_x" || task.TaskType == "website_visit") || (task.ActionURL != "" && task.ChannelID == "" && task.TaskType != "invite_count" && task.TaskType != "spin_count" && task.TaskType != "level_reach" && task.TaskType != "telegram_channel") {
			ut, _ := s.taskRepo.GetUserTask(ctx, userID, taskID)
			if ut == nil || ut.StartedAt == nil {
				// Auto-start task if not started yet
				_ = s.taskRepo.StartTask(ctx, userID, taskID)
				return nil, errors.New("please open the task link first and wait 15 seconds to verify")
			}
			elapsed := time.Since(ut.StartedAt.UTC()).Seconds()
			if elapsed < 15 {
				return nil, fmt.Errorf("verifying task completion... please wait %d more seconds", int(15-elapsed))
			}
		}
	}

	if rewardGems <= 0 && rewardSpins <= 0 {
		return nil, errors.New("task has no rewards to claim")
	}

	var rewardDesc []string
	if rewardGems > 0 {
		rewardDesc = append(rewardDesc, fmt.Sprintf("+%d 💎", rewardGems))
	}
	if rewardSpins > 0 {
		rewardDesc = append(rewardDesc, fmt.Sprintf("+%d Spins", rewardSpins))
	}
	desc := strings.Join(rewardDesc, ", ")

	// 4. Atomic Claim Execution (ACID locked against double-claims and race conditions)
	updatedUser, err := s.taskRepo.ClaimTaskAtomic(ctx, userID, taskID, isDaily, rewardSpins, rewardGems, taskTitle, desc)
	if err != nil {
		return nil, err
	}

	userResp := ToUserResponse(updatedUser)
	return &userResp, nil
}
