package service

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"earnminiapp/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsService struct {
	pool  *pgxpool.Pool
	redis *db.RedisService
}

func NewAnalyticsService(pool *pgxpool.Pool, redis *db.RedisService) *AnalyticsService {
	return &AnalyticsService{
		pool:  pool,
		redis: redis,
	}
}

type TrafficDataPoint struct {
	Time     string `json:"time"`
	Timestamp int64  `json:"timestamp"`
	Requests int64  `json:"requests"`
}

type TrafficAnalyticsResponse struct {
	LiveRPS            int64              `json:"liveRps"`
	LiveRPM            int64              `json:"liveRpm"`
	HourRequests       int64              `json:"hourRequests"`
	TodayRequests      int64              `json:"todayRequests"`
	MonthRequests      int64              `json:"monthRequests"`
	DailyActiveUsers   int64              `json:"dailyActiveUsers"`
	MonthlyActiveUsers int64              `json:"monthlyActiveUsers"`
	PeakRPS            int64              `json:"peakRps"`
	GraphData          []TrafficDataPoint `json:"graphData"`
	TotalUsers         int64              `json:"totalUsers"`
	TotalDepositsUSD   float64            `json:"totalDepositsUsd"`
	TotalPayoutsUSD    float64            `json:"totalPayoutsUsd"`
	TotalPlatformFee   float64            `json:"totalPlatformFeeUsd"`
}

func (s *AnalyticsService) GetTrafficAnalytics(ctx context.Context, rangeStr string) (*TrafficAnalyticsResponse, error) {
	now := time.Now().UTC()
	todayStr := now.Format("2006-01-02")
	monthStr := now.Format("2006-01")
	hourStr := now.Format("2006-01-02-15")

	// 1. Calculate Live RPS (average over last 3 seconds)
	var liveRPS int64 = 0
	var peakRPS int64 = 0
	if s.redis != nil && s.redis.IsConnected() {
		for i := 0; i < 5; i++ {
			secKey := fmt.Sprintf("traffic:sec:%d", now.Unix()-int64(i))
			valStr, _ := s.redis.Get(ctx, secKey)
			if valStr != "" {
				if rps, err := strconv.ParseInt(valStr, 10, 64); err == nil {
					if i < 3 {
						liveRPS += rps
					}
					if rps > peakRPS {
						peakRPS = rps
					}
				}
			}
		}
		liveRPS = liveRPS / 3
	}

	// 2. Calculate Live RPM (sum over current minute)
	var liveRPM int64 = 0
	if s.redis != nil && s.redis.IsConnected() {
		minKey := fmt.Sprintf("traffic:min:%d", now.Unix()/60)
		valStr, _ := s.redis.Get(ctx, minKey)
		if valStr != "" {
			liveRPM, _ = strconv.ParseInt(valStr, 10, 64)
		}
	}

	// 2b. Current Hour Requests
	var hourRequests int64 = 0
	if s.redis != nil && s.redis.IsConnected() {
		hourKey := fmt.Sprintf("traffic:hour:%s", hourStr)
		valStr, _ := s.redis.Get(ctx, hourKey)
		if valStr != "" {
			hourRequests, _ = strconv.ParseInt(valStr, 10, 64)
		}
	}

	// 3. Today's total requests & DAU
	var todayRequests int64 = 0
	var dau int64 = 0
	if s.redis != nil && s.redis.IsConnected() {
		dayKey := fmt.Sprintf("traffic:day:%s", todayStr)
		valStr, _ := s.redis.Get(ctx, dayKey)
		if valStr != "" {
			todayRequests, _ = strconv.ParseInt(valStr, 10, 64)
		}

		dauKey := fmt.Sprintf("traffic:dau:%s", todayStr)
		dau, _ = s.redis.PFCount(ctx, dauKey)
	}

	// 3b. Month's total requests & MAU
	var monthRequests int64 = 0
	var mau int64 = 0
	if s.redis != nil && s.redis.IsConnected() {
		monthKey := fmt.Sprintf("traffic:month:%s", monthStr)
		valStr, _ := s.redis.Get(ctx, monthKey)
		if valStr != "" {
			monthRequests, _ = strconv.ParseInt(valStr, 10, 64)
		}

		mauKey := fmt.Sprintf("traffic:mau:%s", monthStr)
		mau, _ = s.redis.PFCount(ctx, mauKey)
	}

	// 4. Generate 24-hour hourly graph data points
	var graphData []TrafficDataPoint
	for i := 23; i >= 0; i-- {
		t := now.Add(-time.Duration(i) * time.Hour)
		var hReqs int64 = 0

		if s.redis != nil && s.redis.IsConnected() {
			// First try direct hourly counter
			hKey := fmt.Sprintf("traffic:hour:%s", t.Format("2006-01-02-15"))
			valStr, _ := s.redis.Get(ctx, hKey)
			if valStr != "" {
				hReqs, _ = strconv.ParseInt(valStr, 10, 64)
			} else {
				// Fallback to sampling minute keys in that hour
				hourMinStart := t.Unix() / 60
				for m := int64(0); m < 60; m += 5 {
					minKey := fmt.Sprintf("traffic:min:%d", hourMinStart+m)
					valStr, _ := s.redis.Get(ctx, minKey)
					if valStr != "" {
						if reqs, err := strconv.ParseInt(valStr, 10, 64); err == nil {
							hReqs += reqs * 5
						}
					}
				}
			}
		}

		graphData = append(graphData, TrafficDataPoint{
			Time:      t.Format("15:04"),
			Timestamp: t.Unix(),
			Requests:  hReqs,
		})
	}

	// 5. Query totals from PostgreSQL
	var totalUsers int64 = 0
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(id) FROM users").Scan(&totalUsers)

	var totalDepositsUSD, totalPayoutsUSD float64
	_ = s.pool.QueryRow(ctx, "SELECT COALESCE(SUM(amount_usd), 0) FROM invoices WHERE status = 'paid'").Scan(&totalDepositsUSD)
	_ = s.pool.QueryRow(ctx, "SELECT COALESCE(SUM(net_payout_usd), 0) FROM withdrawals WHERE status = 'completed'").Scan(&totalPayoutsUSD)

	totalPlatformFee := (totalDepositsUSD * 0.02) + (totalPayoutsUSD * 0.02)

	return &TrafficAnalyticsResponse{
		LiveRPS:            liveRPS,
		LiveRPM:            liveRPM,
		HourRequests:       hourRequests,
		TodayRequests:      todayRequests,
		MonthRequests:      monthRequests,
		DailyActiveUsers:   dau,
		MonthlyActiveUsers: mau,
		PeakRPS:            peakRPS,
		GraphData:          graphData,
		TotalUsers:         totalUsers,
		TotalDepositsUSD:   totalDepositsUSD,
		TotalPayoutsUSD:    totalPayoutsUSD,
		TotalPlatformFee:   totalPlatformFee,
	}, nil
}
