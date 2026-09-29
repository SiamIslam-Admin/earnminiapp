package service

import (
	"context"
	"fmt"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
)

type SupportService struct {
	supportRepo *repository.SupportRepository
}

func NewSupportService(supportRepo *repository.SupportRepository) *SupportService {
	return &SupportService{supportRepo: supportRepo}
}

func (s *SupportService) CreateTicket(ctx context.Context, userID *int64, req *model.FeedbackRequest, screenshotURL string) (*model.FeedbackResponse, error) {
	ticket := &model.SupportTicket{
		UserID:        userID,
		Email:         req.Email,
		Category:      req.Category,
		Description:   req.Description,
		ScreenshotURL: screenshotURL,
		Status:        "open",
	}

	if err := s.supportRepo.CreateTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to create support ticket: %w", err)
	}

	return &model.FeedbackResponse{
		TicketID:  ticket.ID,
		Status:    "open",
		Message:   "Thank you! Our support team will review your report and get back to you via email.",
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}
