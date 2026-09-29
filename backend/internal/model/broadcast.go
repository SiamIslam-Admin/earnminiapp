package model

import (
	"encoding/json"
	"time"
)

type BroadcastButton struct {
	Text string `json:"text"`
	URL  string `json:"url"`
}

type BroadcastJob struct {
	ID             int64               `json:"id"`
	Title          string              `json:"title"`
	Message        string              `json:"message"`
	ParseMode      string              `json:"parse_mode"` // "HTML", "MarkdownV2", "Markdown"
	MediaURL       string              `json:"media_url"`
	MediaType      string              `json:"media_type"` // "", "photo", "video"
	Buttons        [][]BroadcastButton `json:"buttons"`
	TargetAudience string              `json:"target_audience"` // "all", "active", "premium", "with_balance"
	Status         string              `json:"status"`          // "pending", "in_progress", "completed", "cancelled", "failed"
	TotalUsers     int                 `json:"total_users"`
	SentCount      int                 `json:"sent_count"`
	FailedCount    int                 `json:"failed_count"`
	CreatedBy      *int64              `json:"created_by,omitempty"`
	StartedAt      *time.Time          `json:"started_at,omitempty"`
	CompletedAt    *time.Time          `json:"completed_at,omitempty"`
	ErrorMessage   string              `json:"error_message,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

type CreateBroadcastRequest struct {
	Title          string              `json:"title"`
	Message        string              `json:"message"`
	MessageText    string              `json:"message_text"`
	ParseMode      string              `json:"parse_mode"`
	MediaURL       string              `json:"media_url"`
	MediaType      string              `json:"media_type"`
	ButtonsRaw     json.RawMessage     `json:"buttons"`
	Buttons        [][]BroadcastButton `json:"-"`
	TargetAudience string              `json:"target_audience"`
	DryRun         bool                `json:"dry_run"`
}

type PreviewBroadcastRequest struct {
	TelegramID  int64               `json:"telegram_id"`
	Message     string              `json:"message"`
	MessageText string              `json:"message_text"`
	ParseMode   string              `json:"parse_mode"`
	MediaURL    string              `json:"media_url"`
	MediaType   string              `json:"media_type"`
	ButtonsRaw  json.RawMessage     `json:"buttons"`
	Buttons     [][]BroadcastButton `json:"-"`
}

func (r *CreateBroadcastRequest) Normalize() {
	if r.Message == "" && r.MessageText != "" {
		r.Message = r.MessageText
	}
	if len(r.ButtonsRaw) > 0 {
		var buttons2D [][]BroadcastButton
		if err := json.Unmarshal(r.ButtonsRaw, &buttons2D); err == nil {
			r.Buttons = buttons2D
			return
		}
		var buttons1D []BroadcastButton
		if err := json.Unmarshal(r.ButtonsRaw, &buttons1D); err == nil {
			r.Buttons = [][]BroadcastButton{buttons1D}
			return
		}
	}
}

func (r *PreviewBroadcastRequest) Normalize() {
	if r.Message == "" && r.MessageText != "" {
		r.Message = r.MessageText
	}
	if len(r.ButtonsRaw) > 0 {
		var buttons2D [][]BroadcastButton
		if err := json.Unmarshal(r.ButtonsRaw, &buttons2D); err == nil {
			r.Buttons = buttons2D
			return
		}
		var buttons1D []BroadcastButton
		if err := json.Unmarshal(r.ButtonsRaw, &buttons1D); err == nil {
			r.Buttons = [][]BroadcastButton{buttons1D}
			return
		}
	}
}
