package repository

import (
	"context"
	"errors"

	"earnminiapp/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvoiceRepository struct {
	pool *pgxpool.Pool
}

func NewInvoiceRepository(pool *pgxpool.Pool) *InvoiceRepository {
	return &InvoiceRepository{pool: pool}
}

func (r *InvoiceRepository) Create(ctx context.Context, inv *model.Invoice) error {
	query := `
		INSERT INTO invoices (invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, reference_id, status, sweep_status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unclaimed', $9, NOW())
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		inv.InvoiceID, inv.UserID, inv.WalletIndex, inv.DepositAddress, inv.AmountUSD, inv.Purpose, inv.ReferenceID, inv.Status, inv.ExpiresAt,
	).Scan(&inv.ID, &inv.CreatedAt)
}

func (r *InvoiceRepository) GetNextWalletIndex(ctx context.Context) (int64, error) {
	query := `SELECT COALESCE(MAX(wallet_index), 0) + 1 FROM invoices`
	var nextIdx int64
	err := r.pool.QueryRow(ctx, query).Scan(&nextIdx)
	return nextIdx, err
}

func (r *InvoiceRepository) GetByInvoiceID(ctx context.Context, invoiceID string) (*model.Invoice, error) {
	query := `
		SELECT id, invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, reference_id, status, sweep_status, tx_hash, sweep_tx_hash, expires_at, created_at, paid_at
		FROM invoices
		WHERE invoice_id = $1
	`
	var inv model.Invoice
	err := r.pool.QueryRow(ctx, query, invoiceID).Scan(
		&inv.ID, &inv.InvoiceID, &inv.UserID, &inv.WalletIndex, &inv.DepositAddress,
		&inv.AmountUSD, &inv.Purpose, &inv.ReferenceID, &inv.Status, &inv.SweepStatus,
		&inv.TxHash, &inv.SweepTxHash, &inv.ExpiresAt, &inv.CreatedAt, &inv.PaidAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InvoiceRepository) GetByDepositAddress(ctx context.Context, address string) (*model.Invoice, error) {
	query := `
		SELECT id, invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, reference_id, status, sweep_status, tx_hash, sweep_tx_hash, expires_at, created_at, paid_at
		FROM invoices
		WHERE LOWER(deposit_address) = LOWER($1) AND status = 'pending'
		ORDER BY id DESC
		LIMIT 1
	`
	var inv model.Invoice
	err := r.pool.QueryRow(ctx, query, address).Scan(
		&inv.ID, &inv.InvoiceID, &inv.UserID, &inv.WalletIndex, &inv.DepositAddress,
		&inv.AmountUSD, &inv.Purpose, &inv.ReferenceID, &inv.Status, &inv.SweepStatus,
		&inv.TxHash, &inv.SweepTxHash, &inv.ExpiresAt, &inv.CreatedAt, &inv.PaidAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InvoiceRepository) GetPendingInvoices(ctx context.Context, limit int) ([]model.Invoice, error) {
	query := `
		SELECT id, invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, reference_id, status, sweep_status, tx_hash, sweep_tx_hash, expires_at, created_at, paid_at
		FROM invoices
		WHERE status = 'pending' AND expires_at > NOW()
		ORDER BY id ASC
		LIMIT $1
	`
	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Invoice
	for rows.Next() {
		var inv model.Invoice
		if err := rows.Scan(
			&inv.ID, &inv.InvoiceID, &inv.UserID, &inv.WalletIndex, &inv.DepositAddress,
			&inv.AmountUSD, &inv.Purpose, &inv.ReferenceID, &inv.Status, &inv.SweepStatus,
			&inv.TxHash, &inv.SweepTxHash, &inv.ExpiresAt, &inv.CreatedAt, &inv.PaidAt,
		); err == nil {
			list = append(list, inv)
		}
	}
	return list, nil
}

func (r *InvoiceRepository) GetUnsweptPaidInvoices(ctx context.Context, limit int) ([]model.Invoice, error) {
	query := `
		SELECT id, invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, reference_id, status, sweep_status, tx_hash, sweep_tx_hash, expires_at, created_at, paid_at
		FROM invoices
		WHERE status = 'paid' AND sweep_status != 'swept'
		ORDER BY id ASC
		LIMIT $1
	`
	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Invoice
	for rows.Next() {
		var inv model.Invoice
		if err := rows.Scan(
			&inv.ID, &inv.InvoiceID, &inv.UserID, &inv.WalletIndex, &inv.DepositAddress,
			&inv.AmountUSD, &inv.Purpose, &inv.ReferenceID, &inv.Status, &inv.SweepStatus,
			&inv.TxHash, &inv.SweepTxHash, &inv.ExpiresAt, &inv.CreatedAt, &inv.PaidAt,
		); err == nil {
			list = append(list, inv)
		}
	}
	return list, nil
}

func (r *InvoiceRepository) MarkPaid(ctx context.Context, invoiceID, txHash string) error {
	query := `
		UPDATE invoices
		SET status = 'paid', tx_hash = $2, paid_at = NOW()
		WHERE invoice_id = $1 AND status = 'pending'
	`
	_, err := r.pool.Exec(ctx, query, invoiceID, txHash)
	return err
}

func (r *InvoiceRepository) UpdateSweepStatus(ctx context.Context, invoiceID, sweepStatus, sweepTxHash string) error {
	query := `
		UPDATE invoices
		SET sweep_status = $2, sweep_tx_hash = $3
		WHERE invoice_id = $1
	`
	_, err := r.pool.Exec(ctx, query, invoiceID, sweepStatus, sweepTxHash)
	return err
}

func (r *InvoiceRepository) ExpireOldInvoices(ctx context.Context) (int64, error) {
	query := `
		UPDATE invoices
		SET status = 'expired'
		WHERE status = 'pending' AND expires_at <= NOW()
	`
	tag, err := r.pool.Exec(ctx, query)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
