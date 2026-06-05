package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type StorageCabinet struct {
	ID               uint                   `gorm:"primaryKey" json:"id"`
	UserID           uint                   `gorm:"index;not null" json:"user_id"`
	CabinetCode      string                 `gorm:"uniqueIndex;size:100;not null" json:"cabinet_code"`
	TargetTemp       float64                `json:"target_temp"`
	TargetHumidity   float64                `json:"target_humidity"`
	TECCoolingActive bool                   `json:"tec_cooling_active"`
	AtomizerActive   bool                   `json:"atomizer_active"`
	Status           string                 `gorm:"size:30;index;not null" json:"status"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	DeletedAt        gorm.DeletedAt         `gorm:"index" json:"-"`
	User             User                   `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Items            []StorageInventoryItem `gorm:"foreignKey:CabinetID" json:"items,omitempty"`
}

type StorageInventoryItem struct {
	ID                   uint                `gorm:"primaryKey" json:"id"`
	UserID               uint                `gorm:"index;not null" json:"user_id"`
	CabinetID            uint                `gorm:"index;not null" json:"cabinet_id"`
	PhysicalCollectionID *uint               `gorm:"index" json:"physical_collection_id,omitempty"`
	Name                 string              `gorm:"size:200;not null" json:"name"`
	MaterialTags         json.RawMessage     `gorm:"type:jsonb" json:"material_tags"`
	InventoryStatus      string              `gorm:"size:30;index;not null" json:"inventory_status"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
	DeletedAt            gorm.DeletedAt      `gorm:"index" json:"-"`
	User                 User                `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Cabinet              StorageCabinet      `gorm:"foreignKey:CabinetID" json:"cabinet,omitempty"`
	PhysicalCollection   *PhysicalCollection `gorm:"foreignKey:PhysicalCollectionID" json:"physical_collection,omitempty"`
}

type TelemetryLog struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	CabinetID       uint           `gorm:"index;not null" json:"cabinet_id"`
	CurrentTemp     float64        `json:"current_temp"`
	CurrentHumidity float64        `json:"current_humidity"`
	RecordedAt      time.Time      `gorm:"index;not null" json:"recorded_at"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	Cabinet         StorageCabinet `gorm:"foreignKey:CabinetID" json:"cabinet,omitempty"`
}

type DiagnosticRecord struct {
	ID              uint                  `gorm:"primaryKey" json:"id"`
	CabinetID       uint                  `gorm:"index;not null" json:"cabinet_id"`
	CollectionID    uint                  `gorm:"index" json:"collection_id"`
	HumanAdvice     string                `gorm:"type:text;not null" json:"human_advice"`
	AppliedTemp     float64               `json:"applied_temp"`
	AppliedHumidity float64               `json:"applied_humidity"`
	RiskLevel       string                `gorm:"size:20;index;not null" json:"risk_level"`
	AppliedAt       *time.Time            `json:"applied_at,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
	DeletedAt       gorm.DeletedAt        `gorm:"index" json:"-"`
	Cabinet         StorageCabinet        `gorm:"foreignKey:CabinetID" json:"cabinet,omitempty"`
	Collection      *StorageInventoryItem `gorm:"foreignKey:CollectionID" json:"collection,omitempty"`
}
