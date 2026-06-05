import {
  Boxes,
  ChartCandlestick,
  CloudUpload,
  HardDrive,
  Sparkles,
  WalletMinimal,
  X,
} from 'lucide-react';

interface InventorySideRailDrawerProps {
  open: boolean;
  workspace: 'business' | 'wallet';
  activeSection: 'library' | 'upload' | 'prep' | 'market' | 'storage' | 'access';
  onChange: (section: 'library' | 'upload' | 'prep' | 'market' | 'storage' | 'access') => void;
  onClose: () => void;
}

const businessItems = [
  { key: 'library' as const, label: 'Library', Icon: Boxes },
  { key: 'upload' as const, label: 'Upload', Icon: CloudUpload },
  { key: 'prep' as const, label: 'NFT Prep', Icon: Sparkles },
  { key: 'market' as const, label: 'Market', Icon: ChartCandlestick },
  { key: 'storage' as const, label: 'Storage', Icon: HardDrive },
];

const walletItems = [{ key: 'access' as const, label: 'Access', Icon: WalletMinimal }];

export default function InventorySideRailDrawer({
  open,
  workspace,
  activeSection,
  onChange,
  onClose,
}: InventorySideRailDrawerProps) {
  const items = workspace === 'business' ? businessItems : walletItems;

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-72 border-l border-cyan-400/15 bg-[#06111c]/95 p-4 backdrop-blur-xl shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
            {workspace === 'business' ? 'Business Views' : 'Wallet Views'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-cyan-300/20 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {items.map(({ key, label, Icon }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  onClose();
                }}
                className={[
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  isActive
                    ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                    : 'border-white/8 bg-white/5 text-slate-300/75 hover:border-cyan-300/20 hover:text-white',
                ].join(' ')}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
