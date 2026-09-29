package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
	})
}

func SuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func Error(c *gin.Context, status int, errMessage string) {
	c.JSON(status, APIResponse{
		Success: false,
		Error:   errMessage,
	})
}

func BadRequest(c *gin.Context, errMessage string) {
	Error(c, http.StatusBadRequest, errMessage)
}

func Unauthorized(c *gin.Context, errMessage string) {
	Error(c, http.StatusUnauthorized, errMessage)
}

func Forbidden(c *gin.Context, errMessage string) {
	Error(c, http.StatusForbidden, errMessage)
}

func NotFound(c *gin.Context, errMessage string) {
	Error(c, http.StatusNotFound, errMessage)
}

func InternalError(c *gin.Context, errMessage string) {
	Error(c, http.StatusInternalServerError, errMessage)
}
