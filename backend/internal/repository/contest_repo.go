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

type ContestRepository struct {
	pool *pgxpool.Pool
}

func NewContestRepository(pool *pgxpool.Pool) *ContestRepository {
	return &ContestRepository{pool: pool}
}

func (r *ContestRepository) GetAllContests(ctx context.Context) ([]model.Contest, error) {
	query := `
		SELECT id, contest_id, type, title, prize_pool_usd, COALESCE(prize_pool_str, ''),
		       COALESCE(icon, ''), prize_distribution, starts_at, ends_at,
		       status, is_active, COALESCE(winners_json::text, '[]'), created_at, updated_at
		FROM contests
		ORDER BY id DESC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Contest
	for rows.Next() {
		var c model.Contest
		var prizeDistBytes []byte
		if err := rows.Scan(
			&c.ID, &c.ContestID, &c.Type, &c.Title, &c.PrizePoolUSD, &c.PrizePoolStr,
			&c.Icon, &prizeDistBytes, &c.StartsAt, &c.EndsAt,
			&c.Status, &c.IsActive, &c.WinnersJSON, &c.CreatedAt, &c.UpdatedAt,
		); err == nil {
			_ = json.Unmarshal(prizeDistBytes, &c.PrizeDistribution)
			list = append(list, c)
		}
	}
	return list, nil
}

func (r *ContestRepository) GetActiveContests(ctx context.Context) ([]model.Contest, error) {
	query := `
		SELECT id, contest_id, type, title, prize_pool_usd, COALESCE(prize_pool_str, ''),
		       COALESCE(icon, ''), prize_distribution, starts_at, ends_at,
		       status, is_active, COALESCE(winners_json::text, '[]'), created_at, updated_at
		FROM contests
		WHERE is_active = true AND status = 'active'
		ORDER BY id ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Contest
	for rows.Next() {
		var c model.Contest
		var prizeDistBytes []byte
		if err := rows.Scan(
			&c.ID, &c.ContestID, &c.Type, &c.Title, &c.PrizePoolUSD, &c.PrizePoolStr,
			&c.Icon, &prizeDistBytes, &c.StartsAt, &c.EndsAt,
			&c.Status, &c.IsActive, &c.WinnersJSON, &c.CreatedAt, &c.UpdatedAt,
		); err == nil {
			_ = json.Unmarshal(prizeDistBytes, &c.PrizeDistribution)
			list = append(list, c)
		}
	}
	return list, nil
}

func (r *ContestRepository) GetByID(ctx context.Context, contestID string) (*model.Contest, error) {
	query := `
		SELECT id, contest_id, type, title, prize_pool_usd, COALESCE(prize_pool_str, ''),
		       COALESCE(icon, ''), prize_distribution, starts_at, ends_at,
		       status, is_active, COALESCE(winners_json::text, '[]'), created_at, updated_at
		FROM contests
		WHERE contest_id = $1 OR CAST(id AS TEXT) = $1
		LIMIT 1
	`
	var c model.Contest
	var prizeDistBytes []byte
	err := r.pool.QueryRow(ctx, query, contestID).Scan(
		&c.ID, &c.ContestID, &c.Type, &c.Title, &c.PrizePoolUSD, &c.PrizePoolStr,
		&c.Icon, &prizeDistBytes, &c.StartsAt, &c.EndsAt,
		&c.Status, &c.IsActive, &c.WinnersJSON, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	_ = json.Unmarshal(prizeDistBytes, &c.PrizeDistribution)
	return &c, nil
}

func (r *ContestRepository) GetActiveByType(ctx context.Context, contestType string) (*model.Contest, error) {
	query := `
		SELECT id, contest_id, type, title, prize_pool_usd, COALESCE(prize_pool_str, ''),
		       COALESCE(icon, ''), prize_distribution, starts_at, ends_at,
		       status, is_active, COALESCE(winners_json::text, '[]'), created_at, updated_at
		FROM contests
		WHERE type = $1 AND is_active = true AND status = 'active'
		ORDER BY id DESC
		LIMIT 1
	`
	var c model.Contest
	var prizeDistBytes []byte
	err := r.pool.QueryRow(ctx, query, contestType).Scan(
		&c.ID, &c.ContestID, &c.Type, &c.Title, &c.PrizePoolUSD, &c.PrizePoolStr,
		&c.Icon, &prizeDistBytes, &c.StartsAt, &c.EndsAt,
		&c.Status, &c.IsActive, &c.WinnersJSON, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	_ = json.Unmarshal(prizeDistBytes, &c.PrizeDistribution)
	return &c, nil
}

func (r *ContestRepository) Create(ctx context.Context, c *model.Contest) error {
	prizeDistJSON, err := json.Marshal(c.PrizeDistribution)
	if err != nil {
		prizeDistJSON = []byte("[]")
	}

	query := `
		INSERT INTO contests (contest_id, type, title, prize_pool_usd, prize_pool_str, icon, prize_distribution, starts_at, ends_at, status, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, NOW(), NOW())
		ON CONFLICT (contest_id) DO UPDATE SET
			title = EXCLUDED.title,
			prize_pool_usd = EXCLUDED.prize_pool_usd,
			prize_pool_str = EXCLUDED.prize_pool_str,
			icon = EXCLUDED.icon,
			prize_distribution = EXCLUDED.prize_distribution,
			starts_at = EXCLUDED.starts_at,
			ends_at = EXCLUDED.ends_at,
			status = EXCLUDED.status,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
		RETURNING id
	`
	return r.pool.QueryRow(ctx, query,
		c.ContestID, c.Type, c.Title, c.PrizePoolUSD, c.PrizePoolStr, c.Icon,
		string(prizeDistJSON), c.StartsAt, c.EndsAt, c.Status, c.IsActive,
	).Scan(&c.ID)
}

func (r *ContestRepository) Update(ctx context.Context, contestID string, req *model.UpdateContestRequest) error {
	existing, err := r.GetByID(ctx, contestID)
	if err != nil || existing == nil {
		return fmt.Errorf("contest not found")
	}

	if req.Title != nil {
		existing.Title = *req.Title
	}
	if req.PrizePoolUSD != nil {
		existing.PrizePoolUSD = *req.PrizePoolUSD
	}
	if req.PrizePoolStr != nil {
		existing.PrizePoolStr = *req.PrizePoolStr
	}
	if req.Icon != nil {
		existing.Icon = *req.Icon
	}
	if req.PrizeDistribution != nil {
		existing.PrizeDistribution = *req.PrizeDistribution
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}
	if req.StartsAt != nil {
		existing.StartsAt = *req.StartsAt
	}
	if req.EndsAt != nil {
		existing.EndsAt = *req.EndsAt
	}

	prizeDistJSON, _ := json.Marshal(existing.PrizeDistribution)

	query := `
		UPDATE contests
		SET title = $1, prize_pool_usd = $2, prize_pool_str = $3, icon = $4,
		    prize_distribution = $5::jsonb, status = $6, is_active = $7,
		    starts_at = $8, ends_at = $9, updated_at = NOW()
		WHERE contest_id = $10 OR CAST(id AS TEXT) = $10
	`
	_, err = r.pool.Exec(ctx, query,
		existing.Title, existing.PrizePoolUSD, existing.PrizePoolStr, existing.Icon,
		string(prizeDistJSON), existing.Status, existing.IsActive,
		existing.StartsAt, existing.EndsAt, contestID,
	)
	return err
}

func (r *ContestRepository) Delete(ctx context.Context, contestID string) error {
	query := `DELETE FROM contests WHERE contest_id = $1 OR CAST(id AS TEXT) = $1`
	_, err := r.pool.Exec(ctx, query, contestID)
	return err
}

func (r *ContestRepository) MarkContestEndedIfActive(ctx context.Context, contestID string) (bool, error) {
	query := `
		UPDATE contests
		SET status = 'ended', is_active = false, updated_at = NOW()
		WHERE (contest_id = $1 OR CAST(id AS TEXT) = $1) AND status = 'active'
	`
	tag, err := r.pool.Exec(ctx, query, contestID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *ContestRepository) SaveWinners(ctx context.Context, contestID string, winnersJSON string) error {
	query := `
		UPDATE contests
		SET winners_json = $1::jsonb, updated_at = NOW()
		WHERE contest_id = $2 OR CAST(id AS TEXT) = $2
	`
	_, err := r.pool.Exec(ctx, query, winnersJSON, contestID)
	return err
}

func (r *ContestRepository) EndContestAndSaveWinners(ctx context.Context, contestID string, winnersJSON string) error {
	query := `
		UPDATE contests
		SET status = 'ended', is_active = false, winners_json = $1::jsonb, updated_at = NOW()
		WHERE contest_id = $2 OR CAST(id AS TEXT) = $2
	`
	_, err := r.pool.Exec(ctx, query, winnersJSON, contestID)
	return err
}

