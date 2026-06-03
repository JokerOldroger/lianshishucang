package main

import (
	"context"
	"log"

	"github.com/lianshishucang/backend/config"
	"github.com/lianshishucang/backend/middleware"
	"github.com/lianshishucang/backend/migrations"
	"github.com/lianshishucang/backend/routes"
	"github.com/lianshishucang/backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := migrations.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	if cfg.NFTContract != "" && cfg.EthereumRPC != "" {
		listener, err := services.NewEventListener(cfg, db)
		if err != nil {
			log.Printf("Warning: failed to create event listener: %v", err)
		} else {
			ctx := context.Background()
			go listener.Start(ctx)
			log.Println("Event listener started")
		}
	}

	r := gin.Default()
	r.Use(middleware.CORS())

	routes.RegisterRoutes(r, db, cfg)

	addr := ":" + cfg.ServerPort
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
