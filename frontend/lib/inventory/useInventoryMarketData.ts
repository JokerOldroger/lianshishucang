import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  InventoryItemViewModel,
  InventoryMarketAuctionViewModel,
  InventoryMarketData,
  InventoryMarketListingViewModel,
  InventoryMarketNftViewModel,
} from '../../types/inventory';
import { ApiError } from '../api/client';
import {
  getAuctions,
  getMarketplaceListings,
  getMyCreatedNFTs,
  getMyOwnedNFTs,
  getNFT,
} from '../api/inventory';
import {
  adaptAuctionToMarketAuctionViewModel,
  adaptBackendNFTToDetailViewModel,
  adaptListingToMarketListingViewModel,
  buildInventoryMarketSummary,
} from './adapters';

const EMPTY_MARKET_DATA: InventoryMarketData = {
  listings: [],
  auctions: [],
  selectedNft: null,
  summary: {
    activeListings: 0,
    activeAuctions: 0,
    ownedNfts: 0,
    createdNfts: 0,
    selectedItemListed: false,
    selectedItemInAuction: false,
  },
};

interface UseInventoryMarketDataResult {
  market: InventoryMarketData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useInventoryMarketData(
  token: string,
  selectedItem?: InventoryItemViewModel,
): UseInventoryMarketDataResult {
  const [market, setMarket] = useState<InventoryMarketData>(EMPTY_MARKET_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMarketData = useCallback(async () => {
    if (!token) {
      setMarket(EMPTY_MARKET_DATA);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const listingsPromise = getMarketplaceListings(token, { page: 1, pageSize: 8 });
    const auctionsPromise = getAuctions(token, { page: 1, pageSize: 8, status: 'active' });
    const ownedPromise = getMyOwnedNFTs(token, { page: 1, pageSize: 1 });
    const createdPromise = getMyCreatedNFTs(token, { page: 1, pageSize: 1 });
    const selectedNftPromise = selectedItem?.nftId ? getNFT(token, selectedItem.nftId) : Promise.resolve(null);

    const [listingsResult, auctionsResult, ownedResult, createdResult, selectedNftResult] =
      await Promise.allSettled([
        listingsPromise,
        auctionsPromise,
        ownedPromise,
        createdPromise,
        selectedNftPromise,
      ]);

    const listings: InventoryMarketListingViewModel[] =
      listingsResult.status === 'fulfilled'
        ? listingsResult.value.listings.map((listing) =>
            adaptListingToMarketListingViewModel(listing, selectedItem?.nftId),
          )
        : [];

    const auctions: InventoryMarketAuctionViewModel[] =
      auctionsResult.status === 'fulfilled'
        ? auctionsResult.value.auctions.map((auction) =>
            adaptAuctionToMarketAuctionViewModel(auction, selectedItem?.nftId),
          )
        : [];

    const selectedNft: InventoryMarketNftViewModel | null =
      selectedNftResult.status === 'fulfilled' && selectedNftResult.value
        ? adaptBackendNFTToDetailViewModel(selectedNftResult.value)
        : null;

    const ownedNfts = ownedResult.status === 'fulfilled' ? ownedResult.value.total : 0;
    const createdNfts = createdResult.status === 'fulfilled' ? createdResult.value.total : 0;

    const summary = buildInventoryMarketSummary({
      listings,
      auctions,
      ownedNfts,
      createdNfts,
      selectedNftId: selectedItem?.nftId,
    });

    setMarket({
      listings,
      auctions,
      selectedNft,
      summary,
    });

    const failures = [listingsResult, auctionsResult, ownedResult, createdResult, selectedNftResult].filter(
      (result) => result.status === 'rejected',
    );

    setError(failures.length ? 'Some live market modules could not be loaded. Showing partial market visibility.' : null);
    setLoading(false);
  }, [selectedItem?.nftId, token]);

  useEffect(() => {
    void loadMarketData();
  }, [loadMarketData]);

  return useMemo(
    () => ({
      market,
      loading,
      error,
      refresh: loadMarketData,
    }),
    [error, loadMarketData, loading, market],
  );
}
