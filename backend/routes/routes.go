package routes

import (
	"github.com/lianshishucang/backend/config"
	"github.com/lianshishucang/backend/handlers"
	"github.com/lianshishucang/backend/middleware"
	"github.com/lianshishucang/backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterRoutes(r *gin.Engine, db *gorm.DB, cfg *config.Config) {
	var blockchainService *services.BlockchainService
	if cfg.NFTContract != "" && cfg.Marketplace != "" && cfg.AuctionContract != "" {
		bc, err := services.NewBlockchainService(
			cfg.EthereumRPC,
			cfg.ChainID,
			"",
			"", "", "",
			cfg.NFTContract,
			cfg.Marketplace,
			cfg.AuctionContract,
		)
		if err == nil {
			blockchainService = bc
		}
	}
	nftService := services.NewNFTService(db, cfg, blockchainService)
	marketplaceService := services.NewMarketplaceService(db, cfg, nftService)
	auctionService := services.NewAuctionService(db, cfg, nftService)
	gemmaService := services.NewGemmaService(cfg)
	aigcService := services.NewAIGCService(db, cfg)
	compositingService := services.NewCompositingService(cfg)
	ipfsService := services.NewIPFSService(db, cfg)
	storageService := services.NewStorageService(db)
	diagnosticService := services.NewCabinetDiagnosticService(db, storageService, gemmaService)

	authHandler := handlers.NewAuthHandler(db, cfg)
	nftHandler := handlers.NewNFTHandler(db, cfg, nftService)
	marketplaceHandler := handlers.NewMarketplaceHandler(db, cfg, marketplaceService)
	auctionHandler := handlers.NewAuctionHandler(db, cfg, auctionService)
	collectionHandler := handlers.NewCollectionHandler(db, cfg, gemmaService)
	aigcHandler := handlers.NewAIGCHandler(db, cfg, aigcService, compositingService)
	web3Handler := handlers.NewWeb3Handler(db, cfg, ipfsService)
	hardwareHandler := handlers.NewHardwareHandler(storageService)
	storageHandler := handlers.NewStorageHandler(storageService, diagnosticService)

	public := r.Group("/api/v1")
	{
		public.GET("/auth/nonce/:address", authHandler.GetNonce)
		public.POST("/auth/login", authHandler.Login)
		public.GET("/users/:address", authHandler.GetUserByAddress)
		public.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "service": "链识数藏"})
		})

		public.POST("/hw/telemetry", hardwareHandler.RecordTelemetry)
		public.GET("/hw/commands/:cabinet_code", hardwareHandler.GetCabinetCommands)
	}

	protected := r.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.GET("/profile", authHandler.GetProfile)
		protected.PUT("/profile", authHandler.UpdateProfile)

		protected.POST("/nfts/metadata", nftHandler.RegisterMetadata)
		protected.GET("/nfts", nftHandler.ListNFTs)
		protected.GET("/nfts/:id", nftHandler.GetNFT)
		protected.GET("/nfts/my/owned", nftHandler.GetMyNFTs)
		protected.GET("/nfts/my/created", nftHandler.GetCreatedNFTs)

		protected.GET("/marketplace/listings", marketplaceHandler.ListListings)
		protected.GET("/marketplace/listings/:id", marketplaceHandler.GetListing)

		protected.GET("/auctions", auctionHandler.ListAuctions)
		protected.GET("/auctions/:id", auctionHandler.GetAuction)

		protected.POST("/collections/upload", collectionHandler.UploadAndIdentifyCollectible)
		protected.GET("/collections", collectionHandler.ListCollections)
		protected.GET("/collections/:id", collectionHandler.GetCollection)
		protected.PUT("/collections/:id", collectionHandler.UpdateCollection)
		protected.POST("/collections/:id/generate-card", aigcHandler.GenerateCard)
		protected.GET("/collections/:id/card-status", aigcHandler.GetCardStatus)
		protected.POST("/collections/:id/prepare-mint", web3Handler.PrepareMint)

		protected.POST("/storage/cabinets/:id/diagnose", storageHandler.DiagnoseCabinet)
		protected.POST("/storage/cabinets/:id/apply-settings", storageHandler.ApplySettings)
	}
}
