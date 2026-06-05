package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/lianshishucang/backend/config"
)

const gemmaSystemPrompt = "You are an expert appraiser for young people's trendy collectibles, including designer toys, action figures, Pop Mart figures, Bearbrick collectibles, Hot Toys figures, and sneakers. Analyze the provided collectible image and return ONLY a raw, minified JSON object with no markdown, no code fences, and no extra text. The JSON must exactly contain these keys: title, series_artist, material, dimensions, market_value, style_tags. style_tags must be an array of strings."

type GemmaResponse struct {
	Title        string   `json:"title"`
	SeriesArtist string   `json:"series_artist"`
	Material     string   `json:"material"`
	Dimensions   string   `json:"dimensions"`
	MarketValue  string   `json:"market_value"`
	StyleTags    []string `json:"style_tags"`
}

type CollectibleAttributes struct {
	IPName         string   `json:"ip_name"`
	Series         string   `json:"series"`
	Material       string   `json:"material"`
	DominantColors []string `json:"dominant_colors"`
	Condition      string   `json:"condition"`
	StyleTags      []string `json:"style_tags"`
}

type gemmaRequest struct {
	Model   string             `json:"model"`
	System  string             `json:"system"`
	Input   gemmaRequestInput  `json:"input"`
	Options gemmaRequestOption `json:"options,omitempty"`
}

type gemmaRequestInput struct {
	ImageURL string `json:"image_url,omitempty"`
	Prompt   string `json:"prompt"`
}

type gemmaRequestOption struct {
	ResponseFormat string `json:"response_format,omitempty"`
}

type gemmaResponse struct {
	OutputText string `json:"output_text"`
}

type geminiGenerateContentRequest struct {
	SystemInstruction geminiContent          `json:"system_instruction,omitempty"`
	Contents          []geminiContent        `json:"contents"`
	GenerationConfig  geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inline_data,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

type geminiGenerationConfig struct {
	Temperature      float64 `json:"temperature,omitempty"`
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
}

type geminiGenerateContentResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

type openRouterChatRequest struct {
	Model    string              `json:"model"`
	Messages []openRouterMessage `json:"messages"`
}

type openRouterMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type openRouterContentPart struct {
	Type     string                    `json:"type"`
	Text     string                    `json:"text,omitempty"`
	ImageURL *openRouterImageURLHolder `json:"image_url,omitempty"`
}

type openRouterImageURLHolder struct {
	URL string `json:"url"`
}

type openRouterChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

type GemmaService struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewGemmaService(cfg *config.Config) *GemmaService {
	return &GemmaService{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

func (s *GemmaService) AnalyzeCollectibleImage(ctx context.Context, imagePath string) (*GemmaResponse, error) {
	if strings.TrimSpace(imagePath) == "" {
		return nil, fmt.Errorf("image path is required")
	}

	provider := strings.ToLower(strings.TrimSpace(os.Getenv("GEMMA_PROVIDER")))
	if provider == "openrouter" {
		return s.analyzeWithOpenRouter(ctx, imagePath)
	}
	return s.analyzeWithGoogle(ctx, imagePath)
}

func (s *GemmaService) analyzeWithGoogle(ctx context.Context, imagePath string) (*GemmaResponse, error) {
	if strings.TrimSpace(s.cfg.GemmaAPIKey) == "" {
		return nil, fmt.Errorf("GEMMA_API_KEY is not configured")
	}

	imageBytes, mimeType, err := loadImageBytes(imagePath)
	if err != nil {
		return nil, err
	}

	endpoint := strings.TrimRight(s.cfg.GemmaAPIURL, "/")
	if endpoint == "" {
		endpoint = "https://generativelanguage.googleapis.com/v1beta/models"
	}
	endpoint = fmt.Sprintf("%s/%s:generateContent?key=%s", endpoint, s.cfg.GemmaModel, s.cfg.GemmaAPIKey)

	payload := geminiGenerateContentRequest{
		SystemInstruction: geminiContent{Parts: []geminiPart{{Text: gemmaSystemPrompt}}},
		Contents: []geminiContent{{
			Parts: []geminiPart{
				{Text: "Identify this collectible and return the JSON object now."},
				{InlineData: &geminiInlineData{MimeType: mimeType, Data: base64.StdEncoding.EncodeToString(imageBytes)}},
			},
		}},
		GenerationConfig: geminiGenerationConfig{Temperature: 0.2, ResponseMimeType: "application/json"},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal Gemma request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build Gemma request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[gemma] request failed: %v", err)
		return nil, fmt.Errorf("Gemma request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read Gemma response: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		log.Printf("[gemma] non-2xx response status=%d body=%s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("Gemma returned status %d", resp.StatusCode)
	}

	var parsed geminiGenerateContentResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		log.Printf("[gemma] invalid response envelope: %v body=%s", err, string(respBody))
		return nil, fmt.Errorf("invalid Gemma response envelope: %w", err)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("Gemma response missing candidates")
	}

	validated, err := ParseGemmaResponse(parsed.Candidates[0].Content.Parts[0].Text)
	if err != nil {
		log.Printf("[gemma] invalid model payload: %v payload=%s", err, parsed.Candidates[0].Content.Parts[0].Text)
		return nil, err
	}
	return validated, nil
}

func (s *GemmaService) analyzeWithOpenRouter(ctx context.Context, imagePath string) (*GemmaResponse, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY"))
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY is not configured")
	}
	model := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL"))
	if model == "" {
		model = "google/gemma-4-31b-it:free"
	}

	imageBytes, mimeType, err := loadImageBytes(imagePath)
	if err != nil {
		return nil, err
	}
	dataURL := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(imageBytes)

	payload := openRouterChatRequest{
		Model: model,
		Messages: []openRouterMessage{
			{Role: "system", Content: gemmaSystemPrompt},
			{Role: "user", Content: []openRouterContentPart{
				{Type: "text", Text: "Identify this collectible image and return only the JSON object."},
				{Type: "image_url", ImageURL: &openRouterImageURLHolder{URL: dataURL}},
			}},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal OpenRouter request: %w", err)
	}

	endpoint := strings.TrimSpace(os.Getenv("OPENROUTER_API_URL"))
	if endpoint == "" {
		endpoint = "https://openrouter.ai/api/v1/chat/completions"
	}
	var respBody []byte
	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("build OpenRouter request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("cf-aig-authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("HTTP-Referer", "http://localhost")
		req.Header.Set("X-Title", "lianshishucang-backend")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			log.Printf("[gemma/openrouter] request failed on attempt %d: %v", attempt, err)
			if attempt == 3 {
				return nil, fmt.Errorf("OpenRouter request failed: %w", err)
			}
			time.Sleep(time.Duration(attempt*2) * time.Second)
			continue
		}

		respBody, err = io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("read OpenRouter response: %w", err)
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			log.Printf("[gemma/openrouter] rate limited on attempt %d body=%s", attempt, string(respBody))
			if attempt == 3 {
				return nil, fmt.Errorf("OpenRouter returned 429 after retries")
			}
			time.Sleep(time.Duration(attempt*3) * time.Second)
			continue
		}
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
			log.Printf("[gemma/openrouter] non-2xx response status=%d body=%s", resp.StatusCode, string(respBody))
			return nil, fmt.Errorf("OpenRouter returned status %d", resp.StatusCode)
		}
		break
	}

	var parsed openRouterChatResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		log.Printf("[gemma/openrouter] invalid response envelope: %v body=%s", err, string(respBody))
		return nil, fmt.Errorf("invalid OpenRouter response envelope: %w", err)
	}
	if len(parsed.Choices) == 0 {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return nil, fmt.Errorf("OpenRouter error: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("OpenRouter response missing choices")
	}

	validated, err := ParseGemmaResponse(parsed.Choices[0].Message.Content)
	if err != nil {
		log.Printf("[gemma/openrouter] invalid model payload: %v payload=%s", err, parsed.Choices[0].Message.Content)
		return nil, err
	}
	return validated, nil
}

func loadImageBytes(imagePath string) ([]byte, string, error) {
	imageBytes, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, "", fmt.Errorf("read image file: %w", err)
	}
	mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(imagePath)))
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	return imageBytes, mimeType, nil
}

func AnalyzeCollectibleImage(imagePath string) (*GemmaResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	service := NewGemmaService(config.Load())
	return service.AnalyzeCollectibleImage(ctx, imagePath)
}

func ParseGemmaResponse(raw string) (*GemmaResponse, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("Gemma returned empty output")
	}

	var response GemmaResponse
	if err := json.Unmarshal([]byte(trimmed), &response); err != nil {
		return nil, fmt.Errorf("invalid Gemma JSON: %w", err)
	}

	response.Title = strings.TrimSpace(response.Title)
	response.SeriesArtist = strings.TrimSpace(response.SeriesArtist)
	response.Material = strings.TrimSpace(response.Material)
	response.Dimensions = strings.TrimSpace(response.Dimensions)
	response.MarketValue = strings.TrimSpace(response.MarketValue)

	if response.Title == "" {
		return nil, fmt.Errorf("missing title in Gemma response")
	}
	if response.SeriesArtist == "" {
		return nil, fmt.Errorf("missing series_artist in Gemma response")
	}
	if response.Material == "" {
		return nil, fmt.Errorf("missing material in Gemma response")
	}
	if response.Dimensions == "" {
		return nil, fmt.Errorf("missing dimensions in Gemma response")
	}
	if response.MarketValue == "" {
		return nil, fmt.Errorf("missing market_value in Gemma response")
	}
	if len(response.StyleTags) == 0 {
		return nil, fmt.Errorf("style_tags must contain at least one value")
	}
	for i := range response.StyleTags {
		response.StyleTags[i] = strings.TrimSpace(response.StyleTags[i])
		if response.StyleTags[i] == "" {
			return nil, fmt.Errorf("style_tags contains empty value")
		}
	}

	return &response, nil
}

func NormalizeCollectibleAttributes(attrs CollectibleAttributes) (*CollectibleAttributes, error) {
	raw, err := json.Marshal(attrs)
	if err != nil {
		return nil, fmt.Errorf("marshal collectible attributes: %w", err)
	}
	return ParseCollectibleAttributes(string(raw))
}

func ParseCollectibleAttributes(raw string) (*CollectibleAttributes, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("Gemma returned empty output")
	}

	var attrs CollectibleAttributes
	if err := json.Unmarshal([]byte(trimmed), &attrs); err == nil {
		attrs.IPName = strings.TrimSpace(attrs.IPName)
		attrs.Series = strings.TrimSpace(attrs.Series)
		attrs.Material = strings.TrimSpace(attrs.Material)
		attrs.Condition = strings.TrimSpace(attrs.Condition)
		if attrs.Material != "" || attrs.IPName != "" || attrs.Series != "" || len(attrs.StyleTags) > 0 || len(attrs.DominantColors) > 0 {
			for i := range attrs.DominantColors {
				attrs.DominantColors[i] = strings.TrimSpace(attrs.DominantColors[i])
			}
			for i := range attrs.StyleTags {
				attrs.StyleTags[i] = strings.TrimSpace(attrs.StyleTags[i])
			}
			return &attrs, nil
		}
	}

	mapped, err := ParseGemmaResponse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid collectible JSON: %w", err)
	}
	return &CollectibleAttributes{
		IPName:         mapped.Title,
		Series:         mapped.SeriesArtist,
		Material:       mapped.Material,
		Condition:      mapped.MarketValue,
		StyleTags:      mapped.StyleTags,
		DominantColors: []string{},
	}, nil
}
