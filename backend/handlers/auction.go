package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lianshishucang/backend/config"
	"github.com/lianshishucang/backend/services"
	"gorm.io/gorm"
)

type AuctionHandler struct {
	db             *gorm.DB
	cfg            *config.Config
	auctionService *services.AuctionService
}

func NewAuctionHandler(db *gorm.DB, cfg *config.Config, auctionService *services.AuctionService) *AuctionHandler {
	return &AuctionHandler{db: db, cfg: cfg, auctionService: auctionService}
}

func (h *AuctionHandler) ListAuctions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	if pageSize > 100 {
		pageSize = 100
	}

	auctions, total, err := h.auctionService.ListAuctions(status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch auctions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"auctions": auctions,
		"total":    total,
		"page":     page,
	})
}

func (h *AuctionHandler) GetAuction(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid auction ID"})
		return
	}

	auction, err := h.auctionService.GetAuction(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "auction not found"})
		return
	}

	c.JSON(http.StatusOK, auction)
}
