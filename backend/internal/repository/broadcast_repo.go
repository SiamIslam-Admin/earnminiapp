package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"earnminiapp/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BroadcastRepository struct {
	pool *pgxpool.Pool
}

func NewBroadcastRepository(pool *pgxpool.Pool) *BroadcastRepository {
	return &BroadcastRepository{pool: pool}
}

func (r *BroadcastRepository) Create(ctx context.Context, job *model.BroadcastJob) error {
	buttonsBytes, err := json.Marshal(job.Buttons)
	if err != nil {
		buttonsBytes = []byte("[]")
	}

	query := `
		INSERT INTO broadcast_jobs (
			title, message, parse_mode, media_url, media_type, buttons_json,
			target_audience, status, total_users, sent_count, failed_count, created_by, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(
		ctx, query,
		job.Title, job.Message, job.ParseMode, job.MediaURL, job.MediaType, buttonsBytes,
		job.TargetAudience, job.Status, job.TotalUsers, job.CreatedBy,
	).Scan(&job.ID, &job.CreatedAt, &job.UpdatedAt)
}

func (r *BroadcastRepository) GetByID(ctx context.Context, id int64) (*model.BroadcastJob, error) {
	query := `
		SELECT id, title, message, parse_mode, COALESCE(media_url, ''), COALESCE(media_type, ''),
		       buttons_json, target_audience, status, total_users, sent_count, failed_count,
		       created_by, started_at, completed_at, COALESCE(error_message, ''), created_at, updated_at
		FROM broadcast_jobs
		WHERE id = $1
	`
	var job model.BroadcastJob
	var buttonsBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.Title, &job.Message, &job.ParseMode, &job.MediaURL, &job.MediaType,
		&buttonsBytes, &job.TargetAudience, &job.Status, &job.TotalUsers, &job.SentCount, &job.FailedCount,
		&job.CreatedBy, &job.StartedAt, &job.CompletedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get broadcast job: %w", err)
	}

	if len(buttonsBytes) > 0 {
		_ = json.Unmarshal(buttonsBytes, &job.Buttons)
	}
	if job.Buttons == nil {
		job.Buttons = [][]model.BroadcastButton{}
	}

	return &job, nil
}

func (r *BroadcastRepository) GetAll(ctx context.Context, limit, offset int) ([]model.BroadcastJob, int64, error) {
	var total int64
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM broadcast_jobs").Scan(&total)

	query := `
		SELECT id, title, message, parse_mode, COALESCE(media_url, ''), COALESCE(media_type, ''),
		       buttons_json, target_audience, status, total_users, sent_count, failed_count,
		       created_by, started_at, completed_at, COALESCE(error_message, ''), created_at, updated_at
		FROM broadcast_jobs
		ORDER BY id DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query broadcast jobs: %w", err)
	}
	defer rows.Close()

	var list []model.BroadcastJob
	for rows.Next() {
		var job model.BroadcastJob
		var buttonsBytes []byte
		if err := rows.Scan(
			&job.ID, &job.Title, &job.Message, &job.ParseMode, &job.MediaURL, &job.MediaType,
			&buttonsBytes, &job.TargetAudience, &job.Status, &job.TotalUsers, &job.SentCount, &job.FailedCount,
			&job.CreatedBy, &job.StartedAt, &job.CompletedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
		); err == nil {
			if len(buttonsBytes) > 0 {
				_ = json.Unmarshal(buttonsBytes, &job.Buttons)
			}
			if job.Buttons == nil {
				job.Buttons = [][]model.BroadcastButton{}
			}
			list = append(list, job)
		}
	}
	return list, total, nil
}

func (r *BroadcastRepository) GetPendingJob(ctx context.Context) (*model.BroadcastJob, error) {
	query := `
		SELECT id, title, message, parse_mode, COALESCE(media_url, ''), COALESCE(media_type, ''),
		       buttons_json, target_audience, status, total_users, sent_count, failed_count,
		       created_by, started_at, completed_at, COALESCE(error_message, ''), created_at, updated_at
		FROM broadcast_jobs
		WHERE status = 'pending'
		ORDER BY id ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`
	var job model.BroadcastJob
	var buttonsBytes []byte
	err := r.pool.QueryRow(ctx, query).Scan(
		&job.ID, &job.Title, &job.Message, &job.ParseMode, &job.MediaURL, &job.MediaType,
		&buttonsBytes, &job.TargetAudience, &job.Status, &job.TotalUsers, &job.SentCount, &job.FailedCount,
		&job.CreatedBy, &job.StartedAt, &job.CompletedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if len(buttonsBytes) > 0 {
		_ = json.Unmarshal(buttonsBytes, &job.Buttons)
	}
	if job.Buttons == nil {
		job.Buttons = [][]model.BroadcastButton{}
	}
	return &job, nil
}

func (r *BroadcastRepository) UpdateProgress(ctx context.Context, id int64, sent, failed int) error {
	query := `
		UPDATE broadcast_jobs
		SET sent_count = $2, failed_count = $3, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id, sent, failed)
	return err
}

func (r *BroadcastRepository) UpdateStatus(ctx context.Context, id int64, status, errMsg string) error {
	var query string
	if status == "in_progress" {
		query = `UPDATE broadcast_jobs SET status = $2, started_at = NOW(), updated_at = NOW() WHERE id = $1`
		_, err := r.pool.Exec(ctx, query, id, status)
		return err
	} else {
		query = `UPDATE broadcast_jobs SET status = $2, error_message = $3, completed_at = NOW(), updated_at = NOW() WHERE id = $1`
		_, err := r.pool.Exec(ctx, query, id, status, errMsg)
		return err
	}
}

func (r *BroadcastRepository) Cancel(ctx context.Context, id int64) error {
	query := `
		UPDATE broadcast_jobs
		SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status IN ('pending', 'in_progress')
	`
	res, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errors.New("job cannot be cancelled (not in pending or in_progress status)")
	}
	return nil
}

func (r *BroadcastRepository) GetTargetTelegramIDs(ctx context.Context, targetAudience string) ([]int64, error) {
	var query string
	switch targetAudience {
	case "premium":
		query = `SELECT telegram_id FROM users WHERE is_banned = FALSE AND is_premium = TRUE AND telegram_id != 0 ORDER BY id ASC`
	case "with_balance":
		query = `SELECT telegram_id FROM users WHERE is_banned = FALSE AND balance_usd > 0 AND telegram_id != 0 ORDER BY id ASC`
	case "active":
		query = `SELECT telegram_id FROM users WHERE is_banned = FALSE AND last_active_at >= NOW() - INTERVAL '7 days' AND telegram_id != 0 ORDER BY id ASC`
	default:
		query = `SELECT telegram_id FROM users WHERE is_banned = FALSE AND telegram_id != 0 ORDER BY id ASC`
	}

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch target users: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var tgID int64
		if err := rows.Scan(&tgID); err == nil && tgID != 0 {
			ids = append(ids, tgID)
		}
	}
	return ids, nil
}
