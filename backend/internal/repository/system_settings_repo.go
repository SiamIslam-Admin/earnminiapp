package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SystemSettingsRepository struct {
	pool *pgxpool.Pool
}

func NewSystemSettingsRepository(pool *pgxpool.Pool) *SystemSettingsRepository {
	return &SystemSettingsRepository{pool: pool}
}

func (r *SystemSettingsRepository) Get(ctx context.Context, key string) (string, error) {
	query := `SELECT value FROM system_settings WHERE key = $1`
	var val string
	err := r.pool.QueryRow(ctx, query, key).Scan(&val)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return val, err
}

func (r *SystemSettingsRepository) Set(ctx context.Context, key, value string) error {
	query := `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_at = NOW()
	`
	_, err := r.pool.Exec(ctx, query, key, value)
	return err
}
