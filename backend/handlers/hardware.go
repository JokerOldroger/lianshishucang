package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lianshishucang/backend/services"
	"gorm.io/gorm"
)

type HardwareHandler struct {
	storageService *services.StorageService
}

type RecordTelemetryRequest struct {
	CabinetCode string     `json:"cabinet_code" binding:"required"`
	Temp        float64    `json:"temp" binding:"required"`
	Humidity    float64    `json:"humidity" binding:"required"`
	RecordedAt  *time.Time `json:"recorded_at,omitempty"`
}

func NewHardwareHandler(storageService *services.StorageService) *HardwareHandler {
	return &HardwareHandler{storageService: storageService}
}

func (h *HardwareHandler) RecordTelemetry(c *gin.Context) {
	var req RecordTelemetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateTelemetryRange(req.Temp, req.Humidity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	recordedAt := time.Time{}
	if req.RecordedAt != nil {
		recordedAt = req.RecordedAt.UTC()
	}

	if err := h.storageService.RecordTelemetry(c.Request.Context(), req.CabinetCode, req.Temp, req.Humidity, recordedAt); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "cabinet not found"})
			return
		}
		log.Printf("[hardware] failed to record telemetry for %s: %v", req.CabinetCode, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record telemetry"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "telemetry recorded"})
}

func (h *HardwareHandler) GetCabinetCommands(c *gin.Context) {
	cabinetCode := strings.TrimSpace(c.Param("cabinet_code"))
	cabinet, err := h.storageService.GetCabinetByCode(c.Request.Context(), cabinetCode)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "cabinet not found"})
			return
		}
		log.Printf("[hardware] failed to fetch cabinet commands for %s: %v", cabinetCode, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch cabinet commands"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cabinet_code":       cabinet.CabinetCode,
		"target_temp":        cabinet.TargetTemp,
		"target_humidity":    cabinet.TargetHumidity,
		"tec_cooling_active": cabinet.TECCoolingActive,
		"atomizer_active":    cabinet.AtomizerActive,
		"status":             cabinet.Status,
		"updated_at":         cabinet.UpdatedAt,
	})
}

func validateTelemetryRange(temp, humidity float64) error {
	if temp < -40 || temp > 100 {
		return errors.New("temperature out of range")
	}
	if humidity < 0 || humidity > 100 {
		return errors.New("humidity out of range")
	}
	return nil
}
