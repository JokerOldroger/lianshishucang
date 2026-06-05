package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/lianshishucang/backend/models"
	"gorm.io/gorm"
)

var ErrNoTelemetryData = errors.New("no telemetry data found for cabinet")

type TelemetryWindowStats struct {
	WindowStart      time.Time `json:"window_start"`
	WindowEnd        time.Time `json:"window_end"`
	SampleCount      int       `json:"sample_count"`
	AvgTemp          float64   `json:"avg_temp"`
	AvgHumidity      float64   `json:"avg_humidity"`
	TempVariance     float64   `json:"temp_variance"`
	HumidityVariance float64   `json:"humidity_variance"`
}

type StorageService struct {
	db *gorm.DB
}

func NewStorageService(db *gorm.DB) *StorageService {
	return &StorageService{db: db}
}

func (s *StorageService) GetCabinetByCode(ctx context.Context, cabinetCode string) (*models.StorageCabinet, error) {
	var cabinet models.StorageCabinet
	if err := s.db.WithContext(ctx).
		Where("cabinet_code = ?", strings.TrimSpace(cabinetCode)).
		First(&cabinet).Error; err != nil {
		return nil, err
	}
	return &cabinet, nil
}

func (s *StorageService) GetCabinetForUser(ctx context.Context, cabinetID, userID uint) (*models.StorageCabinet, error) {
	var cabinet models.StorageCabinet
	if err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", cabinetID, userID).
		First(&cabinet).Error; err != nil {
		return nil, err
	}
	return &cabinet, nil
}

func (s *StorageService) GetInventoryItemsForCabinet(ctx context.Context, cabinetID, userID uint) ([]models.StorageInventoryItem, error) {
	var items []models.StorageInventoryItem
	if err := s.db.WithContext(ctx).
		Where("cabinet_id = ? AND user_id = ?", cabinetID, userID).
		Preload("PhysicalCollection").
		Order("created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *StorageService) GetDiagnosticRecordForCabinet(ctx context.Context, cabinetID, recordID uint) (*models.DiagnosticRecord, error) {
	var record models.DiagnosticRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND cabinet_id = ?", recordID, cabinetID).
		First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *StorageService) RecordTelemetry(ctx context.Context, cabinetCode string, temp, humidity float64, recordedAt time.Time) error {
	cabinet, err := s.GetCabinetByCode(ctx, cabinetCode)
	if err != nil {
		return err
	}
	if recordedAt.IsZero() {
		recordedAt = time.Now()
	}

	log := &models.TelemetryLog{
		CabinetID:       cabinet.ID,
		CurrentTemp:     temp,
		CurrentHumidity: humidity,
		RecordedAt:      recordedAt,
	}

	return s.db.WithContext(ctx).Create(log).Error
}

func (s *StorageService) ApplyDiagnosticParameters(ctx context.Context, cabinetID uint, temp, humidity float64) (*models.StorageCabinet, error) {
	updates := map[string]interface{}{
		"target_temp":     temp,
		"target_humidity": humidity,
	}
	if err := s.db.WithContext(ctx).
		Model(&models.StorageCabinet{}).
		Where("id = ?", cabinetID).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	var cabinet models.StorageCabinet
	if err := s.db.WithContext(ctx).First(&cabinet, cabinetID).Error; err != nil {
		return nil, err
	}
	return &cabinet, nil
}

func (s *StorageService) MarkDiagnosticApplied(ctx context.Context, recordID uint) error {
	now := time.Now()
	return s.db.WithContext(ctx).
		Model(&models.DiagnosticRecord{}).
		Where("id = ?", recordID).
		Update("applied_at", &now).Error
}

func (s *StorageService) GetTelemetryWindowStats(ctx context.Context, cabinetID uint, since time.Time) (*TelemetryWindowStats, error) {
	var logs []models.TelemetryLog
	if err := s.db.WithContext(ctx).
		Where("cabinet_id = ? AND recorded_at >= ?", cabinetID, since).
		Order("recorded_at ASC").
		Find(&logs).Error; err != nil {
		return nil, err
	}
	if len(logs) == 0 {
		return nil, ErrNoTelemetryData
	}

	var tempSum float64
	var humiditySum float64
	for _, entry := range logs {
		tempSum += entry.CurrentTemp
		humiditySum += entry.CurrentHumidity
	}

	avgTemp := tempSum / float64(len(logs))
	avgHumidity := humiditySum / float64(len(logs))

	var tempVariance float64
	var humidityVariance float64
	for _, entry := range logs {
		tempVariance += math.Pow(entry.CurrentTemp-avgTemp, 2)
		humidityVariance += math.Pow(entry.CurrentHumidity-avgHumidity, 2)
	}
	tempVariance /= float64(len(logs))
	humidityVariance /= float64(len(logs))

	return &TelemetryWindowStats{
		WindowStart:      since,
		WindowEnd:        logs[len(logs)-1].RecordedAt,
		SampleCount:      len(logs),
		AvgTemp:          avgTemp,
		AvgHumidity:      avgHumidity,
		TempVariance:     tempVariance,
		HumidityVariance: humidityVariance,
	}, nil
}

func (s *StorageService) EnsureCabinetOwnership(ctx context.Context, cabinetID, userID uint) error {
	_, err := s.GetCabinetForUser(ctx, cabinetID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("cabinet not found")
		}
		return err
	}
	return nil
}
