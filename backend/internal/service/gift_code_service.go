package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/pkg/util"
)

type GiftCodeService struct {
	userRepo     *repository.UserRepository
	giftCodeRepo *repository.GiftCodeRepository
	txRepo       *repository.TransactionRepository
}

func NewGiftCodeService(
	userRepo *repository.UserRepository,
	giftCodeRepo *repository.GiftCodeRepository,
	txRepo *repository.TransactionRepository,
) *GiftCodeService {
	return &GiftCodeService{
		userRepo:     userRepo,
		giftCodeRepo: giftCodeRepo,
		txRepo:       txRepo,
	}
}

func (s *GiftCodeService) RedeemCode(ctx context.Context, userID int64, code string) (*model.RedeemGiftCodeResponse, error) {
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	gift, err := s.giftCodeRepo.GetByCode(ctx, cleanCode)
	if err != nil {
		return nil, err
	}
	if gift == nil || !gift.IsActive {
		return nil, errors.New("invalid or expired gift code")
	}

	if gift.ExpiresAt != nil && time.Now().After(*gift.ExpiresAt) {
		return nil, errors.New("this gift code has expired")
	}

	if gift.CurrentClaims >= gift.MaxClaims {
		return nil, errors.New("gift code maximum usage limit reached")
	}

	// Check if already claimed by user
	claimed, err := s.giftCodeRepo.HasUserClaimed(ctx, userID, gift.ID)
	if err != nil {
		return nil, err
	}
	if claimed {
		return nil, errors.New("you have already redeemed this gift code")
	}

	// Record redemption
	if err := s.giftCodeRepo.RecordClaim(ctx, userID, gift.ID); err != nil {
		if strings.Contains(err.Error(), "maximum usage limit reached") {
			return nil, errors.New("gift code maximum usage limit reached")
		}
		if strings.Contains(err.Error(), "already redeemed") || strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			return nil, errors.New("you have already redeemed this gift code")
		}
		return nil, fmt.Errorf("failed to process gift code redemption: %w", err)
	}

	// Calculate all rewards
	var rewardParts []string
	if gift.RewardDiamonds > 0 {
		rewardParts = append(rewardParts, fmt.Sprintf("+%d 💎", gift.RewardDiamonds))
	}
	if gift.RewardSpins > 0 {
		rewardParts = append(rewardParts, fmt.Sprintf("+%d Spins", gift.RewardSpins))
	}
	if gift.RewardUSD > 0 {
		rewardParts = append(rewardParts, fmt.Sprintf("+$%.2f USDT", gift.RewardUSD))
	}

	rewardText := strings.Join(rewardParts, ", ")
	if rewardText == "" {
		rewardText = "Gift Code Redeemed! 🎉"
	}

	updatedUser, err := s.userRepo.MutateBalances(ctx, userID, gift.RewardSpins, gift.RewardDiamonds, gift.RewardUSD, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to credit gift code reward: %w", err)
	}

	// Create audit ledger
	txID := util.GenerateTXID("GIFT")
	_ = s.txRepo.Create(ctx, &model.Transaction{
		UserID:         userID,
		Category:       "gift",
		Title:          fmt.Sprintf("Gift Code (%s)", gift.Code),
		AmountUSD:      gift.RewardUSD,
		AmountDiamonds: gift.RewardDiamonds,
		AmountSpins:    gift.RewardSpins,
		Status:         "completed",
		ReferenceID:    txID,
		Description:    rewardText,
	})

	userResp := ToUserResponse(updatedUser)
	return &model.RedeemGiftCodeResponse{
		RewardType:   "mixed",
		RewardAmount: gift.RewardUSD,
		RewardText:   rewardText,
		TxID:         txID,
		UserBalance:  userResp,
		User:         &userResp,
	}, nil
}

// BulkGenerateCodes generates unique single-use codes and prepares CSV data
func (s *GiftCodeService) BulkGenerateCodes(ctx context.Context, req *model.BulkGenerateGiftCodesRequest) (*model.BulkGenerateGiftCodesResponse, error) {
	batchID := fmt.Sprintf("BATCH-%d", time.Now().Unix())
	batchName := req.BatchName
	if batchName == "" {
		batchName = fmt.Sprintf("Bulk Giveaway %d Codes", req.Quantity)
	}

	codes, err := s.giftCodeRepo.GenerateBulkUniqueCodes(
		ctx, batchID, batchName, req.Quantity, req.Prefix, req.RewardDiamonds, req.RewardSpins, req.RewardUSD, req.ExpiresInDays,
	)
	if err != nil {
		return nil, err
	}

	// Build CSV string: code,batch_id,batch_name,reward_diamonds,reward_spins,reward_usd,created_at
	var sb strings.Builder
	sb.WriteString("code,batch_id,batch_name,reward_diamonds,reward_spins,reward_usd\n")
	for _, code := range codes {
		sb.WriteString(fmt.Sprintf("%s,%s,%s,%d,%d,%.2f\n", code, batchID, batchName, req.RewardDiamonds, req.RewardSpins, req.RewardUSD))
	}

	return &model.BulkGenerateGiftCodesResponse{
		BatchID:   batchID,
		Count:     len(codes),
		Codes:     codes,
		CsvExport: sb.String(),
	}, nil
}
