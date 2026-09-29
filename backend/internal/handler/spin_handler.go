package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/model"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type SpinHandler struct {
	spinService *service.SpinService
}

func NewSpinHandler(spinService *service.SpinService) *SpinHandler {
	return &SpinHandler{spinService: spinService}
}

// SpinWheel handles POST /api/v1/spin
func (h *SpinHandler) SpinWheel(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	var req model.SpinRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.spinService.ExecuteSpin(c.Request.Context(), userID, req.Method)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Spin executed successfully", result)
}
