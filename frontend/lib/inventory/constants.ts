import type {
  InventoryAccentTone,
  InventoryCardFilterStatus,
  InventoryCardStatus,
  InventoryFilterOption,
  InventoryFilterStatus,
  InventoryLifecycleStatus,
  InventorySortBy,
} from '../../types/inventory';

export const STATUS_LABELS: Record<InventoryLifecycleStatus, string> = {
  pending_ai: 'Pending AI',
  stored: 'Stored',
  failed: 'Flagged',
  awaiting_mint: 'Pending Mint',
  minted: 'Minted',
  shipped: 'Archived',
};

export const CARD_STATUS_LABELS: Record<InventoryCardStatus, string> = {
  pending: 'Card Pending',
  generating: 'Rendering',
  completed: 'Card Ready',
  failed: 'Render Failed',
};

export const STATUS_ACCENTS: Record<InventoryLifecycleStatus, InventoryAccentTone> = {
  pending_ai: 'purple',
  stored: 'cyan',
  failed: 'red',
  awaiting_mint: 'yellow',
  minted: 'green',
  shipped: 'purple',
};

export const LIFECYCLE_FILTER_OPTIONS: InventoryFilterOption<InventoryFilterStatus>[] = [
  { value: 'all', label: 'All States' },
  { value: 'stored', label: 'Stored' },
  { value: 'awaiting_mint', label: 'Pending Mint' },
  { value: 'minted', label: 'Minted' },
  { value: 'failed', label: 'Flagged' },
  { value: 'pending_ai', label: 'Pending AI' },
  { value: 'shipped', label: 'Archived' },
];

export const CARD_FILTER_OPTIONS: InventoryFilterOption<InventoryCardFilterStatus>[] = [
  { value: 'all', label: 'All Cards' },
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'Rendering' },
  { value: 'completed', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
];

export const SORT_OPTIONS: InventoryFilterOption<InventorySortBy>[] = [
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'created_desc', label: 'Newest Added' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'status', label: 'Status Matrix' },
];

export const ACCENT_STYLES: Record<
  InventoryAccentTone,
  {
    badge: string;
    softBadge: string;
    text: string;
    ring: string;
  }
> = {
  cyan: {
    badge: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
    softBadge: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-100/80',
    text: 'text-cyan-200',
    ring: 'ring-cyan-400/40',
  },
  yellow: {
    badge: 'border-yellow-300/40 bg-yellow-300/10 text-yellow-100',
    softBadge: 'border-yellow-400/20 bg-yellow-400/5 text-yellow-100/80',
    text: 'text-yellow-100',
    ring: 'ring-yellow-300/40',
  },
  red: {
    badge: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
    softBadge: 'border-rose-400/20 bg-rose-400/5 text-rose-100/80',
    text: 'text-rose-100',
    ring: 'ring-rose-400/40',
  },
  purple: {
    badge: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-100',
    softBadge: 'border-fuchsia-400/20 bg-fuchsia-400/5 text-fuchsia-100/80',
    text: 'text-fuchsia-100',
    ring: 'ring-fuchsia-400/40',
  },
  green: {
    badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
    softBadge: 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100/80',
    text: 'text-emerald-100',
    ring: 'ring-emerald-400/40',
  },
};
