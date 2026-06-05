import InventoryDetailPanel from './InventoryDetailPanel';
import InventoryEmptyState from './InventoryEmptyState';
import InventorySectionFrame from './InventorySectionFrame';
import type {
  InventoryItemViewModel,
  InventoryMarketAuctionViewModel,
  InventoryMarketData,
  InventoryMarketListingViewModel,
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

  return (
    <div className="space-y-6">
      <InventorySectionFrame title="Market Visibility" contentClassName="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Active Listings" value={market.summary.activeListings} />
          <SummaryCard label="Active Auctions" value={market.summary.activeAuctions} />
          <SummaryCard label="My Owned NFTs" value={market.summary.ownedNfts} />
          <SummaryCard label="My Created NFTs" value={market.summary.createdNfts} />
        </div>

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
          </InventorySectionFrame>

          <InventorySectionFrame title="Activity & Transactions" contentClassName="space-y-4">
            <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
              <span className="inline-flex rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-yellow-100">
                Future Integration
              </span>
            </div>
          </InventorySectionFrame>

          <div className="grid gap-6 xl:grid-cols-2">
            <MarketListSection
              title="Marketplace Listings"
              items={market.listings}
              emptyTitle="No Active Listings"
              emptyMessage="No active listings"
              renderItem={(item) => <ListingCard key={item.id} item={item} />}
            />

            <MarketListSection
              title="Auction Board"
              items={market.auctions}
              emptyTitle="No Active Auctions"
              emptyMessage="No active auctions"
              renderItem={(item) => <AuctionCard key={item.id} item={item} />}
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

function ListingCard({ item }: { item: InventoryMarketListingViewModel }) {
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
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{item.priceEthLabel}</span>
            {item.isSelectedItemMatch ? (
              <span className="rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-yellow-100">
                Match
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionCard({ item }: { item: InventoryMarketAuctionViewModel }) {
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
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-200">
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
        </div>
      </div>
    </div>
  );
}
