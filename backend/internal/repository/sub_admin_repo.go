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

type SubAdminRepository struct {
	pool *pgxpool.Pool
}

func NewSubAdminRepository(pool *pgxpool.Pool) *SubAdminRepository {
	return &SubAdminRepository{pool: pool}
}

func (r *SubAdminRepository) GetAll(ctx context.Context) ([]model.SubAdmin, error) {
	query := `
		SELECT id, telegram_id, COALESCE(username, ''), COALESCE(first_name, ''), role, permissions, is_active, created_by, created_at, updated_at
		FROM sub_admins
		ORDER BY id ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query sub_admins: %w", err)
	}
	defer rows.Close()

	var list []model.SubAdmin
	for rows.Next() {
		var sa model.SubAdmin
		var permBytes []byte
		if err := rows.Scan(
			&sa.ID, &sa.TelegramID, &sa.Username, &sa.FirstName, &sa.Role,
			&permBytes, &sa.IsActive, &sa.CreatedBy, &sa.CreatedAt, &sa.UpdatedAt,
		); err == nil {
			if len(permBytes) > 0 {
				_ = json.Unmarshal(permBytes, &sa.Permissions)
			}
			if sa.Permissions == nil {
				sa.Permissions = []string{}
			}
			list = append(list, sa)
		}
	}
	return list, nil
}

func (r *SubAdminRepository) GetByID(ctx context.Context, id int64) (*model.SubAdmin, error) {
	query := `
		SELECT id, telegram_id, COALESCE(username, ''), COALESCE(first_name, ''), role, permissions, is_active, created_by, created_at, updated_at
		FROM sub_admins
		WHERE id = $1
	`
	var sa model.SubAdmin
	var permBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&sa.ID, &sa.TelegramID, &sa.Username, &sa.FirstName, &sa.Role,
		&permBytes, &sa.IsActive, &sa.CreatedBy, &sa.CreatedAt, &sa.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get sub_admin by id: %w", err)
	}
	if len(permBytes) > 0 {
		_ = json.Unmarshal(permBytes, &sa.Permissions)
	}
	if sa.Permissions == nil {
		sa.Permissions = []string{}
	}
	return &sa, nil
}

func (r *SubAdminRepository) GetByTelegramID(ctx context.Context, tgID int64) (*model.SubAdmin, error) {
	query := `
		SELECT id, telegram_id, COALESCE(username, ''), COALESCE(first_name, ''), role, permissions, is_active, created_by, created_at, updated_at
		FROM sub_admins
		WHERE telegram_id = $1 AND is_active = TRUE
	`
	var sa model.SubAdmin
	var permBytes []byte
	err := r.pool.QueryRow(ctx, query, tgID).Scan(
		&sa.ID, &sa.TelegramID, &sa.Username, &sa.FirstName, &sa.Role,
		&permBytes, &sa.IsActive, &sa.CreatedBy, &sa.CreatedAt, &sa.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get sub_admin by telegram id: %w", err)
	}
	if len(permBytes) > 0 {
		_ = json.Unmarshal(permBytes, &sa.Permissions)
	}
	if sa.Permissions == nil {
		sa.Permissions = []string{}
	}
	return &sa, nil
}

func (r *SubAdminRepository) Create(ctx context.Context, sa *model.SubAdmin) error {
	permBytes, err := json.Marshal(sa.Permissions)
	if err != nil {
		permBytes = []byte("[]")
	}

	query := `
		INSERT INTO sub_admins (telegram_id, username, first_name, role, permissions, is_active, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (telegram_id) DO UPDATE SET
			username = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			role = EXCLUDED.role,
			permissions = EXCLUDED.permissions,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(
		ctx, query, sa.TelegramID, sa.Username, sa.FirstName, sa.Role, permBytes, sa.IsActive, sa.CreatedBy,
	).Scan(&sa.ID, &sa.CreatedAt, &sa.UpdatedAt)
}

func (r *SubAdminRepository) Update(ctx context.Context, sa *model.SubAdmin) error {
	permBytes, err := json.Marshal(sa.Permissions)
	if err != nil {
		permBytes = []byte("[]")
	}

	query := `
		UPDATE sub_admins
		SET role = $2, permissions = $3, is_active = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`
	return r.pool.QueryRow(ctx, query, sa.ID, sa.Role, permBytes, sa.IsActive).Scan(&sa.UpdatedAt)
}

func (r *SubAdminRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM sub_admins WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
