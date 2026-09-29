import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Info, ShieldCheck, Database } from 'lucide-react';
import { flodaApi } from '../../services/flodaApi';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';

export default function AiStatusBadge() {
  const [open, setOpen] = useState(false);

  const { data: health, isLoading } = useQuery({
    queryKey: ['ai-health'],
    queryFn: flodaApi.aiHealth,
    refetchInterval: 15000
  });

  const isLive = health?.available && health?.mode === 'live';
  const isFallback = !health?.available || health?.mode === 'fallback';

  const badgeClass = isLive
    ? 'ai-badge-connected'
    : 'ai-badge-fallback';

  const dotClass = isLive
    ? 'bg-emerald-400'
    : 'bg-amber-400';

  const providerName = health?.provider || 'AI Layer';
  const label = isLive
    ? `${providerName} · Live`
    : `${providerName} · Fallback`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`live-ai-badge ${badgeClass} cursor-pointer hover:opacity-90 transition-opacity`}
          title="FLODA AI Intelligence Status"
        >
          <span className={`live-pulse-dot ${dotClass} ${isLive ? 'animate-ping' : ''}`} />
          <Sparkles size={12} className={isLive ? 'text-emerald-300' : 'text-amber-300'} />
          <span className="font-semibold">{isLoading ? 'AI Intelligence...' : label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 bg-slate-900 border border-slate-700 text-slate-100 shadow-xl rounded-lg text-xs">
        <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800">
          <Sparkles size={14} className="text-amber-400" />
          <strong className="text-sm font-bold text-white">FLODA AI Intelligence Status</strong>
        </div>

        <div className="flex flex-col gap-1.5 text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Connection Mode:</span>
            <span className={`font-semibold ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isLive ? 'LIVE INFERENCE' : 'FALLBACK ACTIVE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Active Provider:</span>
            <span className="text-white font-medium">{health?.provider || 'OpenAI'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Target Model:</span>
            <span className="font-mono text-emerald-400">{health?.model || 'gpt-4o'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">SAP Deployment Path:</span>
            <span className="text-slate-300">
              {health?.sapAiCoreConfigured ? 'SAP AI Core (Ready)' : 'SAP AI Core (Preserved)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Grounding Engine:</span>
            <span className="text-slate-200 flex items-center gap-1">
              <Database size={11} className="text-sky-400" />
              <span>SAP HANA Cloud</span>
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] leading-relaxed text-slate-400 flex items-start gap-1.5">
            <Info size={13} className="text-sky-400 shrink-0 mt-0.5" />
            <span>
              {health?.message ||
                'AI Intelligence grounded in live SAP HANA Cloud operational data.'}
            </span>
          </div>

          <div className="mt-1 pt-1 text-[10px] text-emerald-400/80 flex items-center gap-1">
            <ShieldCheck size={11} />
            <span>Deterministic FLODA engine remains operational source of truth</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
