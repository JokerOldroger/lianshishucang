import { useTranslation } from 'react-i18next';
import type {
  InventoryCabinetViewModel,
  InventoryDiagnosticViewModel,
  InventoryItemViewModel,
  InventoryTelemetryViewModel,
} from '../../types/inventory';
import InventorySectionFrame from './InventorySectionFrame';

interface InventoryTelemetryPanelProps {
  item?: InventoryItemViewModel;
  cabinets?: InventoryCabinetViewModel[];
  telemetry?: InventoryTelemetryViewModel[];
  diagnostics?: InventoryDiagnosticViewModel[];
  dataSource: 'demo' | 'backend' | 'mixed';
}

export default function InventoryTelemetryPanel({
  item,
  cabinets,
  telemetry,
  diagnostics,
  dataSource,
}: InventoryTelemetryPanelProps) {
  const { t } = useTranslation();
  const cabinetCode = item?.physicalLocation ? deriveCabinetCode(item.physicalLocation) : undefined;
  const cabinet =
    cabinets?.find((entry) => entry.cabinetCode === cabinetCode) ??
    cabinets?.find((entry) => item?.physicalLocation?.includes(entry.cabinetCode));
  const liveTelemetry = telemetry?.find((entry) => entry.cabinetId === cabinet?.id) ?? telemetry?.[0];
  const diagnostic =
    diagnostics?.find((entry) => entry.collectionId === item?.collectionId) ?? diagnostics?.[0];
  const hasRealCabinetData = Boolean(cabinet);

  return (
    <InventorySectionFrame
      title={t('telemetry.title')}
      rightAdornment={
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">
          {dataSource.toUpperCase()}
        </span>
      }
      contentClassName="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Metric label={t('telemetry.cabinet')} value={cabinet?.cabinetCode ?? t('common.unavailable')} tone="cyan" />
        <Metric label={t('telemetry.cabinetStatus')} value={cabinet?.status ?? t('telemetry.notConnected')} tone="green" />
        <Metric
          label={t('telemetry.cabinetTemp')}
          value={liveTelemetry ? `${liveTelemetry.currentTemp.toFixed(1)}°C` : cabinet ? `${cabinet.targetTemp.toFixed(1)}°C ${t('telemetry.target')}` : '—'}
          tone="yellow"
        />
        <Metric
          label={t('telemetry.cabinetHumidity')}
          value={liveTelemetry ? `${liveTelemetry.currentHumidity.toFixed(0)}%` : cabinet ? `${cabinet.targetHumidity.toFixed(0)}% ${t('telemetry.target')}` : '—'}
          tone="cyan"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SystemFlag label={t('telemetry.tecCooling')} active={Boolean(cabinet?.tecCoolingActive)} />
        <SystemFlag label={t('telemetry.atomizer')} active={Boolean(cabinet?.atomizerActive)} />
      </div>

      <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
          {t('telemetry.targetEnvironment')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-base text-slate-200">
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
            {t('telemetry.tempTarget')} {cabinet ? `${cabinet.targetTemp.toFixed(1)}°C` : '—'}
          </span>
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
            {t('telemetry.humidityTarget')} {cabinet ? `${cabinet.targetHumidity.toFixed(0)}%` : '—'}
          </span>
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
            {t('telemetry.storedUnits')} {cabinet?.itemCount ?? 0}
          </span>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
            {t('telemetry.diagnosticAdvisory')}
          </p>
          <span className="rounded-full border border-yellow-300/20 bg-yellow-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-yellow-100">
            {diagnostic?.riskLevel ?? t('telemetry.limited')}
          </span>
        </div>
        <p className="mt-4 text-base leading-7 text-slate-300/80">
          {diagnostic?.humanAdvice ?? t('telemetry.noDiagnosticHistory')}
        </p>
      </div>
    </InventorySectionFrame>
  );
}

interface MetricProps {
  label: string;
  value: string;
  tone: 'cyan' | 'yellow' | 'green';
}

function Metric({ label, value, tone }: MetricProps) {
  const classes =
    tone === 'yellow'
      ? 'border-yellow-300/20 bg-yellow-300/8 text-yellow-100'
      : tone === 'green'
        ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-100'
        : 'border-cyan-300/20 bg-cyan-300/8 text-cyan-100';

  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-[#07121c]/75 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/60">{label}</p>
      <span className={['mt-3 inline-flex rounded-full border px-3 py-1.5 text-base', classes].join(' ')}>
        {value}
      </span>
    </div>
  );
}

interface SystemFlagProps {
  label: string;
  active: boolean;
}

function SystemFlag({ label, active }: SystemFlagProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-[#07121c]/75 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/60">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={[
            'h-3 w-3 rounded-full',
            active ? 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]' : 'bg-slate-600',
          ].join(' ')}
        />
        <span className={active ? 'text-base text-emerald-100' : 'text-base text-slate-400'}>
          {active ? t('telemetry.active') : t('telemetry.standby')}
        </span>
      </div>
    </div>
  );
}

function deriveCabinetCode(location: string): string | undefined {
  const match = location.toUpperCase().match(/([A-Z]-\d{2})/);
  return match?.[1];
}
