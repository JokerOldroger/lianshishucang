package services

import (
	"time"

	"github.com/lianshishucang/backend/config"
	"github.com/lianshishucang/backend/models"
	"gorm.io/gorm"
)

type AuctionService struct {
	db         *gorm.DB
	cfg        *config.Config
	nftService *NFTService
}

func NewAuctionService(db *gorm.DB, cfg *config.Config, nftService *NFTService) *AuctionService {
	return &AuctionService{db: db, cfg: cfg, nftService: nftService}
}

func (s *AuctionService) ListAuctions(status string, page, pageSize int) ([]models.Auction, int64, error) {
	var auctions []models.Auction
	var total int64
	query := s.db.Model(&models.Auction{})

	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	err := query.
		Preload("NFT").
		Preload("NFT.Owner").
		Preload("NFT.Creator").
		Preload("Seller").
		Preload("HighestBidder").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&auctions).Error

	return auctions, total, err
}

func (s *AuctionService) GetAuction(id uint) (*models.Auction, error) {
	var auction models.Auction
	err := s.db.
		Preload("NFT").
		Preload("Seller").
		Preload("HighestBidder").
		First(&auction, id).Error
	if err != nil {
		return nil, err
	}
	return &auction, nil
}

func (s *AuctionService) CreateAuction(
	nftID, sellerID uint,
	startPrice, reservePrice string,
	startTime, endTime time.Time,
) (*models.Auction, error) {
	auction := &models.Auction{
		NFTID:        nftID,
		SellerID:     sellerID,
		StartPrice:   startPrice,
		ReservePrice: reservePrice,
		StartTime:    startTime,
		EndTime:      endTime,
		Status:       "pending",
	}

	if err := s.db.Create(auction).Error; err != nil {
		return nil, err
	}

	s.nftService.logActivity(&nftID, sellerID, "auction_created",
		"start: "+startPrice+" reserve: "+reservePrice, "")
	return auction, nil
}

func (s *AuctionService) PlaceBid(auctionID, bidderID uint, amount string) error {
	auction, err := s.GetAuction(auctionID)
	if err != nil {
		return err
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Auction{}).Where("id = ?", auctionID).Updates(map[string]interface{}{
			"highest_bid":       amount,
			"highest_bidder_id": bidderID,
			"status":            "active",
		}).Error; err != nil {
			return err
		}

		s.nftService.logActivity(&auction.NFTID, bidderID, "bid_placed",
			"amount: "+amount+" wei", "")
		return nil
	})
}

func (s *AuctionService) EndAuction(auctionID uint) error {
	if _, err := s.GetAuction(auctionID); err != nil {
		return err
	}

	return s.db.Model(&models.Auction{}).Where("id = ?", auctionID).
		Update("status", "ended").Error
}

func (s *AuctionService) SettleAuction(auctionID, winnerID uint, finalPrice string) error {
	auction, err := s.GetAuction(auctionID)
	if err != nil {
		return err
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Auction{}).Where("id = ?", auctionID).Updates(map[string]interface{}{
			"status":      "settled",
			"winner_id":   winnerID,
			"final_price": finalPrice,
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.NFT{}).Where("id = ?", auction.NFTID).
			Update("owner_id", winnerID).Error; err != nil {
			return err
		}

		txLog := &models.Transaction{
			FromID: auction.SellerID,
			ToID:   winnerID,
			NFTID:  &auction.NFTID,
			Type:   "auction_purchase",
			Amount: finalPrice,
			Status: "confirmed",
		}
		if err := tx.Create(txLog).Error; err != nil {
			return err
		}

		s.nftService.logActivity(&auction.NFTID, winnerID, "auction_won",
			"final_price: "+finalPrice+" wei", "")
		return nil
	})
}

func (s *AuctionService) CancelAuction(auctionID uint) error {
	return s.db.Model(&models.Auction{}).Where("id = ?", auctionID).
		Update("status", "cancelled").Error
}

func (s *AuctionService) GetActiveAuctions(page, pageSize int) ([]models.Auction, int64, error) {
	return s.ListAuctions("active", page, pageSize)
}
