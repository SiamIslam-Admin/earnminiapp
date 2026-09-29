package model

import "time"

type SubAdmin struct {
	ID          int64     `json:"id"`
	TelegramID  int64     `json:"telegram_id"`
	Username    string    `json:"username"`
	FirstName   string    `json:"first_name"`
	Role        string    `json:"role"` // "moderator", "support", "manager", "admin"
	Permissions []string  `json:"permissions"`
	IsActive    bool      `json:"is_active"`
	CreatedBy   *int64    `json:"created_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateSubAdminRequest struct {
	TelegramID  int64    `json:"telegram_id" binding:"required"`
	Username    string   `json:"username"`
	FirstName   string   `json:"first_name"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

type UpdateSubAdminRequest struct {
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	IsActive    *bool    `json:"is_active"`
}
