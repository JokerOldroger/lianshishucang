package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/lianshishucang/backend/models"
	"gorm.io/gorm"
)

const gemmaDiagnosticSystemPrompt = "You are an expert conservator for physical collectibles stored in climate-controlled cabinets. Analyze the telemetry summary and material information. Output ONLY a valid JSON object with no markdown, no code fences, and no extra text. The JSON must contain exactly these keys: human_readable_advice, recommended_target_temp, recommended_humidity_cap, risk_level."

type GemmaDiagnosticResponse struct {
	HumanReadableAdvice    string  `json:"human_readable_advice"`
	RecommendedTargetTemp  float64 `json:"recommended_target_temp"`
	RecommendedHumidityCap float64 `json:"recommended_humidity_cap"`
	RiskLevel              string  `json:"risk_level"`
}

type DiagnosticResult struct {
	DiagnosticRecordID     uint                  `json:"diagnostic_record_id"`
	CabinetID              uint                  `json:"cabinet_id"`
	CollectionID           uint                  `json:"collection_id"`
	HumanReadableAdvice    string                `json:"human_readable_advice"`
	RecommendedTargetTemp  float64               `json:"recommended_target_temp"`
	RecommendedHumidityCap float64               `json:"recommended_humidity_cap"`
	RiskLevel              string                `json:"risk_level"`
	TelemetrySummary       *TelemetryWindowStats `json:"telemetry_summary,omitempty"`
	MaterialTags           []string              `json:"material_tags,omitempty"`
}

type diagnosticPromptPayload struct {
	CabinetCode      string                `json:"cabinet_code"`
	CabinetStatus    string                `json:"cabinet_status"`
	CurrentTargets   diagnosticTargetState `json:"current_targets"`
	TelemetrySummary *TelemetryWindowStats `json:"telemetry_summary"`
	Collections      []diagnosticItem      `json:"collections"`
}

type diagnosticTargetState struct {
	TargetTemp     float64 `json:"target_temp"`
	TargetHumidity float64 `json:"target_humidity"`
}

type diagnosticItem struct {
	InventoryItemID uint     `json:"inventory_item_id"`
	Name            string   `json:"name"`
	MaterialTags    []string `json:"material_tags"`
}

type CabinetDiagnosticService struct {
	db      *gorm.DB
	storage *StorageService
	gemma   *GemmaService
}

func NewCabinetDiagnosticService(db *gorm.DB, storage *StorageService, gemma *GemmaService) *CabinetDiagnosticService {
	return &CabinetDiagnosticService{db: db, storage: storage, gemma: gemma}
}

func (s *CabinetDiagnosticService) RunCabinetDiagnostic(ctx context.Context, cabinetID uint, userID uint) (*DiagnosticResult, error) {
	cabinet, err := s.storage.GetCabinetForUser(ctx, cabinetID, userID)
	if err != nil {
		return nil, err
	}

	items, err := s.storage.GetInventoryItemsForCabinet(ctx, cabinetID, userID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no inventory items found in cabinet")
	}

	stats, err := s.storage.GetTelemetryWindowStats(ctx, cabinetID, time.Now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}

	promptPayload, combinedTags, primaryCollectionID, err := buildDiagnosticPrompt(cabinet, items, stats)
	if err != nil {
		return nil, err
	}

	response, err := s.gemma.DiagnoseCabinetEnvironment(ctx, *promptPayload)
	if err != nil {
		return nil, err
	}

	record := &models.DiagnosticRecord{
		CabinetID:       cabinet.ID,
		CollectionID:    primaryCollectionID,
		HumanAdvice:     response.HumanReadableAdvice,
		AppliedTemp:     response.RecommendedTargetTemp,
		AppliedHumidity: response.RecommendedHumidityCap,
		RiskLevel:       response.RiskLevel,
	}
	if err := s.db.WithContext(ctx).Create(record).Error; err != nil {
		return nil, err
	}

	return &DiagnosticResult{
		DiagnosticRecordID:     record.ID,
		CabinetID:              cabinet.ID,
		CollectionID:           primaryCollectionID,
		HumanReadableAdvice:    response.HumanReadableAdvice,
		RecommendedTargetTemp:  response.RecommendedTargetTemp,
		RecommendedHumidityCap: response.RecommendedHumidityCap,
		RiskLevel:              response.RiskLevel,
		TelemetrySummary:       stats,
		MaterialTags:           combinedTags,
	}, nil
}

func (s *GemmaService) DiagnoseCabinetEnvironment(ctx context.Context, payload diagnosticPromptPayload) (*GemmaDiagnosticResponse, error) {
	if strings.TrimSpace(s.cfg.GemmaAPIURL) == "" {
		return nil, fmt.Errorf("GEMMA_API_URL is not configured")
	}

	promptBody, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal diagnostic payload: %w", err)
	}

	requestPayload := gemmaRequest{
		Model:  s.cfg.GemmaModel,
		System: gemmaDiagnosticSystemPrompt,
		Input: gemmaRequestInput{
			Prompt: "Analyze this cabinet diagnostic context and return only the JSON object: " + string(promptBody),
		},
		Options: gemmaRequestOption{
			ResponseFormat: "json",
		},
	}

	body, err := json.Marshal(requestPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal Gemma diagnostic request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.GemmaAPIURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build Gemma diagnostic request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(s.cfg.GemmaAPIKey) != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.GemmaAPIKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[diagnostic] Gemma request failed: %v", err)
		return nil, fmt.Errorf("Gemma diagnostic request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read Gemma diagnostic response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[diagnostic] Gemma non-2xx status=%d body=%s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("Gemma returned status %d", resp.StatusCode)
	}

	var envelope gemmaResponse
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		log.Printf("[diagnostic] invalid Gemma envelope: %v body=%s", err, string(respBody))
		return nil, fmt.Errorf("invalid Gemma diagnostic response envelope: %w", err)
	}

	parsed, err := ParseGemmaDiagnosticResponse(envelope.OutputText)
	if err != nil {
		log.Printf("[diagnostic] invalid Gemma diagnostic payload: %v payload=%s", err, envelope.OutputText)
		return nil, err
	}

	return parsed, nil
}

func ParseGemmaDiagnosticResponse(raw string) (*GemmaDiagnosticResponse, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("Gemma diagnostic response was empty")
	}

	var parsed GemmaDiagnosticResponse
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return nil, fmt.Errorf("invalid diagnostic JSON: %w", err)
	}

	parsed.HumanReadableAdvice = strings.TrimSpace(parsed.HumanReadableAdvice)
	parsed.RiskLevel = strings.ToLower(strings.TrimSpace(parsed.RiskLevel))

	if parsed.HumanReadableAdvice == "" {
		return nil, fmt.Errorf("missing human_readable_advice in diagnostic response")
	}
	if parsed.RiskLevel == "" {
		return nil, fmt.Errorf("missing risk_level in diagnostic response")
	}
	switch parsed.RiskLevel {
	case "low", "medium", "high", "critical":
	default:
		return nil, fmt.Errorf("unsupported risk_level %q", parsed.RiskLevel)
	}

	return &parsed, nil
}

func buildDiagnosticPrompt(cabinet *models.StorageCabinet, items []models.StorageInventoryItem, stats *TelemetryWindowStats) (*diagnosticPromptPayload, []string, uint, error) {
	result := &diagnosticPromptPayload{
		CabinetCode:   cabinet.CabinetCode,
		CabinetStatus: cabinet.Status,
		CurrentTargets: diagnosticTargetState{
			TargetTemp:     cabinet.TargetTemp,
			TargetHumidity: cabinet.TargetHumidity,
		},
		TelemetrySummary: stats,
		Collections:      make([]diagnosticItem, 0, len(items)),
	}

	combined := make([]string, 0)
	seen := make(map[string]struct{})
	primaryCollectionID := items[0].ID

	for _, item := range items {
		tags, err := extractMaterialTags(item)
		if err != nil {
			return nil, nil, 0, err
		}
		for _, tag := range tags {
			if _, ok := seen[tag]; ok {
				continue
			}
			seen[tag] = struct{}{}
			combined = append(combined, tag)
		}
		result.Collections = append(result.Collections, diagnosticItem{
			InventoryItemID: item.ID,
			Name:            item.Name,
			MaterialTags:    tags,
		})
	}

	return result, combined, primaryCollectionID, nil
}

func extractMaterialTags(item models.StorageInventoryItem) ([]string, error) {
	tags := make([]string, 0)
	seen := make(map[string]struct{})
	appendTag := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		tags = append(tags, value)
	}

	if len(item.MaterialTags) > 0 {
		var materialTags []string
		if err := json.Unmarshal(item.MaterialTags, &materialTags); err == nil {
			for _, tag := range materialTags {
				appendTag(tag)
			}
		} else {
			return nil, fmt.Errorf("invalid material_tags for inventory item %d: %w", item.ID, err)
		}
	}

	if item.PhysicalCollection != nil && len(item.PhysicalCollection.Attributes) > 0 {
		attrs, err := ParseCollectibleAttributes(string(item.PhysicalCollection.Attributes))
		if err == nil {
			appendTag(attrs.Material)
			for _, tag := range attrs.StyleTags {
				appendTag(tag)
			}
		}
	}

	if len(tags) == 0 {
		return nil, fmt.Errorf("no material tags available for inventory item %d", item.ID)
	}

	return tags, nil
}
