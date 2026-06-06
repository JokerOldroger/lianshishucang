import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../lib/web3/useWallet';
import { useContractWrite } from '../../lib/web3/useContractWrite';
import { NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS, AUCTION_CONTRACT_ADDRESS } from '../../lib/web3/config';
import InventoryDetailPanel from './InventoryDetailPanel';
import InventoryEmptyState from './InventoryEmptyState';
import InventorySectionFrame from './InventorySectionFrame';
import type {
  InventoryItemViewModel,
  InventoryMarketAuctionViewModel,
  InventoryMarketData,
  InventoryMarketListingViewModel,
  InventoryMarketOfferViewModel,
} from '../../types/inventory';

interface InventoryTradingMarketPanelProps {
  market: InventoryMarketData;
  loading: boolean;
  error: string | null;
  selectedItem?: InventoryItemViewModel;
}

export default function InventoryTradingMarketPanel({
  market,
  loading,
  error,
  selectedItem,
}: InventoryTradingMarketPanelProps) {
  const wallet = useWallet();
  const contract = useContractWrite();
  const [actionState, setActionState] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: string; message: string } | null>(null);

  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [listPriceEth, setListPriceEth] = useState('');

  const [bidAuctionId, setBidAuctionId] = useState<number | null>(null);
  const [bidAmountEth, setBidAmountEth] = useState('');

  const [updatePriceListingId, setUpdatePriceListingId] = useState<number | null>(null);
  const [updatePriceEth, setUpdatePriceEth] = useState('');

  const [offerListingId, setOfferListingId] = useState<number | null>(null);
  const [offerPriceEth, setOfferPriceEth] = useState('');
  const [offerExpirationHours, setOfferExpirationHours] = useState('48');

  const [showCreateAuction, setShowCreateAuction] = useState(false);
  const [auctionStartPriceEth, setAuctionStartPriceEth] = useState('');
  const [auctionReservePriceEth, setAuctionReservePriceEth] = useState('');
  const [auctionDurationHours, setAuctionDurationHours] = useState('24');

  const [offers, setOffers] = useState<InventoryMarketOfferViewModel[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [refundAmounts, setRefundAmounts] = useState<Record<number, string>>({});

  const clearNotice = () => setActionNotice(null);

  const loadOffers = useCallback(async () => {
    if (!selectedItem?.nftId) {
      setOffers([]);
      return;
    }
    setOffersLoading(true);
    try {
      const rawOffers = await contract.getOffersForToken(selectedItem.nftId);
      const now = Math.floor(Date.now() / 1000);
      const mapped: InventoryMarketOfferViewModel[] = rawOffers
        .filter((o: any) => o.active)
        .map((o: any) => ({
          id: `offer-${o.offerId}`,
          offerId: o.offerId.toString(),
          tokenId: Number(o.tokenId),
          nftContract: o.nftContract,
          bidder: o.bidder,
          bidderLabel: wallet.formatAddress(o.bidder),
          priceWei: o.price.toString(),
          priceEthLabel: formatWei(o.price.toString()),
          expiration: Number(o.expiration),
          active: o.active,
          createdAt: Number(o.createdAt),
          isExpired: Number(o.expiration) < now,
        }));
      setOffers(mapped);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }, [selectedItem?.nftId, contract, wallet]);

  const loadRefundAmounts = useCallback(async () => {
    if (!wallet.address) return;
    const amounts: Record<number, string> = {};
    for (const auction of market.auctions) {
      const aid = Number(auction.auctionId);
      try {
        const amt = await contract.getRefundAmount(aid, wallet.address);
        if (amt > 0n) {
          amounts[aid] = amt.toString();
        }
      } catch {
        // skip
      }
    }
    setRefundAmounts(amounts);
  }, [market.auctions, wallet.address, contract]);

  useEffect(() => {
    if (selectedItem?.nftId) {
      void loadOffers();
    } else {
      setOffers([]);
    }
  }, [selectedItem?.nftId, loadOffers]);

  useEffect(() => {
    void loadRefundAmounts();
  }, [loadRefundAmounts]);

  const requireWallet = () => {
    if (!wallet.isConnected) {
      setActionNotice({ tone: 'error', message: 'Connect your wallet first (Access tab).' });
      return false;
    }
    if (!wallet.isCorrectChain) {
      setActionNotice({ tone: 'error', message: 'Switch to the correct network.' });
      return false;
    }
    return true;
  };

  const handleBuy = async (listingId: number, priceWei: string) => {
    if (!requireWallet()) return;
    setActionState(`buy-${listingId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm the purchase in MetaMask…' });
    try {
      const hash = await contract.buyItem(listingId, priceWei);
      setActionNotice({ tone: 'success' as const, message: `Purchased! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Purchase failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCancelListing = async (listingId: number) => {
    if (!requireWallet()) return;
    setActionState(`cancel-${listingId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm cancellation in MetaMask…' });
    try {
      const hash = await contract.cancelListing(listingId);
      setActionNotice({ tone: 'success' as const, message: `Listing cancelled! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Cancel failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCreateListing = async () => {
    if (!requireWallet()) return;
    if (!selectedItem?.nftId || !listPriceEth) return;
    const priceWei = BigInt(Math.floor(parseFloat(listPriceEth) * 1e18)).toString();
    setActionState('create-listing');
    setActionNotice({ tone: 'info' as const, message: 'Confirm listing in MetaMask…' });
    try {
      const hash = await contract.createListing(NFT_CONTRACT_ADDRESS, selectedItem.nftId, priceWei);
      setActionNotice({ tone: 'success' as const, message: `Listed! Tx: ${hash.slice(0, 10)}…` });
      setCreateListingOpen(false);
      setListPriceEth('');
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Listing failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleApprove = async () => {
    if (!requireWallet() || !selectedItem?.nftId) return;
    setActionState('approve');
    setActionNotice({ tone: 'info' as const, message: 'Confirm approval in MetaMask…' });
    try {
      const hash = await contract.approveNFT(NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS, selectedItem.nftId);
      setActionNotice({ tone: 'success' as const, message: `Approved! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Approval failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handlePlaceBid = async (auctionId: number) => {
    if (!requireWallet() || !bidAmountEth) return;
    const valueWei = BigInt(Math.floor(parseFloat(bidAmountEth) * 1e18)).toString();
    setActionState(`bid-${auctionId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm bid in MetaMask…' });
    try {
      const hash = await contract.placeBid(auctionId, valueWei);
      setActionNotice({ tone: 'success' as const, message: `Bid placed! Tx: ${hash.slice(0, 10)}…` });
      setBidAuctionId(null);
      setBidAmountEth('');
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Bid failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleEndAuction = async (auctionId: number) => {
    if (!requireWallet()) return;
    setActionState(`end-${auctionId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm end auction in MetaMask…' });
    try {
      const hash = await contract.endAuction(auctionId);
      setActionNotice({ tone: 'success' as const, message: `Auction ended! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'End auction failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleSettleAuction = async (auctionId: number) => {
    if (!requireWallet()) return;
    setActionState(`settle-${auctionId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm settlement in MetaMask…' });
    try {
      const hash = await contract.settleAuction(auctionId);
      setActionNotice({ tone: 'success' as const, message: `Settled! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Settlement failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleUpdatePrice = async (listingId: number) => {
    if (!requireWallet() || !updatePriceEth) return;
    const newPriceWei = BigInt(Math.floor(parseFloat(updatePriceEth) * 1e18)).toString();
    setActionState(`update-price-${listingId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm price update in MetaMask…' });
    try {
      const hash = await contract.updatePrice(listingId, newPriceWei);
      setActionNotice({ tone: 'success' as const, message: `Price updated! Tx: ${hash.slice(0, 10)}…` });
      setUpdatePriceListingId(null);
      setUpdatePriceEth('');
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Update price failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCreateOffer = async (nftContract: string, tokenId: number) => {
    if (!requireWallet() || !offerPriceEth) return;
    const priceWei = BigInt(Math.floor(parseFloat(offerPriceEth) * 1e18)).toString();
    const hours = parseInt(offerExpirationHours) || 48;
    const expiration = Math.floor(Date.now() / 1000) + hours * 3600;
    setActionState(`create-offer-${tokenId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm offer in MetaMask…' });
    try {
      const hash = await contract.createOffer(nftContract, tokenId, priceWei, expiration);
      setActionNotice({ tone: 'success' as const, message: `Offer created! Tx: ${hash.slice(0, 10)}…` });
      setOfferListingId(null);
      setOfferPriceEth('');
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Create offer failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCancelOffer = async (tokenId: number, offerIndex: number) => {
    if (!requireWallet()) return;
    setActionState(`cancel-offer-${offerIndex}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm cancel offer in MetaMask…' });
    try {
      const hash = await contract.cancelOffer(tokenId, offerIndex);
      setActionNotice({ tone: 'success' as const, message: `Offer cancelled! Tx: ${hash.slice(0, 10)}…` });
      void loadOffers();
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Cancel offer failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleAcceptOffer = async (nftContract: string, tokenId: number, offerIndex: number) => {
    if (!requireWallet()) return;
    setActionState(`accept-offer-${offerIndex}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm accept offer in MetaMask…' });
    try {
      const hash = await contract.acceptOffer(nftContract, tokenId, offerIndex);
      setActionNotice({ tone: 'success' as const, message: `Offer accepted! Tx: ${hash.slice(0, 10)}…` });
      void loadOffers();
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Accept offer failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCreateAuction = async () => {
    if (!requireWallet() || !selectedItem?.nftId) return;
    const startPriceWei = BigInt(Math.floor(parseFloat(auctionStartPriceEth || '0') * 1e18)).toString();
    const reservePriceWei = BigInt(Math.floor(parseFloat(auctionReservePriceEth || '0') * 1e18)).toString();
    if (parseFloat(auctionStartPriceEth) <= 0) return;
    const duration = parseInt(auctionDurationHours) || 24;
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + duration * 3600;
    setActionState('create-auction');
    setActionNotice({ tone: 'info' as const, message: 'Confirm create auction in MetaMask…' });
    try {
      const hash = await contract.createAuction(
        NFT_CONTRACT_ADDRESS,
        selectedItem.nftId,
        startPriceWei,
        reservePriceWei,
        startTime,
        endTime,
      );
      setActionNotice({ tone: 'success' as const, message: `Auction created! Tx: ${hash.slice(0, 10)}…` });
      setShowCreateAuction(false);
      setAuctionStartPriceEth('');
      setAuctionReservePriceEth('');
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Create auction failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleCancelAuction = async (auctionId: number) => {
    if (!requireWallet()) return;
    setActionState(`cancel-auction-${auctionId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm cancel auction in MetaMask…' });
    try {
      const hash = await contract.cancelAuction(auctionId);
      setActionNotice({ tone: 'success' as const, message: `Auction cancelled! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Cancel auction failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleClaimRefund = async (auctionId: number) => {
    if (!requireWallet()) return;
    setActionState(`claim-refund-${auctionId}`);
    setActionNotice({ tone: 'info' as const, message: 'Confirm claim refund in MetaMask…' });
    try {
      const hash = await contract.claimRefund(auctionId);
      setActionNotice({ tone: 'success' as const, message: `Refund claimed! Tx: ${hash.slice(0, 10)}…` });
      setRefundAmounts((prev) => {
        const next = { ...prev };
        delete next[auctionId];
        return next;
      });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Claim refund failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleSetApprovalForAll = async () => {
    if (!requireWallet()) return;
    setActionState('approve-all');
    setActionNotice({ tone: 'info' as const, message: 'Confirm approval in MetaMask…' });
    try {
      const hash = await contract.setApprovalForAll(NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS, true);
      setActionNotice({ tone: 'success' as const, message: `Approved all! Tx: ${hash.slice(0, 10)}…` });
    } catch (err: unknown) {
      setActionNotice({
        tone: 'error' as const,
        message: err instanceof Error ? err.message : 'Approval failed',
      });
    } finally {
      setActionState(null);
    }
  };

  const selectedPresence = [
    {
      label: 'NFT Linked',
      value: market.selectedNft ? market.selectedNft.tokenId : 'Pending',
      active: Boolean(market.selectedNft),
    },
    {
      label: 'Listed',
      value: market.summary.selectedItemListed ? 'Live' : 'No',
      active: market.summary.selectedItemListed,
    },
    {
      label: 'In Auction',
      value: market.summary.selectedItemInAuction ? 'Live' : 'No',
      active: market.summary.selectedItemInAuction,
    },
    {
      label: 'Owner',
      value: market.selectedNft?.ownerLabel ?? 'Unavailable',
      active: Boolean(market.selectedNft?.ownerLabel),
    },
  ];

  const canList =
    Boolean(selectedItem?.nftId) &&
    wallet.isConnected &&
    wallet.isCorrectChain &&
    !market.summary.selectedItemListed &&
    !market.summary.selectedItemInAuction;

  return (
    <div className="space-y-6">
      {actionNotice ? (
        <div
          onClick={clearNotice}
          className={[
            'cursor-pointer rounded-2xl border px-4 py-3 text-base',
            actionNotice.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-100'
              : actionNotice.tone === 'error'
                ? 'border-rose-300/20 bg-rose-300/8 text-rose-100'
                : 'border-cyan-300/20 bg-cyan-300/8 text-cyan-100',
          ].join(' ')}
        >
          {actionNotice.message}
        </div>
      ) : null}

      <InventorySectionFrame title="Market Visibility" contentClassName="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Active Listings" value={market.summary.activeListings} />
          <SummaryCard label="Active Auctions" value={market.summary.activeAuctions} />
          <SummaryCard label="My Owned NFTs" value={market.summary.ownedNfts} />
          <SummaryCard label="My Created NFTs" value={market.summary.createdNfts} />
        </div>

        {!wallet.isConnected ? (
          <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-base text-yellow-100">
            Connect your wallet (Access tab) to trade NFTs on-chain.
          </div>
        ) : !wallet.isCorrectChain ? (
          <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-base text-yellow-100">
            Wrong network — switch to the correct chain.
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-base text-yellow-100">
            Loading…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/8 px-4 py-3 text-base text-rose-100">
            {error}
          </div>
        ) : null}
      </InventorySectionFrame>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="space-y-6">
          <InventorySectionFrame title="Selected Item Market Presence" contentClassName="space-y-4">
            <div className="rounded-[1.35rem] border border-cyan-400/15 bg-[#071523]/75 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
                Trading Focus
              </p>
              <p className="mt-3 text-xl font-medium text-white">
                {selectedItem?.name ?? '—'}
              </p>
              <p className="mt-1 text-base text-slate-300/70">
                {selectedItem?.displayCode ?? '—'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {selectedPresence.map((entry) => (
                <div key={entry.label} className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/60">
                    {entry.label}
                  </p>
                  <p className="mt-3 break-all text-base font-medium text-white">{entry.value}</p>
                  <span
                    className={[
                      'mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]',
                      entry.active
                        ? 'border-emerald-300/25 bg-emerald-300/8 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-slate-400',
                    ].join(' ')}
                  >
                    {entry.active ? 'Live' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {selectedItem?.nftId ? (
              <div className="flex flex-wrap gap-3 rounded-[1.5rem] border border-white/6 bg-[#07101a]/80 p-4 backdrop-blur-lg">
                <button
                  type="button"
                  disabled={actionState === 'approve'}
                  onClick={handleApprove}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-base font-medium text-cyan-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  {actionState === 'approve' ? 'Approving…' : 'Approve NFT'}
                </button>
                <button
                  type="button"
                  disabled={actionState === 'approve-all'}
                  onClick={handleSetApprovalForAll}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-base font-medium text-cyan-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  {actionState === 'approve-all' ? 'Approving…' : 'Approve All'}
                </button>
                <button
                  type="button"
                  disabled={!canList || actionState === 'create-listing'}
                  onClick={() => setCreateListingOpen(true)}
                  className="rounded-xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-base font-medium text-yellow-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  {actionState === 'create-listing' ? 'Listing…' : 'Create Listing'}
                </button>

                {createListingOpen ? (
                  <div className="flex w-full flex-wrap items-end gap-3">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/60">
                        Price (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={listPriceEth}
                        onChange={(e) => setListPriceEth(e.target.value)}
                        placeholder="0.1"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!listPriceEth || parseFloat(listPriceEth) <= 0}
                      onClick={handleCreateListing}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-5 py-3 text-base font-medium text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreateListingOpen(false); setListPriceEth(''); }}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-base font-medium text-slate-200 transition hover:border-rose-300/20 hover:bg-rose-300/8 hover:text-rose-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={market.summary.selectedItemInAuction || actionState === 'create-auction'}
                  onClick={() => setShowCreateAuction(true)}
                  className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/8 px-4 py-3 text-base font-medium text-fuchsia-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  {actionState === 'create-auction' ? 'Creating…' : 'Create Auction'}
                </button>

                {showCreateAuction ? (
                  <div className="flex w-full flex-wrap items-end gap-3">
                    <label className="min-w-0 flex-[1_1_120px]">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/60">
                        Start Price (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={auctionStartPriceEth}
                        onChange={(e) => setAuctionStartPriceEth(e.target.value)}
                        placeholder="0.1"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <label className="min-w-0 flex-[1_1_120px]">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/60">
                        Reserve Price (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={auctionReservePriceEth}
                        onChange={(e) => setAuctionReservePriceEth(e.target.value)}
                        placeholder="0.2"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <label className="min-w-0 flex-[1_1_100px]">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/60">
                        Duration (hrs)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={auctionDurationHours}
                        onChange={(e) => setAuctionDurationHours(e.target.value)}
                        placeholder="24"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!auctionStartPriceEth || parseFloat(auctionStartPriceEth) <= 0}
                      onClick={handleCreateAuction}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-5 py-3 text-base font-medium text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateAuction(false); setAuctionStartPriceEth(''); setAuctionReservePriceEth(''); }}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-base font-medium text-slate-200 transition hover:border-rose-300/20 hover:bg-rose-300/8 hover:text-rose-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedItem?.nftId ? (
              <InventorySectionFrame title="Offers on Selected Item" contentClassName="space-y-4">
                {offersLoading ? (
                  <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-base text-yellow-100">
                    Loading offers…
                  </div>
                ) : offers.length > 0 ? (
                  <div className="grid gap-3">
                    {offers.map((offer, idx) => {
                      const isOwnOffer = wallet.isConnected && offer.bidder.toLowerCase() === wallet.address.toLowerCase();
                      const isOwner = wallet.isConnected && market.selectedNft?.ownerLabel && market.selectedNft.ownerLabel.toLowerCase().includes(wallet.address.toLowerCase().slice(2, 8));
                      return (
                        <div key={offer.id} className="rounded-[1.35rem] border border-white/8 bg-white/5 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-medium text-white">
                                {offer.priceEthLabel} — by {offer.bidderLabel}
                              </p>
                              <p className="mt-1 text-sm text-slate-300/70">
                                {offer.isExpired ? 'Expired' : new Date(offer.expiration * 1000).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {offer.isExpired ? (
                                <span className="rounded-full border border-rose-300/20 bg-rose-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-100">
                                  Expired
                                </span>
                              ) : (
                                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                                  Active
                                </span>
                              )}
                              {isOwnOffer ? (
                                <button
                                  type="button"
                                  disabled={actionState === `cancel-offer-${idx}`}
                                  onClick={() => handleCancelOffer(offer.tokenId, idx)}
                                  className="rounded-xl border border-rose-300/15 bg-rose-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {actionState === `cancel-offer-${idx}` ? 'Cancelling…' : 'Cancel'}
                                </button>
                              ) : null}
                              {isOwner && !offer.isExpired ? (
                                <button
                                  type="button"
                                  disabled={actionState === `accept-offer-${idx}`}
                                  onClick={() => handleAcceptOffer(offer.nftContract, offer.tokenId, idx)}
                                  className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {actionState === `accept-offer-${idx}` ? 'Accepting…' : 'Accept'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[1.35rem] border border-white/8 bg-white/5 p-4">
                    <p className="text-base text-slate-300/70">No offers yet for this item.</p>
                  </div>
                )}
              </InventorySectionFrame>
            ) : null}
          </InventorySectionFrame>

          <InventorySectionFrame title="Activity & Transactions" contentClassName="space-y-4">
            <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
              <span className="inline-flex rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-yellow-100">
                Chain events sync automatically via backend listener
              </span>
            </div>
          </InventorySectionFrame>

          <div className="grid gap-6 xl:grid-cols-2">
            <MarketListSection
              title="Marketplace Listings"
              items={market.listings}
              emptyTitle="No Active Listings"
              emptyMessage="No active listings"
              renderItem={(item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  actionState={actionState}
                  wallet={wallet}
                  onBuy={() => handleBuy(Number(item.listingId), item.priceWei)}
                  onCancel={() => handleCancelListing(Number(item.listingId))}
                  onUpdatePriceOpen={() => {
                    setUpdatePriceListingId(Number(item.listingId));
                    setUpdatePriceEth('');
                  }}
                  onUpdatePriceConfirm={() => handleUpdatePrice(Number(item.listingId))}
                  updatePriceOpen={updatePriceListingId === Number(item.listingId)}
                  updatePriceEth={updatePriceEth}
                  onUpdatePriceEthChange={setUpdatePriceEth}
                  onOfferOpen={() => {
                    setOfferListingId(Number(item.listingId));
                    setOfferPriceEth('');
                  }}
                  onOfferConfirm={(nftContract, tokenId) => handleCreateOffer(nftContract, tokenId)}
                  offerOpen={offerListingId === Number(item.listingId)}
                  offerPriceEth={offerPriceEth}
                  onOfferPriceEthChange={setOfferPriceEth}
                  offerExpirationHours={offerExpirationHours}
                  onOfferExpirationHoursChange={setOfferExpirationHours}
                />
              )}
            />

            <MarketListSection
              title="Auction Board"
              items={market.auctions}
              emptyTitle="No Active Auctions"
              emptyMessage="No active auctions"
              renderItem={(item) => (
                <AuctionCard
                  key={item.id}
                  item={item}
                  actionState={actionState}
                  bidAuctionId={bidAuctionId}
                  bidAmountEth={bidAmountEth}
                  wallet={wallet}
                  refundWei={refundAmounts[Number(item.auctionId)]}
                  onBidOpen={() => setBidAuctionId(Number(item.auctionId))}
                  onBidClose={() => { setBidAuctionId(null); setBidAmountEth(''); }}
                  onBidAmountChange={setBidAmountEth}
                  onPlaceBid={() => handlePlaceBid(Number(item.auctionId))}
                  onEndAuction={() => handleEndAuction(Number(item.auctionId))}
                  onSettle={() => handleSettleAuction(Number(item.auctionId))}
                  onCancelAuction={() => handleCancelAuction(Number(item.auctionId))}
                  onClaimRefund={() => handleClaimRefund(Number(item.auctionId))}
                />
              )}
            />
          </div>
        </div>

        <div className="space-y-6">
          <InventoryDetailPanel item={selectedItem} />
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
}

function formatWei(wei: string): string {
  try {
    const value = BigInt(wei || '0');
    const whole = value / 1000000000000000000n;
    const fraction = value % 1000000000000000000n;
    const fractionString = fraction.toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '');
    return fractionString ? `${whole}.${fractionString} ETH` : `${whole} ETH`;
  } catch {
    return '—';
  }
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-[1.35rem] border border-cyan-400/12 bg-[#08131f]/75 p-4 shadow-[0_0_18px_rgba(34,211,238,0.06)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300/65">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

interface MarketListSectionProps<T> {
  title: string;
  items: T[];
  emptyTitle: string;
  emptyMessage: string;
  renderItem: (item: T) => React.ReactNode;
}

function MarketListSection<T>({
  title,
  items,
  emptyTitle,
  emptyMessage,
  renderItem,
}: MarketListSectionProps<T>) {
  return (
    <InventorySectionFrame title={title} contentClassName="space-y-4">
      {items.length ? (
        <div className="grid gap-4">{items.map((item) => renderItem(item))}</div>
      ) : (
        <InventoryEmptyState title={emptyTitle} message={emptyMessage} />
      )}
    </InventorySectionFrame>
  );
}

interface ListingCardProps {
  item: InventoryMarketListingViewModel;
  actionState: string | null;
  wallet: { isConnected: boolean; isCorrectChain: boolean; address: string };
  onBuy: () => void;
  onCancel: () => void;
  onUpdatePriceOpen?: () => void;
  onUpdatePriceConfirm?: (newPriceEth: string) => void;
  updatePriceOpen?: boolean;
  updatePriceEth?: string;
  onUpdatePriceEthChange?: (val: string) => void;
  onOfferOpen?: () => void;
  onOfferConfirm?: (nftContract: string, tokenId: number) => void;
  offerOpen?: boolean;
  offerPriceEth?: string;
  onOfferPriceEthChange?: (val: string) => void;
  offerExpirationHours?: string;
  onOfferExpirationHoursChange?: (val: string) => void;
}

function ListingCard({
  item,
  actionState,
  wallet,
  onBuy,
  onCancel,
  onUpdatePriceOpen,
  onUpdatePriceConfirm,
  updatePriceOpen,
  updatePriceEth,
  onUpdatePriceEthChange,
  onOfferOpen,
  onOfferConfirm,
  offerOpen,
  offerPriceEth,
  onOfferPriceEthChange,
  offerExpirationHours,
  onOfferExpirationHoursChange,
}: ListingCardProps) {
  const isOwn = wallet.isConnected && item.sellerLabel.toLowerCase().includes(wallet.address.toLowerCase().slice(2, 8));
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
      <div className="flex gap-4">
        <img src={item.imageUrl} alt={item.title} className="h-24 w-24 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-medium text-white">{item.title}</p>
              <p className="mt-1 text-base text-slate-300/70">Seller: {item.sellerLabel}</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
              {item.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{item.priceEthLabel}</span>
            {item.isSelectedItemMatch ? (
              <span className="rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-yellow-100">
                Match
              </span>
            ) : null}
            {isOwn ? (
              <>
                <button
                  type="button"
                  disabled={actionState === `cancel-${item.listingId}`}
                  onClick={onCancel}
                  className="rounded-xl border border-rose-300/15 bg-rose-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `cancel-${item.listingId}` ? 'Cancelling…' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={actionState === `update-price-${item.listingId}`}
                  onClick={onUpdatePriceOpen}
                  className="rounded-xl border border-yellow-300/15 bg-yellow-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yellow-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `update-price-${item.listingId}` ? 'Updating…' : 'Update Price'}
                </button>
                {updatePriceOpen ? (
                  <div className="flex w-full flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
                        New Price (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={updatePriceEth}
                        onChange={(e) => onUpdatePriceEthChange?.(e.target.value)}
                        placeholder="0.1"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!updatePriceEth || parseFloat(updatePriceEth) <= 0}
                      onClick={() => onUpdatePriceConfirm?.(updatePriceEth || '0')}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={
                    !wallet.isConnected ||
                    !wallet.isCorrectChain ||
                    actionState === `buy-${item.listingId}`
                  }
                  onClick={onBuy}
                  className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `buy-${item.listingId}` ? 'Buying…' : 'Buy'}
                </button>
                <button
                  type="button"
                  disabled={actionState === `create-offer-${item.nftId}`}
                  onClick={onOfferOpen}
                  className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-fuchsia-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `create-offer-${item.nftId}` ? 'Offering…' : 'Make Offer'}
                </button>
                {offerOpen ? (
                  <div className="flex w-full flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-[1_1_100px]">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
                        Price (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={offerPriceEth}
                        onChange={(e) => onOfferPriceEthChange?.(e.target.value)}
                        placeholder="0.1"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <label className="min-w-0 flex-[1_1_80px]">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
                        Expires (hrs)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={offerExpirationHours}
                        onChange={(e) => onOfferExpirationHoursChange?.(e.target.value)}
                        placeholder="48"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!offerPriceEth || parseFloat(offerPriceEth) <= 0}
                      onClick={() => onOfferConfirm?.(item.nftContract || '', item.nftId || 0)}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AuctionCardProps {
  item: InventoryMarketAuctionViewModel;
  actionState: string | null;
  bidAuctionId: number | null;
  bidAmountEth: string;
  wallet: { isConnected: boolean; isCorrectChain: boolean; address: string };
  refundWei?: string;
  onBidOpen: () => void;
  onBidClose: () => void;
  onBidAmountChange: (val: string) => void;
  onPlaceBid: () => void;
  onEndAuction: () => void;
  onSettle: () => void;
  onCancelAuction?: () => void;
  onClaimRefund?: () => void;
}

function AuctionCard({
  item,
  actionState,
  bidAuctionId,
  bidAmountEth,
  wallet,
  refundWei,
  onBidOpen,
  onBidClose,
  onBidAmountChange,
  onPlaceBid,
  onEndAuction,
  onSettle,
  onCancelAuction,
  onClaimRefund,
}: AuctionCardProps) {
  const isActive = item.status === 'active' || item.status === 'pending';
  const isEnded = item.status === 'ended';
  const aid = Number(item.auctionId);
  const isBidding = bidAuctionId === aid;
  const isOwn = wallet.isConnected && item.sellerLabel.toLowerCase().includes(wallet.address.toLowerCase().slice(2, 8));
  const hasRefund = refundWei && BigInt(refundWei) > 0n;

  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
      <div className="flex gap-4">
        <img src={item.imageUrl} alt={item.title} className="h-24 w-24 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-medium text-white">{item.title}</p>
              <p className="mt-1 text-base text-slate-300/70">Seller: {item.sellerLabel}</p>
            </div>
            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-fuchsia-100">
              {item.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Highest: {item.highestBidEthLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Ends: {item.timeStateLabel}
            </span>
            {item.isSelectedItemMatch ? (
              <span className="rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-yellow-100">
                Match
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isActive ? (
              <>
                {isOwn ? (
                  <button
                    type="button"
                    disabled={actionState === `cancel-auction-${aid}`}
                    onClick={onCancelAuction}
                    className="rounded-xl border border-rose-300/15 bg-rose-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionState === `cancel-auction-${aid}` ? 'Cancelling…' : 'Cancel Auction'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionState === `end-${aid}`}
                  onClick={onEndAuction}
                  className="rounded-xl border border-yellow-300/15 bg-yellow-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yellow-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `end-${aid}` ? 'Ending…' : 'End Auction'}
                </button>
                {isBidding ? (
                  <div className="flex w-full flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
                        Bid (ETH)
                      </span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={bidAmountEth}
                        onChange={(e) => onBidAmountChange(e.target.value)}
                        placeholder="0.1"
                        className="w-full rounded-xl border border-cyan-400/15 bg-[#071523]/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!bidAmountEth || parseFloat(bidAmountEth) <= 0 || actionState === `bid-${aid}`}
                      onClick={onPlaceBid}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionState === `bid-${aid}` ? 'Bidding…' : 'Bid'}
                    </button>
                    <button
                      type="button"
                      onClick={onBidClose}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300 transition hover:border-rose-300/20 hover:bg-rose-300/8 hover:text-rose-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onBidOpen}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100 transition hover:-translate-y-0.5"
                  >
                    Place Bid
                  </button>
                )}
              </>
            ) : null}
            {isEnded ? (
              <>
                <button
                  type="button"
                  disabled={actionState === `settle-${aid}`}
                  onClick={onSettle}
                  className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === `settle-${aid}` ? 'Settling…' : 'Settle'}
                </button>
                {hasRefund ? (
                  <button
                    type="button"
                    disabled={actionState === `claim-refund-${aid}`}
                    onClick={onClaimRefund}
                    className="rounded-xl border border-cyan-300/15 bg-cyan-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionState === `claim-refund-${aid}` ? 'Claiming…' : 'Claim Refund'}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
