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

	authHandler := handlers.NewAuthHandler(db, cfg)
	nftHandler := handlers.NewNFTHandler(db, cfg, nftService)
	marketplaceHandler := handlers.NewMarketplaceHandler(db, cfg, marketplaceService)
	auctionHandler := handlers.NewAuctionHandler(db, cfg, auctionService)

	public := r.Group("/api/v1")
	{
		public.GET("/auth/nonce/:address", authHandler.GetNonce)
		public.POST("/auth/login", authHandler.Login)
		public.GET("/users/:address", authHandler.GetUserByAddress)
		public.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "service": "链识数藏"})
		})
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
	}
}
