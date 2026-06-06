export const SUPPORTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 11155111;

export const NFT_CONTRACT_ADDRESS =
  (import.meta.env.VITE_NFT_CONTRACT as string) || '';

export const MARKETPLACE_CONTRACT_ADDRESS =
  (import.meta.env.VITE_MARKETPLACE_CONTRACT as string) || '';

export const AUCTION_CONTRACT_ADDRESS =
  (import.meta.env.VITE_AUCTION_CONTRACT as string) || '';

export const CHAIN_CONFIG: Record<number, { name: string; currency: string; rpc: string }> = {
  1: { name: 'Ethereum Mainnet', currency: 'ETH', rpc: 'https://eth-mainnet.g.alchemy.com/v2/demo' },
  11155111: { name: 'Sepolia', currency: 'ETH', rpc: 'https://eth-sepolia.g.alchemy.com/v2/demo' },
  31337: { name: 'Hardhat Local', currency: 'ETH', rpc: 'http://127.0.0.1:8545' },
};
