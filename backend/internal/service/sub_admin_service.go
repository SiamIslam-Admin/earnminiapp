package service

import (
	"context"
	"errors"
	"fmt"

	"earnminiapp/internal/config"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
)

type SubAdminService struct {
	subAdminRepo *repository.SubAdminRepository
	userRepo     *repository.UserRepository
	cfg          *config.Config
}

func NewSubAdminService(
	subAdminRepo *repository.SubAdminRepository,
	userRepo *repository.UserRepository,
	cfg *config.Config,
) *SubAdminService {
	return &SubAdminService{
		subAdminRepo: subAdminRepo,
		userRepo:     userRepo,
		cfg:          cfg,
	}
}

func (s *SubAdminService) ListSubAdmins(ctx context.Context) ([]model.SubAdmin, error) {
	if s.subAdminRepo == nil {
		return []model.SubAdmin{}, nil
	}
	return s.subAdminRepo.GetAll(ctx)
}

func (s *SubAdminService) CreateSubAdmin(ctx context.Context, req *model.CreateSubAdminRequest, createdBy int64) (*model.SubAdmin, error) {
	if s.subAdminRepo == nil {
		return nil, errors.New("sub-admin repository unavailable")
	}

	if req.TelegramID <= 0 {
		return nil, errors.New("valid telegram ID is required")
	}

	// Cannot add a main admin as a sub-admin
	if s.cfg != nil && s.cfg.IsAdminTelegramID(req.TelegramID) {
		return nil, errors.New("user is already configured as a main administrator")
	}

	// Auto-lookup user details if username / first_name not provided
	username := req.Username
	firstName := req.FirstName
	if (username == "" || firstName == "") && s.userRepo != nil {
		user, _ := s.userRepo.GetByTelegramID(ctx, req.TelegramID)
		if user != nil {
			if username == "" {
				username = user.Username
			}
			if firstName == "" {
				firstName = user.FirstName
			}
		}
	}

	role := req.Role
	if role == "" {
		role = "moderator"
	}

	permissions := req.Permissions
	if len(permissions) == 0 {
		permissions = []string{"support", "users_view", "tasks_manage", "contests_manage"}
	}

	// Guard against sub-admins granting admin_management to anyone
	filteredPerms := make([]string, 0, len(permissions))
	for _, p := range permissions {
		if p != "admin_manage" && p != "system_security" {
			filteredPerms = append(filteredPerms, p)
		}
	}

	sa := &model.SubAdmin{
		TelegramID:  req.TelegramID,
		Username:    username,
		FirstName:   firstName,
		Role:        role,
		Permissions: filteredPerms,
		IsActive:    true,
		CreatedBy:   &createdBy,
	}

	if err := s.subAdminRepo.Create(ctx, sa); err != nil {
		return nil, fmt.Errorf("failed to create sub-admin: %w", err)
	}

	return sa, nil
}

func (s *SubAdminService) UpdateSubAdmin(ctx context.Context, id int64, req *model.UpdateSubAdminRequest) (*model.SubAdmin, error) {
	if s.subAdminRepo == nil {
		return nil, errors.New("sub-admin repository unavailable")
	}

	sa, err := s.subAdminRepo.GetByID(ctx, id)
	if err != nil || sa == nil {
		return nil, errors.New("sub-admin not found")
	}

	if req.Role != "" {
		sa.Role = req.Role
	}

	if req.Permissions != nil {
		filteredPerms := make([]string, 0, len(req.Permissions))
		for _, p := range req.Permissions {
			if p != "admin_manage" && p != "system_security" {
				filteredPerms = append(filteredPerms, p)
			}
		}
		sa.Permissions = filteredPerms
	}

	if req.IsActive != nil {
		sa.IsActive = *req.IsActive
	}

	if err := s.subAdminRepo.Update(ctx, sa); err != nil {
		return nil, fmt.Errorf("failed to update sub-admin: %w", err)
	}

	return sa, nil
}

func (s *SubAdminService) DeleteSubAdmin(ctx context.Context, id int64) error {
	if s.subAdminRepo == nil {
		return errors.New("sub-admin repository unavailable")
	}
	return s.subAdminRepo.Delete(ctx, id)
}

func (s *SubAdminService) GetSubAdminByTelegramID(ctx context.Context, tgID int64) (*model.SubAdmin, error) {
	if s.subAdminRepo == nil {
		return nil, nil
	}
	return s.subAdminRepo.GetByTelegramID(ctx, tgID)
}
