package model

import "time"

type SupportTicket struct {
	ID            int64     `json:"id"`
	UserID        *int64    `json:"user_id,omitempty"`
	Email         string    `json:"email"`
	Category      string    `json:"category"` // 'general', 'withdrawal'
	Description   string    `json:"description"`
	ScreenshotURL string    `json:"screenshot_url,omitempty"`
	Status        string    `json:"status"` // 'open', 'in_review', 'resolved'
	CreatedAt     time.Time `json:"created_at"`
}

type FeedbackRequest struct {
	Email       string `json:"email" form:"email" binding:"required,email"`
	Category    string `json:"category" form:"category" binding:"required"` // 'general', 'withdrawal'
	Description string `json:"description" form:"description" binding:"required"`
}

type FeedbackResponse struct {
	TicketID  int64  `json:"ticketId"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}
