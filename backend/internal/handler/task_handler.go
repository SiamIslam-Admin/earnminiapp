package handler

import (
	"earnminiapp/internal/middleware"
	"earnminiapp/internal/service"
	"earnminiapp/pkg/response"
	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	taskService *service.TaskService
}

func NewTaskHandler(taskService *service.TaskService) *TaskHandler {
	return &TaskHandler{taskService: taskService}
}

// GetTasks handles GET /api/v1/tasks
func (h *TaskHandler) GetTasks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	tasksPage, err := h.taskService.GetTasksPage(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, tasksPage)
}

// StartTask handles POST /api/v1/tasks/:id/start
func (h *TaskHandler) StartTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	if err := h.taskService.StartTask(c.Request.Context(), userID, taskID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Task started successfully. Please complete the action.", gin.H{
		"taskId":              taskID,
		"status":              "verifying",
		"verificationSeconds": 15,
	})
}

// ClaimTask handles POST /api/v1/tasks/:id/claim
func (h *TaskHandler) ClaimTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	updatedUser, err := h.taskService.ClaimTask(c.Request.Context(), userID, taskID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Task reward claimed successfully! 🎉", gin.H{
		"taskId":      taskID,
		"task_id":     taskID,
		"verified":    true,
		"claimed":     true,
		"user":        updatedUser,
		"userBalance": updatedUser,
	})
}

// VerifyTask handles POST /api/v1/tasks/:id/verify
func (h *TaskHandler) VerifyTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "Unauthorized")
		return
	}

	updatedUser, err := h.taskService.ClaimTask(c.Request.Context(), userID, taskID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "Task verified and rewards credited successfully! 🎉", gin.H{
		"taskId":      taskID,
		"task_id":     taskID,
		"verified":    true,
		"claimed":     true,
		"user":        updatedUser,
		"userBalance": updatedUser,
	})
}
