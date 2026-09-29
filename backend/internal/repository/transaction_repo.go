package repository

import (
	"context"
	"fmt"

	"earnminiapp/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TransactionRepository struct {
	pool *pgxpool.Pool
}

func NewTransactionRepository(pool *pgxpool.Pool) *TransactionRepository {
	return &TransactionRepository{pool: pool}
}

func (r *TransactionRepository) Create(ctx context.Context, tx *model.Transaction) error {
	query := `
		INSERT INTO transactions (user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, tx_hash, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		tx.UserID, tx.Category, tx.Title, tx.AmountUSD, tx.AmountDiamonds,
		tx.AmountSpins, tx.AmountTickets, tx.Status, tx.ReferenceID, tx.TxHash, tx.Description,
	).Scan(&tx.ID, &tx.CreatedAt)
}

func (r *TransactionRepository) GetUserTransactions(ctx context.Context, userID int64, category string, limit, offset int) ([]model.Transaction, error) {
	var query string
	var args []interface{}

	if category == "" || category == "all" {
		query = `
			SELECT id, user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
			FROM transactions
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{userID, limit, offset}
	} else if category == "spins" {
		query = `
			SELECT id, user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
			FROM transactions
			WHERE user_id = $1 AND category IN ('spins', 'daily')
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{userID, limit, offset}
	} else if category == "tasks" {
		query = `
			SELECT id, user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
			FROM transactions
			WHERE user_id = $1 AND category IN ('tasks', 'team', 'gift')
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{userID, limit, offset}
	} else {
		query = `
			SELECT id, user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
			FROM transactions
			WHERE user_id = $1 AND category = $2
			ORDER BY created_at DESC
			LIMIT $3 OFFSET $4
		`
		args = []interface{}{userID, category, limit, offset}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer rows.Close()

	var list []model.Transaction
	for rows.Next() {
		var t model.Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Category, &t.Title, &t.AmountUSD, &t.AmountDiamonds,
			&t.AmountSpins, &t.AmountTickets, &t.Status, &t.ReferenceID, &t.TxHash,
			&t.Description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (r *TransactionRepository) GetFailedTransactions(ctx context.Context, limit, offset int) ([]model.Transaction, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, COALESCE(tx_hash, ''), COALESCE(description, ''), created_at
		FROM transactions
		WHERE status IN ('failed', 'stuck', 'rejected', 'error')
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query failed transactions: %w", err)
	}
	defer rows.Close()

	var list []model.Transaction
	for rows.Next() {
		var t model.Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Category, &t.Title, &t.AmountUSD, &t.AmountDiamonds,
			&t.AmountSpins, &t.AmountTickets, &t.Status, &t.ReferenceID, &t.TxHash,
			&t.Description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (r *TransactionRepository) UpdateStatus(ctx context.Context, referenceID string, status string, txHash string) error {
	query := `
		UPDATE transactions
		SET status = $1,
		    tx_hash = CASE WHEN $2 != '' THEN $2 ELSE tx_hash END
		WHERE reference_id = $3
	`
	_, err := r.pool.Exec(ctx, query, status, txHash, referenceID)
	return err
}

