package db

import (
	"context"
	"log"
	"sync"
	"time"

	"earnminiapp/internal/config"
	"github.com/redis/go-redis/v9"
)

type RedisService struct {
	Client     *redis.Client
	isFallback bool
	memStore   sync.Map
}

func NewRedisService(cfg *config.Config) *RedisService {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Printf("[WARN] Failed to parse Redis URL (%s): %v. Using in-memory fallback.", cfg.RedisURL, err)
		return &RedisService{isFallback: true}
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[WARN] Redis ping failed (%v). Running with high-performance in-memory fallback cache.", err)
		return &RedisService{isFallback: true, Client: client}
	}

	log.Printf("[INFO] Connected to Redis successfully at %s", opts.Addr)
	return &RedisService{Client: client, isFallback: false}
}

func (r *RedisService) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	if r.isFallback || r.Client == nil {
		r.memStore.Store(key, value)
		return nil
	}
	return r.Client.Set(ctx, key, value, expiration).Err()
}

func (r *RedisService) Get(ctx context.Context, key string) (string, error) {
	if r.isFallback || r.Client == nil {
		val, ok := r.memStore.Load(key)
		if !ok {
			return "", redis.Nil
		}
		strVal, ok := val.(string)
		if !ok {
			return "", nil
		}
		return strVal, nil
	}
	return r.Client.Get(ctx, key).Result()
}

func (r *RedisService) Del(ctx context.Context, keys ...string) error {
	if r.isFallback || r.Client == nil {
		for _, k := range keys {
			r.memStore.Delete(k)
		}
		return nil
	}
	return r.Client.Del(ctx, keys...).Err()
}

// ZAdd adds a member with a specific score to a sorted set
func (r *RedisService) ZAdd(ctx context.Context, key string, score float64, member string) error {
	if r.isFallback || r.Client == nil {
		r.memStore.Store(key+":"+member, score)
		return nil
	}
	return r.Client.ZAdd(ctx, key, redis.Z{Score: score, Member: member}).Err()
}

// ZIncrBy for Tournament Leaderboard
func (r *RedisService) ZIncrBy(ctx context.Context, key string, increment float64, member string) (float64, error) {
	if r.isFallback || r.Client == nil {
		// In-memory fallback
		val, _ := r.memStore.LoadOrStore(key+":"+member, float64(0))
		newScore := val.(float64) + increment
		r.memStore.Store(key+":"+member, newScore)
		return newScore, nil
	}
	return r.Client.ZIncrBy(ctx, key, increment, member).Result()
}

// ZRevRangeWithScores for Leaderboard Top Users
func (r *RedisService) ZRevRangeWithScores(ctx context.Context, key string, start, stop int64) ([]redis.Z, error) {
	if r.isFallback || r.Client == nil {
		return []redis.Z{}, nil
	}
	return r.Client.ZRevRangeWithScores(ctx, key, start, stop).Result()
}

// ZRevRank for user's own rank
func (r *RedisService) ZRevRank(ctx context.Context, key string, member string) (int64, error) {
	if r.isFallback || r.Client == nil {
		return 0, nil
	}
	return r.Client.ZRevRank(ctx, key, member).Result()
}

// ZScore for user's own score
func (r *RedisService) ZScore(ctx context.Context, key string, member string) (float64, error) {
	if r.isFallback || r.Client == nil {
		val, ok := r.memStore.Load(key + ":" + member)
		if !ok {
			return 0, redis.Nil
		}
		return val.(float64), nil
	}
	return r.Client.ZScore(ctx, key, member).Result()
}

func (r *RedisService) IsConnected() bool {
	return !r.isFallback && r.Client != nil
}

func (r *RedisService) Incr(ctx context.Context, key string) (int64, error) {
	if r.isFallback || r.Client == nil {
		val, _ := r.memStore.LoadOrStore(key, int64(0))
		newVal := val.(int64) + 1
		r.memStore.Store(key, newVal)
		return newVal, nil
	}
	return r.Client.Incr(ctx, key).Result()
}

func (r *RedisService) Expire(ctx context.Context, key string, expiration time.Duration) error {
	if r.isFallback || r.Client == nil {
		return nil
	}
	return r.Client.Expire(ctx, key, expiration).Err()
}

func (r *RedisService) PFAdd(ctx context.Context, key string, els ...interface{}) (int64, error) {
	if r.isFallback || r.Client == nil {
		return 1, nil
	}
	return r.Client.PFAdd(ctx, key, els...).Result()
}

func (r *RedisService) PFCount(ctx context.Context, keys ...string) (int64, error) {
	if r.isFallback || r.Client == nil {
		return 1, nil
	}
	return r.Client.PFCount(ctx, keys...).Result()
}

func (r *RedisService) Close() {
	if r.Client != nil {
		_ = r.Client.Close()
	}
}
