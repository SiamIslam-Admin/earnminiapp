package repository

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type JoinRequestRepository struct {
	pool *pgxpool.Pool
}

func NewJoinRequestRepository(pool *pgxpool.Pool) *JoinRequestRepository {
	return &JoinRequestRepository{pool: pool}
}

// RecordJoinRequest stores an incoming chat_join_request from Telegram Webhook
func (r *JoinRequestRepository) RecordJoinRequest(ctx context.Context, chatID, chatUsername string, userID int64, inviteLink string) error {
	if r.pool == nil {
		return nil
	}

	cleanUsername := strings.TrimPrefix(strings.TrimSpace(chatUsername), "@")

	query := `
		INSERT INTO telegram_join_requests (chat_id, chat_username, telegram_user_id, invite_link, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (chat_id, telegram_user_id) DO UPDATE SET
			chat_username = EXCLUDED.chat_username,
			invite_link = EXCLUDED.invite_link,
			created_at = NOW();
	`
	_, err := r.pool.Exec(ctx, query, strings.TrimSpace(chatID), cleanUsername, userID, inviteLink)
	return err
}

// HasUserRequestedJoin checks if a user submitted a join request for a chat ID or username
func (r *JoinRequestRepository) HasUserRequestedJoin(ctx context.Context, targetChat string, userID int64) (bool, error) {
	if r.pool == nil {
		return false, nil
	}

	cleanTarget := strings.TrimSpace(targetChat)
	cleanTarget = strings.TrimPrefix(cleanTarget, "https://t.me/")
	cleanTarget = strings.TrimPrefix(cleanTarget, "http://t.me/")
	cleanTarget = strings.TrimPrefix(cleanTarget, "t.me/")
	cleanTarget = strings.TrimPrefix(cleanTarget, "@")
	cleanTarget = strings.TrimSpace(cleanTarget)

	if cleanTarget == "" {
		return false, nil
	}

	query := `
		SELECT EXISTS(
			SELECT 1 FROM telegram_join_requests
			WHERE telegram_user_id = $1
			  AND (chat_id = $2 OR LOWER(chat_username) = LOWER($2))
		);
	`
	var exists bool
	err := r.pool.QueryRow(ctx, query, userID, cleanTarget).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}
