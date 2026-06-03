package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort      string
	DatabaseURL     string
	JWTSecret       string
	EthereumRPC     string
	ChainID         int64
	NFTContract     string
	Marketplace     string
	AuctionContract string
	PlatformFeeBps  uint64
	FeeRecipient    string
}

func Load() *Config {
	godotenv.Load()

	return &Config{
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/lianshishucang?sslmode=disable"),
		JWTSecret:       getEnv("JWT_SECRET", "change-me-in-production"),
		EthereumRPC:     getEnv("ETHEREUM_RPC", "https://eth-sepolia.g.alchemy.com/v2/demo"),
		ChainID:         getEnvInt("CHAIN_ID", 11155111),
		NFTContract:     getEnv("NFT_CONTRACT", ""),
		Marketplace:     getEnv("MARKETPLACE_CONTRACT", ""),
		AuctionContract: getEnv("AUCTION_CONTRACT", ""),
		PlatformFeeBps:  getEnvUint("PLATFORM_FEE_BPS", 250),
		FeeRecipient:    getEnv("FEE_RECIPIENT", "0x0000000000000000000000000000000000000000"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int64) int64 {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.ParseInt(val, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvUint(key string, fallback uint64) uint64 {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.ParseUint(val, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
