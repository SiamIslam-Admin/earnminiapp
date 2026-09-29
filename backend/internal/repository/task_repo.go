package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/pkg/util"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBTask struct {
	ID                  string
	TaskID              string
	Category            string
	Title               string
	Icon                string
	IconURL             string
	IsIconImage         bool
	RewardGems          int
	RewardSpins         int
	SecondaryRewardGems int
	TargetCount         int
	TaskType            string
	ActionURL           string
	ChannelID           string
	IsActive            bool
	CreatedAt           time.Time
}

type DBUserTask struct {
	ID        int64
	UserID    int64
	TaskID    string
	Progress  int
	Status    string // 'pending', 'verifying', 'completed'
	StartedAt *time.Time
	ClaimedAt *time.Time
}

type TaskRepository struct {
	pool *pgxpool.Pool
}

func NewTaskRepository(pool *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{pool: pool}
}

func (r *TaskRepository) GetAllActiveTasks(ctx context.Context) ([]DBTask, error) {
	query := `
		SELECT id, category, title, COALESCE(icon, ''), COALESCE(icon_url, ''),
		       is_icon_image, reward_gems, COALESCE(reward_spins, 0), secondary_reward_gems,
		       target_count, task_type, COALESCE(action_url, ''), COALESCE(channel_id, ''), is_active, created_at
		FROM tasks
		WHERE is_active = true
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []DBTask
	for rows.Next() {
		var t DBTask
		if err := rows.Scan(
			&t.ID, &t.Category, &t.Title, &t.Icon, &t.IconURL,
			&t.IsIconImage, &t.RewardGems, &t.RewardSpins, &t.SecondaryRewardGems,
			&t.TargetCount, &t.TaskType, &t.ActionURL, &t.ChannelID, &t.IsActive, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.TaskID = t.ID
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (r *TaskRepository) GetByID(ctx context.Context, taskID string) (*DBTask, error) {
	query := `
		SELECT id, category, title, COALESCE(icon, ''), COALESCE(icon_url, ''),
		       is_icon_image, reward_gems, COALESCE(reward_spins, 0), secondary_reward_gems,
		       target_count, task_type, COALESCE(action_url, ''), COALESCE(channel_id, ''), is_active, created_at
		FROM tasks
		WHERE id = $1 AND is_active = true
		LIMIT 1
	`
	var t DBTask
	err := r.pool.QueryRow(ctx, query, taskID).Scan(
		&t.ID, &t.Category, &t.Title, &t.Icon, &t.IconURL,
		&t.IsIconImage, &t.RewardGems, &t.RewardSpins, &t.SecondaryRewardGems,
		&t.TargetCount, &t.TaskType, &t.ActionURL, &t.ChannelID, &t.IsActive, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.TaskID = t.ID
	return &t, nil
}

func (r *TaskRepository) GetUserTasksMap(ctx context.Context, userID int64) (map[string]DBUserTask, error) {
	query := `
		SELECT id, user_id, task_id, progress, status, started_at, claimed_at
		FROM user_tasks
		WHERE user_id = $1
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]DBUserTask)
	for rows.Next() {
		var ut DBUserTask
		if err := rows.Scan(&ut.ID, &ut.UserID, &ut.TaskID, &ut.Progress, &ut.Status, &ut.StartedAt, &ut.ClaimedAt); err != nil {
			return nil, err
		}
		res[ut.TaskID] = ut
	}
	return res, nil
}

func (r *TaskRepository) GetUserTask(ctx context.Context, userID int64, taskID string) (*DBUserTask, error) {
	query := `
		SELECT id, user_id, task_id, progress, status, started_at, claimed_at
		FROM user_tasks
		WHERE user_id = $1 AND task_id = $2
		LIMIT 1
	`
	var ut DBUserTask
	err := r.pool.QueryRow(ctx, query, userID, taskID).Scan(
		&ut.ID, &ut.UserID, &ut.TaskID, &ut.Progress, &ut.Status, &ut.StartedAt, &ut.ClaimedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &ut, nil
}

func (r *TaskRepository) StartTask(ctx context.Context, userID int64, taskID string) error {
	query := `
		INSERT INTO user_tasks (user_id, task_id, progress, status, started_at, created_at)
		VALUES ($1, $2, 0, 'verifying', NOW(), NOW())
		ON CONFLICT (user_id, task_id) DO UPDATE SET
			status = CASE WHEN user_tasks.status = 'completed' THEN 'completed' ELSE 'verifying' END,
			started_at = CASE WHEN user_tasks.status = 'completed' THEN user_tasks.started_at ELSE NOW() END
	`
	_, err := r.pool.Exec(ctx, query, userID, taskID)
	return err
}

func (r *TaskRepository) UpsertProgress(ctx context.Context, userID int64, taskID string, progress int, status string) error {
	query := `
		INSERT INTO user_tasks (user_id, task_id, progress, status, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (user_id, task_id) DO UPDATE SET
			progress = GREATEST(user_tasks.progress, EXCLUDED.progress),
			status = CASE WHEN user_tasks.status = 'completed' THEN 'completed' ELSE EXCLUDED.status END
	`
	_, err := r.pool.Exec(ctx, query, userID, taskID, progress, status)
	return err
}

func (r *TaskRepository) IncrementSpinProgress(ctx context.Context, userID int64) error {
	query := `
		INSERT INTO user_tasks (user_id, task_id, progress, status, created_at)
		SELECT $1, id, 1, 'pending', NOW()
		FROM tasks
		WHERE is_active = true AND task_type = 'spin_count'
		ON CONFLICT (user_id, task_id) DO UPDATE SET
			progress = user_tasks.progress + 1
	`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}

// ClaimTaskAtomic securely and atomically checks state, marks claimed, updates user balance, and inserts audit ledger in 1 ACID transaction
func (r *TaskRepository) ClaimTaskAtomic(
	ctx context.Context,
	userID int64,
	taskID string,
	isDaily bool,
	rewardSpins int,
	rewardGems int64,
	taskTitle string,
	rewardDesc string,
) (*model.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Transaction-level advisory lock on (userID, taskID) to serialize concurrent claims
	lockKey := fmt.Sprintf("%d-%s", userID, taskID)
	_, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", lockKey)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire claim lock: %w", err)
	}

	// 2. Lock and check existing user_task row
	var existingStatus string
	var claimedAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT status, claimed_at
		FROM user_tasks
		WHERE user_id = $1 AND task_id = $2
		FOR UPDATE
	`, userID, taskID).Scan(&existingStatus, &claimedAt)

	nowUTC := time.Now().UTC()
	todayStartUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)

	if err == nil {
		if existingStatus == "completed" {
			if isDaily && claimedAt != nil && claimedAt.UTC().Before(todayStartUTC) {
				// Daily task from previous day -> allowed to claim today
			} else {
				return nil, errors.New("you have already claimed this task reward")
			}
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// 2. Mark claimed in user_tasks
	_, err = tx.Exec(ctx, `
		INSERT INTO user_tasks (user_id, task_id, progress, status, claimed_at, created_at)
		VALUES ($1, $2, 9999, 'completed', NOW(), NOW())
		ON CONFLICT (user_id, task_id) DO UPDATE SET
			status = 'completed',
			claimed_at = NOW()
	`, userID, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to record task claim: %w", err)
	}

	// 3. Atomically update user balance
	var user model.User
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET
			spins = spins + $2,
			diamonds = diamonds + $3,
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`, userID, rewardSpins, rewardGems).Scan(
		&user.ID, &user.TelegramID, &user.Username, &user.FirstName, &user.PhotoURL, &user.LanguageCode,
		&user.IsPremium, &user.Level, &user.Energy, &user.MaxEnergy, &user.Spins,
		&user.Diamonds, &user.BalanceUSD, &user.ReferrerID, &user.TONWallet, &user.IsBanned,
		&user.HasClaimedChannelReward,
		&user.LastEnergyRefill, &user.LastActiveAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to mutate user balances: %w", err)
	}

	// 4. Log transaction in ledger
	txID := util.GenerateTXID("TASK")
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (user_id, category, title, amount_diamonds, amount_spins, status, reference_id, description, created_at)
		VALUES ($1, 'tasks', $2, $3, $4, 'completed', $5, $6, NOW())
	`, userID, fmt.Sprintf("Task Reward (%s)", taskTitle), rewardGems, rewardSpins, txID, rewardDesc)
	if err != nil {
		return nil, fmt.Errorf("failed to create ledger entry: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &user, nil
}
