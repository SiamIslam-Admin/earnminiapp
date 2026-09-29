package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"earnminiapp/internal/db"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
)

type ContestService struct {
	userRepo     *repository.UserRepository
	contestRepo  *repository.ContestRepository
	txRepo       *repository.TransactionRepository
	settingsRepo *repository.SystemSettingsRepository
	redis        *db.RedisService
}

func NewContestService(
	userRepo *repository.UserRepository,
	contestRepo *repository.ContestRepository,
	txRepo *repository.TransactionRepository,
	redis *db.RedisService,
	settingsRepo *repository.SystemSettingsRepository,
) *ContestService {
	return &ContestService{
		userRepo:     userRepo,
		contestRepo:  contestRepo,
		txRepo:       txRepo,
		settingsRepo: settingsRepo,
		redis:        redis,
	}
}

func (s *ContestService) isMockSeedsEnabled(ctx context.Context) bool {
	if s.settingsRepo != nil {
		if val, err := s.settingsRepo.Get(ctx, "enable_mock_seeds"); err == nil && val != "" {
			return strings.ToLower(val) == "true" || val == "1"
		}
	}
	return false
}

// Fallback default prize ladders if database has no custom contest configured
var defaultSpinPrizes = []model.ContestPrizeTier{
	{Rank: 1, Prize: "$200.00", AmountUSD: 200.00},
	{Rank: 2, Prize: "$100.00", AmountUSD: 100.00},
	{Rank: 3, Prize: "$50.00", AmountUSD: 50.00},
	{Rank: 4, Prize: "$25.00", AmountUSD: 25.00},
	{Rank: 5, Prize: "$25.00", AmountUSD: 25.00},
	{Rank: 6, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 7, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 8, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 9, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 10, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 11, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 12, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 13, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 14, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 15, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 16, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 17, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 18, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 19, Prize: "$5.00", AmountUSD: 5.00},
	{Rank: 20, Prize: "$5.00", AmountUSD: 5.00},
}

var defaultReferralPrizes = []model.ContestPrizeTier{
	{Rank: 1, Prize: "$400.00", AmountUSD: 400.00},
	{Rank: 2, Prize: "$200.00", AmountUSD: 200.00},
	{Rank: 3, Prize: "$100.00", AmountUSD: 100.00},
	{Rank: 4, Prize: "$50.00", AmountUSD: 50.00},
	{Rank: 5, Prize: "$50.00", AmountUSD: 50.00},
	{Rank: 6, Prize: "$20.00", AmountUSD: 20.00},
	{Rank: 7, Prize: "$20.00", AmountUSD: 20.00},
	{Rank: 8, Prize: "$20.00", AmountUSD: 20.00},
	{Rank: 9, Prize: "$20.00", AmountUSD: 20.00},
	{Rank: 10, Prize: "$20.00", AmountUSD: 20.00},
	{Rank: 11, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 12, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 13, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 14, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 15, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 16, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 17, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 18, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 19, Prize: "$10.00", AmountUSD: 10.00},
	{Rank: 20, Prize: "$10.00", AmountUSD: 10.00},
}

func (s *ContestService) GetLeaderboard(ctx context.Context, userID int64) (*model.ContestLeaderboardResponse, error) {
	return s.GetSpinLeaderboard(ctx, userID)
}

// GetSpinLeaderboard loads active spins tournament and merges dynamic prize tiers with live Redis scores
func (s *ContestService) GetSpinLeaderboard(ctx context.Context, userID int64) (*model.ContestLeaderboardResponse, error) {
	var contest *model.Contest
	if s.contestRepo != nil {
		contest, _ = s.contestRepo.GetActiveByType(ctx, "spins")
	}

	title := "Weekly Spin Championship"
	prizePoolStr := "$500.00 USDT"
	contestID := "spin_weekly"
	prizeDistribution := defaultSpinPrizes
	var endsTimestamp int64
	var endsInStr string

	if contest != nil {
		contestID = contest.ContestID
		title = contest.Title
		if contest.PrizePoolStr != "" {
			prizePoolStr = contest.PrizePoolStr
		} else {
			prizePoolStr = fmt.Sprintf("$%.2f USDT", contest.PrizePoolUSD)
		}
		if len(contest.PrizeDistribution) > 0 {
			prizeDistribution = contest.PrizeDistribution
		}
		endsInStr, endsTimestamp = formatDeadline(contest.EndsAt)
	} else {
		endsInStr, endsTimestamp = calculateWeeklyDeadline()
	}

	maxRank := len(prizeDistribution)
	if maxRank == 0 {
		maxRank = 20
	}

	redisKey := fmt.Sprintf("tournament:spins:%s", contestID)
	zList, _ := s.redis.ZRevRangeWithScores(ctx, redisKey, 0, int64(maxRank-1))
	if len(zList) == 0 {
		// Fallback to general weekly key
		zList, _ = s.redis.ZRevRangeWithScores(ctx, "tournament:spins:current_week", 0, int64(maxRank-1))
	}

	var topWinners []model.ContestLeaderboardUser
	var otherRankings []model.ContestLeaderboardUser

	useMock := s.isMockSeedsEnabled(ctx)

	if useMock {
		mockSeeds := []struct {
			name  string
			spins int
		}{
			{"CryptoKing", 284},
			{"Elena_TON", 219},
			{"ViperX", 178},
			{"Satoshi99", 142},
			{"LuckyStrike", 118},
			{"ApexSpinner", 96},
			{"Dmitri_K", 84},
			{"AirdropHunter", 63},
			{"ZenMaster", 51},
			{"MoonWalker", 45},
			{"BladeRunner", 39},
			{"TonWarrior", 35},
			{"GoldRush", 31},
			{"QuantumSpin", 28},
			{"NebulaX", 25},
			{"SolarFlare", 22},
			{"CyberSamurai", 19},
			{"PhantomStrike", 16},
			{"VelocityNode", 14},
			{"EchoPioneer", 11},
		}

		for i := 0; i < maxRank; i++ {
			rank := i + 1
			name := "Player"
			spins := 0
			avatar := ""
			if i < len(mockSeeds) {
				name = mockSeeds[i].name
				spins = mockSeeds[i].spins
			}

			prize := findPrizeForRank(rank, prizeDistribution)

			if i < len(zList) {
				score := int(zList[i].Score)
				if score > spins {
					spins = score
				}
				memberID, _ := strconv.ParseInt(zList[i].Member.(string), 10, 64)
				if s.userRepo != nil {
					if u, err := s.userRepo.GetByID(ctx, memberID); err == nil && u != nil {
						name = u.FirstName
						if name == "" {
							name = u.Username
						}
						avatar = u.PhotoURL
					}
				}
			}

			userItem := model.ContestLeaderboardUser{
				Rank:   rank,
				Name:   name,
				Avatar: avatar,
				Score:  spins,
				Spins:  spins,
				Prize:  prize,
			}

			if rank <= 3 {
				topWinners = append(topWinners, userItem)
			} else {
				otherRankings = append(otherRankings, userItem)
			}
		}
	} else {
		// 100% Real Live Players Mode (No fake mock competitor seeds)
		for i, z := range zList {
			score := int(z.Score)
			if score <= 0 {
				continue
			}
			rank := i + 1
			memberID, _ := strconv.ParseInt(z.Member.(string), 10, 64)
			name := fmt.Sprintf("Spinner #%d", memberID)
			avatar := ""
			if s.userRepo != nil {
				if u, err := s.userRepo.GetByID(ctx, memberID); err == nil && u != nil {
					name = u.FirstName
					if name == "" {
						name = u.Username
					}
					if name == "" {
						name = fmt.Sprintf("Player #%d", u.ID)
					}
					avatar = u.PhotoURL
				}
			}

			prize := findPrizeForRank(rank, prizeDistribution)
			userItem := model.ContestLeaderboardUser{
				Rank:   rank,
				Name:   name,
				Avatar: avatar,
				Score:  score,
				Spins:  score,
				Prize:  prize,
			}

			if rank <= 3 {
				topWinners = append(topWinners, userItem)
			} else {
				otherRankings = append(otherRankings, userItem)
			}
		}
	}

	// User's own live score & rank
	userScore, _ := s.redis.ZScore(ctx, redisKey, fmt.Sprintf("%d", userID))
	userRank, errRank := s.redis.ZRevRank(ctx, redisKey, fmt.Sprintf("%d", userID))
	if userScore == 0 {
		userScore, _ = s.redis.ZScore(ctx, "tournament:spins:current_week", fmt.Sprintf("%d", userID))
		userRank, errRank = s.redis.ZRevRank(ctx, "tournament:spins:current_week", fmt.Sprintf("%d", userID))
	}

	actualRank := 0
	if errRank == nil && userScore > 0 {
		actualRank = int(userRank) + 1
	} else if useMock {
		actualRank = 42
	}

	actualSpins := int(userScore)
	if actualSpins == 0 && useMock {
		actualSpins = 18
	}

	var projectedPrize string
	if actualRank > 0 {
		projectedPrize = findPrizeForRank(actualRank, prizeDistribution)
	} else {
		projectedPrize = "$0.00"
	}

	return &model.ContestLeaderboardResponse{
		ContestID:     contestID,
		Title:         title,
		Category:      "spins",
		PrizePool:     prizePoolStr,
		EndsIn:        endsInStr,
		EndsTimestamp: endsTimestamp,
		TopWinners:    topWinners,
		OtherRankings: otherRankings,
		UserStatus: model.UserTournamentStatus{
			Rank:           actualRank,
			Score:          actualSpins,
			Spins:          actualSpins,
			ProjectedPrize: projectedPrize,
		},
	}, nil
}

// GetReferralLeaderboard loads active referral tournament and merges dynamic prize tiers with live Redis scores
func (s *ContestService) GetReferralLeaderboard(ctx context.Context, userID int64) (*model.ContestLeaderboardResponse, error) {
	var contest *model.Contest
	if s.contestRepo != nil {
		contest, _ = s.contestRepo.GetActiveByType(ctx, "referrals")
	}

	title := "Global Referral Championship"
	prizePoolStr := "$1,000.00 USDT"
	contestID := "referral_monthly"
	prizeDistribution := defaultReferralPrizes
	var endsTimestamp int64
	var endsInStr string

	if contest != nil {
		contestID = contest.ContestID
		title = contest.Title
		if contest.PrizePoolStr != "" {
			prizePoolStr = contest.PrizePoolStr
		} else {
			prizePoolStr = fmt.Sprintf("$%.2f USDT", contest.PrizePoolUSD)
		}
		if len(contest.PrizeDistribution) > 0 {
			prizeDistribution = contest.PrizeDistribution
		}
		endsInStr, endsTimestamp = formatDeadline(contest.EndsAt)
	} else {
		endsInStr, endsTimestamp = calculateWeeklyDeadline()
	}

	maxRank := len(prizeDistribution)
	if maxRank == 0 {
		maxRank = 20
	}

	redisKey := fmt.Sprintf("tournament:referrals:%s", contestID)
	zList, _ := s.redis.ZRevRangeWithScores(ctx, redisKey, 0, int64(maxRank-1))
	if len(zList) == 0 {
		zList, _ = s.redis.ZRevRangeWithScores(ctx, "tournament:referrals:current_month", 0, int64(maxRank-1))
	}

	var topWinners []model.ContestLeaderboardUser
	var otherRankings []model.ContestLeaderboardUser

	useMock := s.isMockSeedsEnabled(ctx)

	if useMock {
		mockSeeds := []struct {
			name string
			refs int
		}{
			{"AlphaReferrer", 450},
			{"WhaleNode", 320},
			{"CryptoAmbassador", 210},
			{"BnbLord", 145},
			{"ViralGrowth", 112},
			{"MiniAppKing", 94},
			{"NetworkBoss", 76},
			{"DiamondHands", 58},
			{"TGPromoter", 42},
			{"EarnMaster", 31},
			{"TonConnector", 27},
			{"ReferralPro", 24},
			{"GuildLeader", 21},
			{"MatrixNode", 18},
			{"SquadCaptain", 15},
			{"AffiliateKing", 13},
			{"ChainMaster", 11},
			{"GrowthHacker", 9},
			{"CryptoAmbition", 7},
			{"StarInviter", 5},
		}

		for i := 0; i < maxRank; i++ {
			rank := i + 1
			name := "Partner"
			refs := 0
			avatar := ""
			if i < len(mockSeeds) {
				name = mockSeeds[i].name
				refs = mockSeeds[i].refs
			}

			prize := findPrizeForRank(rank, prizeDistribution)

			if i < len(zList) {
				score := int(zList[i].Score)
				if score > refs {
					refs = score
				}
				memberID, _ := strconv.ParseInt(zList[i].Member.(string), 10, 64)
				if s.userRepo != nil {
					if u, err := s.userRepo.GetByID(ctx, memberID); err == nil && u != nil {
						name = u.FirstName
						if name == "" {
							name = u.Username
						}
						avatar = u.PhotoURL
					}
				}
			}

			userItem := model.ContestLeaderboardUser{
				Rank:   rank,
				Name:   name,
				Avatar: avatar,
				Score:  refs,
				Spins:  refs,
				Prize:  prize,
			}

			if rank <= 3 {
				topWinners = append(topWinners, userItem)
			} else {
				otherRankings = append(otherRankings, userItem)
			}
		}
	} else {
		// 100% Real Live Referrers Mode
		for i, z := range zList {
			score := int(z.Score)
			if score <= 0 {
				continue
			}
			rank := i + 1
			memberID, _ := strconv.ParseInt(z.Member.(string), 10, 64)
			name := fmt.Sprintf("Partner #%d", memberID)
			avatar := ""
			if s.userRepo != nil {
				if u, err := s.userRepo.GetByID(ctx, memberID); err == nil && u != nil {
					name = u.FirstName
					if name == "" {
						name = u.Username
					}
					if name == "" {
						name = fmt.Sprintf("Player #%d", u.ID)
					}
					avatar = u.PhotoURL
				}
			}

			prize := findPrizeForRank(rank, prizeDistribution)
			userItem := model.ContestLeaderboardUser{
				Rank:   rank,
				Name:   name,
				Avatar: avatar,
				Score:  score,
				Spins:  score,
				Prize:  prize,
			}

			if rank <= 3 {
				topWinners = append(topWinners, userItem)
			} else {
				otherRankings = append(otherRankings, userItem)
			}
		}
	}

	userScore, _ := s.redis.ZScore(ctx, redisKey, fmt.Sprintf("%d", userID))
	userRank, errRank := s.redis.ZRevRank(ctx, redisKey, fmt.Sprintf("%d", userID))
	if userScore == 0 {
		userScore, _ = s.redis.ZScore(ctx, "tournament:referrals:current_month", fmt.Sprintf("%d", userID))
		userRank, errRank = s.redis.ZRevRank(ctx, "tournament:referrals:current_month", fmt.Sprintf("%d", userID))
	}

	actualRank := 0
	if errRank == nil && userScore > 0 {
		actualRank = int(userRank) + 1
	} else if useMock {
		actualRank = 35
	}

	actualRefs := int(userScore)
	if actualRefs == 0 && useMock {
		actualRefs = 12
	}

	var projectedPrize string
	if actualRank > 0 {
		projectedPrize = findPrizeForRank(actualRank, prizeDistribution)
	} else {
		projectedPrize = "$0.00"
	}

	return &model.ContestLeaderboardResponse{
		ContestID:     contestID,
		Title:         title,
		Category:      "referrals",
		PrizePool:     prizePoolStr,
		EndsIn:        endsInStr,
		EndsTimestamp: endsTimestamp,
		TopWinners:    topWinners,
		OtherRankings: otherRankings,
		UserStatus: model.UserTournamentStatus{
			Rank:           actualRank,
			Score:          actualRefs,
			Spins:          actualRefs,
			ProjectedPrize: projectedPrize,
		},
	}, nil
}

// GetActiveContests returns all active tournaments dynamically from the database
func (s *ContestService) GetActiveContests(ctx context.Context) (*model.ActiveContestsResponse, error) {
	var dbContests []model.Contest
	if s.contestRepo != nil {
		dbContests, _ = s.contestRepo.GetActiveContests(ctx)
	}

	if len(dbContests) == 0 {
		endsInStr, endsTimestamp := calculateWeeklyDeadline()
		return &model.ActiveContestsResponse{
			Contests: []model.ContestSummary{
				{
					ID:            "spin_weekly",
					Title:         "Weekly Spin Championship",
					Category:      "spins",
					PrizePool:     "$500.00 USDT",
					IsActive:      true,
					EndsIn:        endsInStr,
					EndsTimestamp: endsTimestamp,
					Icon:          "./assets/wheel-of-fortune.png",
				},
				{
					ID:            "referral_monthly",
					Title:         "Global Referral Championship",
					Category:      "referrals",
					PrizePool:     "$1,000.00 USDT",
					IsActive:      true,
					EndsIn:        endsInStr,
					EndsTimestamp: endsTimestamp,
					Icon:          "./assets/inviteFeatureCardIcon.png",
				},
			},
		}, nil
	}

	var summaries []model.ContestSummary
	for _, c := range dbContests {
		endsInStr, endsTimestamp := formatDeadline(c.EndsAt)
		prizeStr := c.PrizePoolStr
		if prizeStr == "" {
			prizeStr = fmt.Sprintf("$%.2f USDT", c.PrizePoolUSD)
		}
		summaries = append(summaries, model.ContestSummary{
			ID:            c.ContestID,
			Title:         c.Title,
			Category:      c.Type,
			PrizePool:     prizeStr,
			IsActive:      c.IsActive,
			EndsIn:        endsInStr,
			EndsTimestamp: endsTimestamp,
			Icon:          c.Icon,
		})
	}

	return &model.ActiveContestsResponse{Contests: summaries}, nil
}

// CreateOrUpdateContest enforces that there can only be ONE active contest for type 'spins' and ONE for 'referrals'.
// If an active contest already exists for that type, its prize pool, ladder, and end date are updated instead of inserting duplicate active contests.
func (s *ContestService) CreateOrUpdateContest(ctx context.Context, req *model.CreateContestRequest) (*model.Contest, error) {
	if s.contestRepo == nil {
		return nil, fmt.Errorf("contest repository unavailable")
	}

	if req.Type != "spins" && req.Type != "referrals" {
		return nil, fmt.Errorf("invalid contest type: '%s' (must be 'spins' or 'referrals')", req.Type)
	}

	durationDays := req.DurationDays
	if durationDays <= 0 {
		durationDays = 7
	}

	startsAt := time.Now().UTC()
	if req.StartsAt != nil {
		startsAt = *req.StartsAt
	}

	endsAt := startsAt.Add(time.Duration(durationDays) * 24 * time.Hour)
	if req.EndsAt != nil {
		endsAt = *req.EndsAt
	}

	prizePoolStr := req.PrizePoolStr
	if prizePoolStr == "" {
		prizePoolStr = fmt.Sprintf("$%.2f USDT", req.PrizePoolUSD)
	}

	icon := req.Icon
	if icon == "" {
		if req.Type == "spins" {
			icon = "./assets/wheel-of-fortune.png"
		} else {
			icon = "./assets/inviteFeatureCardIcon.png"
		}
	}

	// 1. Enforce single active contest per type: Check if active contest already exists
	existing, err := s.contestRepo.GetActiveByType(ctx, req.Type)
	if err == nil && existing != nil {
		existing.Title = req.Title
		existing.PrizePoolUSD = req.PrizePoolUSD
		existing.PrizePoolStr = prizePoolStr
		if icon != "" {
			existing.Icon = icon
		}
		existing.PrizeDistribution = req.PrizeDistribution
		existing.EndsAt = endsAt
		if req.StartsAt != nil {
			existing.StartsAt = *req.StartsAt
		}

		updateReq := model.UpdateContestRequest{
			Title:             &existing.Title,
			PrizePoolUSD:      &existing.PrizePoolUSD,
			PrizePoolStr:      &existing.PrizePoolStr,
			Icon:              &existing.Icon,
			PrizeDistribution: &existing.PrizeDistribution,
			StartsAt:          &existing.StartsAt,
			EndsAt:            &existing.EndsAt,
		}

		if err := s.contestRepo.Update(ctx, existing.ContestID, &updateReq); err != nil {
			return nil, fmt.Errorf("failed to update existing active contest: %w", err)
		}
		return existing, nil
	}

	// 2. If no active contest exists for this type, create a new active contest
	contestID := req.ContestID
	if contestID == "" {
		if req.Type == "spins" {
			contestID = "spin_weekly"
		} else {
			contestID = "referral_monthly"
		}
	}

	contest := &model.Contest{
		ContestID:         contestID,
		Type:              req.Type,
		Title:             req.Title,
		PrizePoolUSD:      req.PrizePoolUSD,
		PrizePoolStr:      prizePoolStr,
		Icon:              icon,
		PrizeDistribution: req.PrizeDistribution,
		StartsAt:          startsAt,
		EndsAt:            endsAt,
		Status:            "active",
		IsActive:          true,
	}

	if err := s.contestRepo.Create(ctx, contest); err != nil {
		return nil, fmt.Errorf("failed to create contest: %w", err)
	}

	return contest, nil
}

// DistributePrizes credits the prize rewards to the top winners and finalizes the contest atomically
func (s *ContestService) DistributePrizes(ctx context.Context, contestID string) ([]map[string]interface{}, error) {
	if s.contestRepo == nil {
		return nil, fmt.Errorf("contest repository unavailable")
	}

	contest, err := s.contestRepo.GetByID(ctx, contestID)
	if err != nil || contest == nil {
		return nil, fmt.Errorf("contest '%s' not found", contestID)
	}

	// Atomic status transition from 'active' to 'ended'
	// Ensures prizes can NEVER be distributed more than once
	transitioned, err := s.contestRepo.MarkContestEndedIfActive(ctx, contestID)
	if err != nil {
		return nil, fmt.Errorf("failed to transition contest status: %w", err)
	}
	if !transitioned {
		return nil, fmt.Errorf("contest '%s' is not active or prizes have already been distributed", contestID)
	}

	prizeTiers := contest.PrizeDistribution
	if len(prizeTiers) == 0 {
		if contest.Type == "spins" {
			prizeTiers = defaultSpinPrizes
		} else {
			prizeTiers = defaultReferralPrizes
		}
	}

	redisKey := fmt.Sprintf("tournament:%s:%s", contest.Type, contest.ContestID)
	zList, _ := s.redis.ZRevRangeWithScores(ctx, redisKey, 0, int64(len(prizeTiers)-1))
	if len(zList) == 0 && contest.Type == "spins" {
		zList, _ = s.redis.ZRevRangeWithScores(ctx, "tournament:spins:current_week", 0, int64(len(prizeTiers)-1))
	} else if len(zList) == 0 && contest.Type == "referrals" {
		zList, _ = s.redis.ZRevRangeWithScores(ctx, "tournament:referrals:current_month", 0, int64(len(prizeTiers)-1))
	}

	var distributedWinners []map[string]interface{}

	for i, member := range zList {
		rank := i + 1
		winnerID, err := strconv.ParseInt(member.Member.(string), 10, 64)
		if err != nil || winnerID <= 0 {
			continue
		}

		prizeTier := findPrizeTierForRank(rank, prizeTiers)
		if prizeTier == nil || prizeTier.AmountUSD <= 0 {
			continue
		}

		// 1. Credit USD balance to winner
		if s.userRepo != nil {
			_, _ = s.userRepo.MutateBalances(ctx, winnerID, 0, 0, prizeTier.AmountUSD, 0)
		}

		// 2. Record immutable audit transaction
		if s.txRepo != nil {
			_ = s.txRepo.Create(ctx, &model.Transaction{
				UserID:      winnerID,
				Category:    "tournament",
				Title:       fmt.Sprintf("%s Prize (Rank #%d)", contest.Title, rank),
				AmountUSD:   prizeTier.AmountUSD,
				Status:      "completed",
				ReferenceID: fmt.Sprintf("CONTEST-%s-%d-%d", contest.ContestID, rank, winnerID),
				Description: fmt.Sprintf("Congratulations! Won %s in %s! 🏆", prizeTier.Prize, contest.Title),
			})
		}

		distributedWinners = append(distributedWinners, map[string]interface{}{
			"rank":      rank,
			"userId":    winnerID,
			"score":     int(member.Score),
			"prize":     prizeTier.Prize,
			"amountUsd": prizeTier.AmountUSD,
		})
	}

	// 3. Save winners JSON in PostgreSQL
	winnersJSONBytes, _ := json.Marshal(distributedWinners)
	_ = s.contestRepo.SaveWinners(ctx, contestID, string(winnersJSONBytes))

	return distributedWinners, nil
}


func findPrizeForRank(rank int, prizeTiers []model.ContestPrizeTier) string {
	tier := findPrizeTierForRank(rank, prizeTiers)
	if tier != nil {
		return tier.Prize
	}
	return "$0.00"
}

func findPrizeTierForRank(rank int, prizeTiers []model.ContestPrizeTier) *model.ContestPrizeTier {
	for _, tier := range prizeTiers {
		if tier.RankEnd > 0 {
			if rank >= tier.Rank && rank <= tier.RankEnd {
				return &tier
			}
		} else if tier.Rank == rank {
			return &tier
		}
	}
	return nil
}

func formatDeadline(endsAt time.Time) (string, int64) {
	remaining := time.Until(endsAt)
	if remaining <= 0 {
		return "Ended", endsAt.UnixMilli()
	}

	hours := int(remaining.Hours()) % 24
	days := int(remaining.Hours()) / 24
	minutes := int(remaining.Minutes()) % 60
	seconds := int(remaining.Seconds()) % 60
	endsInStr := fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, seconds)

	return endsInStr, endsAt.UnixMilli()
}

func calculateWeeklyDeadline() (string, int64) {
	now := time.Now().UTC()
	daysUntilSunday := int(time.Sunday - now.Weekday())
	if daysUntilSunday <= 0 {
		daysUntilSunday += 7
	}
	nextSunday := time.Date(now.Year(), now.Month(), now.Day()+daysUntilSunday, 23, 59, 59, 0, time.UTC)
	remaining := time.Until(nextSunday)

	hours := int(remaining.Hours()) % 24
	days := int(remaining.Hours()) / 24
	minutes := int(remaining.Minutes()) % 60
	seconds := int(remaining.Seconds()) % 60
	endsInStr := fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, seconds)

	return endsInStr, nextSunday.UnixMilli()
}
