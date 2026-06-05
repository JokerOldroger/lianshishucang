import InventorySectionFrame from './InventorySectionFrame';
import type { InventoryDataSource, InventoryItemViewModel } from '../../types/inventory';

interface InventoryTradingOverviewProps {
  item?: InventoryItemViewModel;
  dataSource: InventoryDataSource;
}

export default function InventoryTradingOverview({
  item,
  dataSource,
}: InventoryTradingOverviewProps) {
  const checklist = [
    { label: 'Card Generated', active: Boolean(item?.hasGeneratedCard) },
    { label: 'Mint Prepared', active: Boolean(item?.hasMintPrep) },
    { label: 'NFT Linked', active: Boolean(item?.nftId) },
    { label: 'Minted', active: item?.status === 'minted' || item?.status === 'shipped' },
  ];

  return (
    <InventorySectionFrame
      title="NFT Trading Console"
      rightAdornment={
        <div className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">
          {dataSource.toUpperCase()}
        </div>
      }
      contentClassName="space-y-5"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[1.5rem] border border-cyan-400/15 bg-[#071523]/75 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
            Selected NFT Asset
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            {item?.name ?? '—'}
          </h2>
          <p className="mt-2 text-base text-slate-300/70">{item?.displayCode ?? '—'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {item ? (
              <>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
                  {item.statusLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
                  {item.cardStatusLabel}
                </span>
                <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-fuchsia-100">
                  {item.nftId ? `NFT-${item.nftId}` : 'NFT Pending'}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
            Readiness Checklist
          </p>
          <div className="mt-4 space-y-3">
            {checklist.map((step) => (
              <div key={step.label} className="flex items-center justify-between gap-3">
                <span className={step.active ? 'text-base text-white' : 'text-base text-slate-400'}>
                  {step.label}
                </span>
                <span
                  className={[
                    'rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]',
                    step.active
                      ? 'border-emerald-300/25 bg-emerald-300/8 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-400',
                  ].join(' ')}
                >
                  {step.active ? 'Ready' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </InventorySectionFrame>
  );
}
