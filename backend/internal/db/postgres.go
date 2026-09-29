package db

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"time"

	"earnminiapp/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

type PostgresDB struct {
	Pool *pgxpool.Pool
}

func NewPostgresDB(cfg *config.Config) (*PostgresDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}

	// 2 vCPU optimization: tuned pool size
	poolConfig.MaxConns = cfg.DBMaxConns
	poolConfig.MinConns = cfg.DBMinConns
	poolConfig.MaxConnLifetime = cfg.DBMaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.DBMaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	log.Printf("[INFO] PostgreSQL connection pool initialized (MaxConns: %d, MinConns: %d)", cfg.DBMaxConns, cfg.DBMinConns)

	dbInstance := &PostgresDB{Pool: pool}

	// Auto-run schema migrations
	if err := dbInstance.AutoMigrate(context.Background()); err != nil {
		log.Printf("[WARN] Error executing auto-migration: %v", err)
	}

	return dbInstance, nil
}

func (db *PostgresDB) AutoMigrate(ctx context.Context) error {
	if schemaSQL == "" {
		return nil
	}

	_, err := db.Pool.Exec(ctx, schemaSQL)
	if err != nil {
		return fmt.Errorf("failed to execute schema migration: %w", err)
	}

	log.Println("[INFO] PostgreSQL schema tables and initial seed executed successfully")
	return nil
}

func (db *PostgresDB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
		log.Println("[INFO] PostgreSQL connection pool closed")
	}
}
