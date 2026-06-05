import { motion } from 'framer-motion';
import type { InventoryStats } from '../../types/inventory';

interface InventoryStatsSummaryProps {
  stats: InventoryStats;
}

const statCards = [
  { key: 'total', label: 'Total Units' },
  { key: 'generating', label: 'Rendering' },
  { key: 'awaitingMint', label: 'Mint Queue' },
  { key: 'minted', label: 'Minted' },
] as const;

export default function InventoryStatsSummary({ stats }: InventoryStatsSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card, index) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: index * 0.05, ease: 'easeOut' }}
          className="rounded-[1.5rem] border border-cyan-400/15 bg-[#08131f]/75 px-5 py-5 shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-lg"
        >
          <p className="font-mono text-[12px] uppercase tracking-[0.26em] text-cyan-300/70 sm:text-[13px]">
            {card.label}
          </p>
          <p className="mt-4 text-[2.2rem] font-semibold leading-none text-white sm:text-[2.35rem]">
            {stats[card.key]}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
