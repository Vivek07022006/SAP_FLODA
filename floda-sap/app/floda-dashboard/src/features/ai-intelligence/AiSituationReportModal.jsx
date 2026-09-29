import { X, Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, Clock, Package, Warehouse, ArrowRight, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { flodaApi } from '../../services/flodaApi';
import { Button } from '../../components/ui';

export default function AiSituationReportModal({ open, onClose, disruptionId }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-situation-report', disruptionId],
    queryFn: () => flodaApi.aiSituationReport({ disruptionId }),
    enabled: !!open
  });

  if (!open) return null;

  const report = data?.report || {};
  const isRealGenAi = data?.source === 'SAP_GENAI_HUB' || data?.source === 'OPENAI_API';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl rounded-xl">
        {/* Header */}
        <div className="modal-header border-b border-slate-800 p-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">FLODA AI Situation Report</h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-400">
                  DECISION INTELLIGENCE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Executive operational synthesis grounded in live SAP HANA Cloud ledger data
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Close report"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-5 text-xs">
          {/* Dual Source Legend / Trust Verification */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Operational facts from FLODA
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
                AI-generated interpretation
              </span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh report from SAP HANA"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Sparkles size={28} className="animate-spin text-amber-400" />
              <p className="text-sm font-medium">Assembling live SAP HANA state & synthesizing narrative...</p>
              <span className="text-[11px] text-slate-500">Querying disruptions, chokepoints, scenarios, and regional DoC</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <strong className="block font-bold mb-1">Failed to generate Situation Report</strong>
              <p>{error.message}</p>
            </div>
          ) : (
            <>
              {/* Status Notice if fallback */}
              {data?.statusNotice && (
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-start gap-2 text-xs">
                  <ShieldCheck size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Advisory Intelligence Active:</span> {data.statusNotice}
                  </div>
                </div>
              )}

              {/* Disruption & Severity Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">ACTIVE DISRUPTION</span>
                  <strong className="text-sm text-white font-bold block mt-1">
                    {data?.contextSnapshot?.corridor || 'Nepal Arterial Highway'}
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    ID: {data?.contextSnapshot?.disruptionId || 'DISR-ACTIVE'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">CORRIDOR SEVERITY</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                      report.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {report.severity || 'CRITICAL'}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      -{data?.contextSnapshot?.capacityReduction || 85}% Throughput
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">EXECUTIVE STATUS</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {report.humanApprovalRequired ? 'HUMAN APPROVAL REQUIRED' : 'AUTO-EXECUTED'}
                    </span>
                    <span className="text-emerald-400 text-[11px] font-semibold">
                      Confidence: {report.confidence || 'HIGH'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Situation Summary */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={12} />
                  <span>EXECUTIVE SITUATION SUMMARY</span>
                </span>
                <p className="text-sm leading-relaxed text-slate-200">
                  {report.situationSummary}
                </p>
              </div>

              {/* Key Impacts */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  KEY OPERATIONAL IMPACTS (OBSERVED FACTS)
                </span>
                <ul className="space-y-1.5">
                  {(report.keyImpacts || []).map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical Inventory & Days of Cover */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2 flex items-center gap-1.5">
                  <Warehouse size={13} className="text-sky-400" />
                  <span>CRITICAL REGIONAL INVENTORY & DAYS OF COVER (DoC)</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {(report.criticalInventory || []).map((inv, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
                      <div>
                        <strong className="text-slate-100 font-semibold">{inv.commodity}</strong>
                        <p className="text-[10px] text-slate-400 mt-0.5">{inv.location}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-rose-400">
                          {inv.daysOfCover}d Cover
                        </span>
                        <span className="block text-[9px] font-bold text-rose-400/80 uppercase">
                          {inv.risk} RISK
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Recovery & Decision Factors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">
                    RECOMMENDED RECOVERY SCENARIO
                  </span>
                  <strong className="text-sm font-bold text-white block">
                    {report.recommendedScenario?.scenarioCode}: {report.recommendedScenario?.reason}
                  </strong>
                  <div className="mt-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">DECISION FACTORS</span>
                    <ul className="space-y-1 text-slate-300">
                      {(report.decisionFactors || []).map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                    OPERATIONAL RISKS & VULNERABILITIES
                  </span>
                  <ul className="space-y-1.5 text-slate-300 mt-2">
                    {(report.risks || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <span className="text-[10px] font-bold uppercase text-sky-400 tracking-wider block mt-3 mb-1">
                    RECOMMENDED NEXT ACTIONS
                  </span>
                  <ol className="space-y-1 text-slate-300 list-decimal list-inside">
                    {(report.nextActions || []).map((act, i) => (
                      <li key={i} className="leading-snug">{act}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Footer Banner */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className={isRealGenAi ? 'text-emerald-400' : 'text-amber-400'} />
                  <span>
                    {data?.poweredBy || 'FLODA AI Orchestration'} · Model: <span className="font-mono text-slate-300">{data?.model || 'gpt-4o'}</span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(data?.timestamp || Date.now()).toLocaleTimeString()} UTC
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer border-t border-slate-800 p-3 sticky bottom-0 bg-slate-900/95 backdrop-blur flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Advisory intelligence layer · Executive human sign-off required
          </span>
          <Button variant="outline" onClick={onClose}>
            Close Report
          </Button>
        </div>
      </div>
    </div>
  );
}
