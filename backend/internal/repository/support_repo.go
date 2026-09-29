package repository

import (
	"context"

	"earnminiapp/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SupportRepository struct {
	pool *pgxpool.Pool
}

func NewSupportRepository(pool *pgxpool.Pool) *SupportRepository {
	return &SupportRepository{pool: pool}
}

func (r *SupportRepository) CreateTicket(ctx context.Context, ticket *model.SupportTicket) error {
	query := `
		INSERT INTO support_tickets (user_id, email, category, description, screenshot_url, status, created_at)
		VALUES ($1, $2, $3, $4, $5, 'open', NOW())
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		ticket.UserID, ticket.Email, ticket.Category, ticket.Description, ticket.ScreenshotURL,
	).Scan(&ticket.ID, &ticket.CreatedAt)
}
