package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBRaffle struct {
	ID                 string
	Title              string
	CashReward         float64
	CoinRewardStr      string
	TicketPriceGems    int
	TicketPriceUSD     float64
	TicketPriceStars   int
	TicketGemPrice     int
	EnableUSDPayment   bool
	EnableStarsPayment bool
	EnableGemsPayment  bool
	MaxTicketsPerUser  int
	TotalTicketsSold   int
	ParticipantsCount  int
	TotalTicketsCount  int
	Status             string // 'ongoing', 'ended'
	StartsAt           time.Time
	EndsAt             time.Time
	PrizeTiers         []byte
	WinnersJSON        []byte
}

type TicketHolder struct {
	UserID      int64
	TelegramID  int64
	FirstName   string
	Username    string
	TicketCount int
}

type RaffleRepository struct {
	pool *pgxpool.Pool
}

func NewRaffleRepository(pool *pgxpool.Pool) *RaffleRepository {
	return &RaffleRepository{pool: pool}
}

func (r *RaffleRepository) GetRaffles(ctx context.Context) ([]DBRaffle, error) {
	query := `
		SELECT id, title, cash_reward, coin_reward_str, ticket_price_gems,
		       COALESCE(ticket_price_usd, 0.50), COALESCE(ticket_price_stars, 25),
		       COALESCE(ticket_gem_price, ticket_price_gems, 200),
		       COALESCE(enable_usd_payment, true), COALESCE(enable_stars_payment, true),
		       COALESCE(enable_gems_payment, true), COALESCE(max_tickets_per_user, 50),
		       COALESCE(total_tickets_sold, total_tickets_count, 0),
		       participants_count, total_tickets_count,
		       CASE WHEN ends_at <= NOW() THEN 'ended' ELSE status END as status,
		       starts_at, ends_at,
		       COALESCE(prize_tiers, '[]'::jsonb), COALESCE(winners_json, '[]'::jsonb)
		FROM raffles
		ORDER BY status DESC, ends_at ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []DBRaffle
	for rows.Next() {
		var raf DBRaffle
		if err := rows.Scan(
			&raf.ID, &raf.Title, &raf.CashReward, &raf.CoinRewardStr,
			&raf.TicketPriceGems, &raf.TicketPriceUSD, &raf.TicketPriceStars,
			&raf.TicketGemPrice, &raf.EnableUSDPayment, &raf.EnableStarsPayment,
			&raf.EnableGemsPayment, &raf.MaxTicketsPerUser, &raf.TotalTicketsSold,
			&raf.ParticipantsCount, &raf.TotalTicketsCount,
			&raf.Status, &raf.StartsAt, &raf.EndsAt,
			&raf.PrizeTiers, &raf.WinnersJSON,
		); err != nil {
			return nil, err
		}
		list = append(list, raf)
	}
	return list, nil
}

func (r *RaffleRepository) GetRaffleByID(ctx context.Context, id string) (*DBRaffle, error) {
	cleanID := strings.TrimPrefix(strings.TrimSpace(id), "#")
	query := `
		SELECT id, title, cash_reward, coin_reward_str, ticket_price_gems,
		       COALESCE(ticket_price_usd, 0.50), COALESCE(ticket_price_stars, 25),
		       COALESCE(ticket_gem_price, ticket_price_gems, 200),
		       COALESCE(enable_usd_payment, true), COALESCE(enable_stars_payment, true),
		       COALESCE(enable_gems_payment, true), COALESCE(max_tickets_per_user, 50),
		       COALESCE(total_tickets_sold, total_tickets_count, 0),
		       participants_count, total_tickets_count,
		       CASE WHEN ends_at <= NOW() THEN 'ended' ELSE status END as status,
		       starts_at, ends_at,
		       COALESCE(prize_tiers, '[]'::jsonb), COALESCE(winners_json, '[]'::jsonb)
		FROM raffles
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
		LIMIT 1
	`
	var raf DBRaffle
	err := r.pool.QueryRow(ctx, query, id, cleanID).Scan(
		&raf.ID, &raf.Title, &raf.CashReward, &raf.CoinRewardStr,
		&raf.TicketPriceGems, &raf.TicketPriceUSD, &raf.TicketPriceStars,
		&raf.TicketGemPrice, &raf.EnableUSDPayment, &raf.EnableStarsPayment,
		&raf.EnableGemsPayment, &raf.MaxTicketsPerUser, &raf.TotalTicketsSold,
		&raf.ParticipantsCount, &raf.TotalTicketsCount,
		&raf.Status, &raf.StartsAt, &raf.EndsAt,
		&raf.PrizeTiers, &raf.WinnersJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &raf, nil
}

func (r *RaffleRepository) GetUserTicketsCount(ctx context.Context, raffleID string, userID int64) (int, error) {
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	query := `
		SELECT COALESCE(SUM(ticket_count), 0)
		FROM raffle_tickets
		WHERE (raffle_id = $1 OR raffle_id = ('#' || $1) OR raffle_id = $2 OR raffle_id = ('#' || $2)) AND user_id = $3
	`
	var count int
	err := r.pool.QueryRow(ctx, query, raffleID, cleanID, userID).Scan(&count)
	return count, err
}

func (r *RaffleRepository) AddTickets(ctx context.Context, raffleID string, userID int64, count int, source string) error {
	return r.AddTicketsWithDetails(ctx, raffleID, userID, count, source, source, "")
}

func (r *RaffleRepository) AddTicketsWithDetails(ctx context.Context, raffleID string, userID int64, count int, source, paymentMethod, paymentRef string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Resolve exact primary key id in raffles table (handling '#' prefix variations)
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	var exactRaffleID string
	err = tx.QueryRow(ctx, "SELECT id FROM raffles WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2) LIMIT 1", raffleID, cleanID).Scan(&exactRaffleID)
	if err != nil {
		exactRaffleID = raffleID
	}

	// Check if this user had tickets before
	var existing int
	_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM raffle_tickets WHERE (raffle_id = $1 OR raffle_id = $2) AND user_id = $3", exactRaffleID, cleanID, userID).Scan(&existing)

	// Insert ticket record with verified exact raffle id
	_, err = tx.Exec(ctx, `
		INSERT INTO raffle_tickets (raffle_id, user_id, ticket_count, source, payment_method, payment_ref, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, exactRaffleID, userID, count, source, paymentMethod, paymentRef)
	if err != nil {
		return err
	}

	// Increment raffle stats
	incParticipants := 0
	if existing == 0 {
		incParticipants = 1
	}

	_, err = tx.Exec(ctx, `
		UPDATE raffles
		SET total_tickets_count = total_tickets_count + $1,
		    total_tickets_sold = COALESCE(total_tickets_sold, 0) + $1,
		    participants_count = participants_count + $2
		WHERE id = $3
	`, count, incParticipants, exactRaffleID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetUserTicketHolders groups all participants and their total ticket weights for fair drawing
func (r *RaffleRepository) GetUserTicketHolders(ctx context.Context, raffleID string) ([]TicketHolder, error) {
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	query := `
		SELECT rt.user_id, COALESCE(u.telegram_id, 0), COALESCE(u.first_name, 'Player'), COALESCE(u.username, ''), SUM(rt.ticket_count)::INT as total_tickets
		FROM raffle_tickets rt
		JOIN users u ON u.id = rt.user_id
		WHERE rt.raffle_id = $1 OR rt.raffle_id = ('#' || $1) OR rt.raffle_id = $2 OR rt.raffle_id = ('#' || $2)
		GROUP BY rt.user_id, u.telegram_id, u.first_name, u.username
		HAVING SUM(rt.ticket_count) > 0
		ORDER BY total_tickets DESC
	`
	rows, err := r.pool.Query(ctx, query, raffleID, cleanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holders []TicketHolder
	for rows.Next() {
		var h TicketHolder
		if err := rows.Scan(&h.UserID, &h.TelegramID, &h.FirstName, &h.Username, &h.TicketCount); err == nil {
			holders = append(holders, h)
		}
	}
	return holders, nil
}

// SaveWinnersAndEndRaffle marks raffle ended and stores official winners array
func (r *RaffleRepository) SaveWinnersAndEndRaffle(ctx context.Context, raffleID string, winnersJSON []byte) error {
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	query := `
		UPDATE raffles
		SET status = 'ended',
		    winners_json = $1
		WHERE id = $2 OR id = ('#' || $2) OR id = $3 OR id = ('#' || $3)
	`
	_, err := r.pool.Exec(ctx, query, winnersJSON, raffleID, cleanID)
	return err
}

// DeleteRaffle removes a raffle and its associated tickets
func (r *RaffleRepository) DeleteRaffle(ctx context.Context, raffleID string) error {
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete tickets for this raffle
	_, err = tx.Exec(ctx, `
		DELETE FROM raffle_tickets
		WHERE raffle_id = $1 OR raffle_id = ('#' || $1) OR raffle_id = $2 OR raffle_id = ('#' || $2)
	`, raffleID, cleanID)
	if err != nil {
		return err
	}

	// Delete raffle record
	_, err = tx.Exec(ctx, `
		DELETE FROM raffles
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
	`, raffleID, cleanID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// EndRaffle marks an ongoing raffle as ended
func (r *RaffleRepository) EndRaffle(ctx context.Context, raffleID string) error {
	cleanID := strings.TrimPrefix(strings.TrimSpace(raffleID), "#")
	query := `
		UPDATE raffles
		SET status = 'ended'
		WHERE id = $1 OR id = ('#' || $1) OR id = $2 OR id = ('#' || $2)
	`
	_, err := r.pool.Exec(ctx, query, raffleID, cleanID)
	return err
}
