package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
)

type BroadcastService struct {
	broadcastRepo *repository.BroadcastRepository
	userRepo      *repository.UserRepository
	botClient     *telegram.BotClient
	cancelMap     sync.Map // map[int64]context.CancelFunc
}

func NewBroadcastService(
	broadcastRepo *repository.BroadcastRepository,
	userRepo *repository.UserRepository,
	botClient *telegram.BotClient,
) *BroadcastService {
	return &BroadcastService{
		broadcastRepo: broadcastRepo,
		userRepo:      userRepo,
		botClient:     botClient,
	}
}

func (s *BroadcastService) CreateJob(ctx context.Context, req *model.CreateBroadcastRequest, createdBy int64) (*model.BroadcastJob, error) {
	if s.broadcastRepo == nil {
		return nil, errors.New("broadcast repository unavailable")
	}

	if req.Message == "" {
		return nil, errors.New("broadcast message is required")
	}

	parseMode := req.ParseMode
	if parseMode == "" {
		parseMode = "HTML"
	}

	targetAudience := req.TargetAudience
	if targetAudience == "" {
		targetAudience = "all"
	}

	title := req.Title
	if title == "" {
		title = fmt.Sprintf("Broadcast %s", time.Now().Format("Jan 02 15:04"))
	}

	// Fetch recipient count
	targetIDs, err := s.broadcastRepo.GetTargetTelegramIDs(ctx, targetAudience)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate recipients: %w", err)
	}

	job := &model.BroadcastJob{
		Title:          title,
		Message:        req.Message,
		ParseMode:      parseMode,
		MediaURL:       req.MediaURL,
		MediaType:      req.MediaType,
		Buttons:        req.Buttons,
		TargetAudience: targetAudience,
		Status:         "pending",
		TotalUsers:     len(targetIDs),
		CreatedBy:      &createdBy,
	}

	if err := s.broadcastRepo.Create(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create broadcast job: %w", err)
	}

	return job, nil
}

func (s *BroadcastService) ListJobs(ctx context.Context, limit, offset int) ([]model.BroadcastJob, int64, error) {
	if s.broadcastRepo == nil {
		return []model.BroadcastJob{}, 0, nil
	}
	if limit <= 0 {
		limit = 20
	}
	return s.broadcastRepo.GetAll(ctx, limit, offset)
}

func (s *BroadcastService) GetJob(ctx context.Context, id int64) (*model.BroadcastJob, error) {
	if s.broadcastRepo == nil {
		return nil, errors.New("broadcast repository unavailable")
	}
	return s.broadcastRepo.GetByID(ctx, id)
}

func (s *BroadcastService) CancelJob(ctx context.Context, id int64) error {
	if s.broadcastRepo == nil {
		return errors.New("broadcast repository unavailable")
	}

	if cancelFn, ok := s.cancelMap.Load(id); ok {
		if fn, isFunc := cancelFn.(context.CancelFunc); isFunc {
			fn()
		}
	}

	return s.broadcastRepo.Cancel(ctx, id)
}

func (s *BroadcastService) SendPreview(ctx context.Context, req *model.PreviewBroadcastRequest) error {
	if s.botClient == nil {
		return errors.New("telegram bot client is not configured")
	}

	if req.TelegramID <= 0 {
		return errors.New("valid target telegram ID is required for preview")
	}

	buttons := formatButtons(req.Buttons)
	return s.botClient.SendBroadcastMessage(
		req.TelegramID, req.Message, req.ParseMode, req.MediaURL, req.MediaType, buttons,
	)
}

func (s *BroadcastService) StartWorker(ctx context.Context) {
	go func() {
		log.Println("[INFO] Broadcast Queue Worker started (rate-limited <= 25 msg/s)")
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[INFO] Broadcast Queue Worker stopped")
				return
			case <-ticker.C:
				s.processNextJob(ctx)
			}
		}
	}()
}

func (s *BroadcastService) processNextJob(parentCtx context.Context) {
	if s.broadcastRepo == nil || s.botClient == nil {
		return
	}

	job, err := s.broadcastRepo.GetPendingJob(parentCtx)
	if err != nil || job == nil {
		return
	}

	// Mark in_progress
	_ = s.broadcastRepo.UpdateStatus(parentCtx, job.ID, "in_progress", "")

	targetIDs, err := s.broadcastRepo.GetTargetTelegramIDs(parentCtx, job.TargetAudience)
	if err != nil || len(targetIDs) == 0 {
		_ = s.broadcastRepo.UpdateStatus(parentCtx, job.ID, "completed", "")
		return
	}

	jobCtx, cancel := context.WithCancel(parentCtx)
	s.cancelMap.Store(job.ID, cancel)
	defer func() {
		s.cancelMap.Delete(job.ID)
		cancel()
	}()

	buttons := formatButtons(job.Buttons)
	sentCount := 0
	failedCount := 0

	// Rate limiter: 25 messages per second (~40ms per msg)
	rateTicker := time.NewTicker(40 * time.Millisecond)
	defer rateTicker.Stop()

	for i, tgID := range targetIDs {
		select {
		case <-jobCtx.Done():
			_ = s.broadcastRepo.UpdateStatus(parentCtx, job.ID, "cancelled", "Cancelled by user")
			return
		case <-rateTicker.C:
		}

		err := s.botClient.SendBroadcastMessage(
			tgID, job.Message, job.ParseMode, job.MediaURL, job.MediaType, buttons,
		)
		if err != nil {
			failedCount++
		} else {
			sentCount++
		}

		// Batch progress update every 50 messages
		if (i+1)%50 == 0 || (i+1) == len(targetIDs) {
			_ = s.broadcastRepo.UpdateProgress(parentCtx, job.ID, sentCount, failedCount)
		}
	}

	_ = s.broadcastRepo.UpdateProgress(parentCtx, job.ID, sentCount, failedCount)
	_ = s.broadcastRepo.UpdateStatus(parentCtx, job.ID, "completed", "")
	log.Printf("[INFO] Broadcast job #%d finished: %d sent, %d failed", job.ID, sentCount, failedCount)
}

func formatButtons(btnRows [][]model.BroadcastButton) [][]map[string]interface{} {
	if len(btnRows) == 0 {
		return nil
	}
	result := make([][]map[string]interface{}, 0, len(btnRows))
	for _, row := range btnRows {
		var rowBtns []map[string]interface{}
		for _, b := range row {
			if b.Text != "" && b.URL != "" {
				rowBtns = append(rowBtns, map[string]interface{}{
					"text": b.Text,
					"url":  b.URL,
				})
			}
		}
		if len(rowBtns) > 0 {
			result = append(result, rowBtns)
		}
	}
	return result
}
