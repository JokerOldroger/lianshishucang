import {
  Boxes,
  ChartCandlestick,
  CloudUpload,
  HardDrive,
  Sparkles,
  WalletMinimal,
} from 'lucide-react';

interface InventorySideRailProps {
  workspace: 'business' | 'wallet';
  activeSection: 'library' | 'upload' | 'prep' | 'market' | 'storage' | 'access';
  onChange: (section: 'library' | 'upload' | 'prep' | 'market' | 'storage' | 'access') => void;
  collapsed: boolean;
  onToggle: () => void;
}

const businessItems = [
  { key: 'library' as const, label: 'Library', Icon: Boxes },
  { key: 'upload' as const, label: 'Upload', Icon: CloudUpload },
  { key: 'prep' as const, label: 'NFT Prep', Icon: Sparkles },
  { key: 'market' as const, label: 'Market', Icon: ChartCandlestick },
  { key: 'storage' as const, label: 'Storage', Icon: HardDrive },
];

const walletItems = [{ key: 'access' as const, label: 'Access', Icon: WalletMinimal }];

export default function InventorySideRail({
  workspace,
  activeSection,
  onChange,
  collapsed,
  onToggle,
}: InventorySideRailProps) {
  const items = workspace === 'business' ? businessItems : walletItems;

  return (
    <aside className="hidden xl:flex xl:flex-col xl:items-end xl:gap-3 xl:sticky xl:top-6 xl:self-start">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full border border-white/10 bg-[#06111c]/85 px-3 py-2 text-xs text-slate-300/80 transition hover:border-cyan-300/20 hover:text-white"
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <div
        className={[
          'rounded-[1.5rem] border border-cyan-400/15 bg-[#06111c]/85 backdrop-blur-xl shadow-[0_0_24px_rgba(34,211,238,0.08)]',
          collapsed ? 'p-2' : 'p-3',
        ].join(' ')}
      >
        <div className="flex flex-col gap-2">
          {items.map(({ key, label, Icon }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={[
                  'flex items-center gap-3 rounded-2xl border text-left transition',
                  collapsed ? 'justify-center px-3 py-3' : 'px-4 py-3 min-w-[180px]',
                  isActive
                    ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                    : 'border-white/8 bg-white/5 text-slate-300/75 hover:border-cyan-300/20 hover:text-white',
                ].join(' ')}
              >
                <Icon size={18} />
                {!collapsed ? <span className="text-sm font-medium">{label}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
