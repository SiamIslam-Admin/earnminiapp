package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type SupportHandler struct {
	supportService *service.SupportService
}

func NewSupportHandler(supportService *service.SupportService) *SupportHandler {
	return &SupportHandler{supportService: supportService}
}

// SubmitFeedback handles POST /api/v1/support/feedback
func (h *SupportHandler) SubmitFeedback(c *gin.Context) {
	var userIDPtr *int64
	userID := middleware.GetUserID(c)
	if userID > 0 {
		userIDPtr = &userID
	}

	email := c.PostForm("email")
	category := c.PostForm("category")
	description := c.PostForm("description")

	// If submitted via JSON instead of Form
	if email == "" && description == "" {
		var jsonReq model.FeedbackRequest
		if err := c.ShouldBindJSON(&jsonReq); err == nil {
			email = jsonReq.Email
			category = jsonReq.Category
			description = jsonReq.Description
		}
	}

	if email == "" || description == "" {
		response.BadRequest(c, "Email and description are required")
		return
	}

	if category == "" {
		category = "general"
	}

	// Handle screenshot upload if present
	screenshotURL := ""
	file, err := c.FormFile("screenshot")
	if err == nil && file != nil {
		uploadDir := "./uploads"
		_ = os.MkdirAll(uploadDir, os.ModePerm)
		filename := fmt.Sprintf("feedback_%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		savePath := filepath.Join(uploadDir, filename)
		if err := c.SaveUploadedFile(file, savePath); err == nil {
			screenshotURL = "/uploads/" + filename
		}
	}

	feedbackReq := &model.FeedbackRequest{
		Email:       email,
		Category:    category,
		Description: description,
	}

	res, err := h.supportService.CreateTicket(c.Request.Context(), userIDPtr, feedbackReq, screenshotURL)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Feedback submitted successfully! ✓", res)
}
