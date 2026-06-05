package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lianshishucang/backend/services"
	"gorm.io/gorm"
)

type StorageHandler struct {
	storageService    *services.StorageService
	diagnosticService *services.CabinetDiagnosticService
}

type ApplySettingsRequest struct {
	DiagnosticRecordID *uint    `json:"diagnostic_record_id,omitempty"`
	TargetTemp         *float64 `json:"target_temp,omitempty"`
	TargetHumidity     *float64 `json:"target_humidity,omitempty"`
}

func NewStorageHandler(storageService *services.StorageService, diagnosticService *services.CabinetDiagnosticService) *StorageHandler {
	return &StorageHandler{storageService: storageService, diagnosticService: diagnosticService}
}

func (h *StorageHandler) DiagnoseCabinet(c *gin.Context) {
	userID := c.GetUint("user_id")
	cabinetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cabinet ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()

	result, err := h.diagnosticService.RunCabinetDiagnostic(ctx, uint(cabinetID), userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "cabinet not found"})
			return
		}
		if errors.Is(err, services.ErrNoTelemetryData) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		log.Printf("[storage] failed to run cabinet diagnostic: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to run cabinet diagnostic"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *StorageHandler) ApplySettings(c *gin.Context) {
	userID := c.GetUint("user_id")
	cabinetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cabinet ID"})
		return
	}

	var req ApplySettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	cabinet, err := h.storageService.GetCabinetForUser(ctx, uint(cabinetID), userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "cabinet not found"})
			return
		}
		log.Printf("[storage] failed to load cabinet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load cabinet"})
		return
	}

	var targetTemp float64
	var targetHumidity float64
	if req.DiagnosticRecordID != nil {
		record, err := h.storageService.GetDiagnosticRecordForCabinet(ctx, cabinet.ID, *req.DiagnosticRecordID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "diagnostic record not found"})
				return
			}
			log.Printf("[storage] failed to load diagnostic record: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load diagnostic record"})
			return
		}
		targetTemp = record.AppliedTemp
		targetHumidity = record.AppliedHumidity
	} else if req.TargetTemp != nil && req.TargetHumidity != nil {
		targetTemp = *req.TargetTemp
		targetHumidity = *req.TargetHumidity
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide diagnostic_record_id or both target_temp and target_humidity"})
		return
	}

	updatedCabinet, err := h.storageService.ApplyDiagnosticParameters(ctx, cabinet.ID, targetTemp, targetHumidity)
	if err != nil {
		log.Printf("[storage] failed to apply settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to apply settings"})
		return
	}
	if req.DiagnosticRecordID != nil {
		if err := h.storageService.MarkDiagnosticApplied(ctx, *req.DiagnosticRecordID); err != nil {
			log.Printf("[storage] failed to mark diagnostic applied: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"cabinet": updatedCabinet,
		"message": "settings applied",
	})
}
