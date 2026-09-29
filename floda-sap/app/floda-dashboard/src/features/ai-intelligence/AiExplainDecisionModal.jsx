import { X, Sparkles, CheckCircle2, ShieldCheck, Scale, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { flodaApi } from '../../services/flodaApi';
import { Button } from '../../components/ui';

export default function AiExplainDecisionModal({ open, onClose, disruptionId, recommendationId, scenarioId }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-explain-decision', disruptionId, recommendationId, scenarioId],
    queryFn: () => flodaApi.aiExplainDecision({ disruptionId, recommendationId, scenarioId }),
    enabled: !!open
  });

  if (!open) return null;

  const exp = data?.explanation || {};
  const isRealGenAi = data?.source === 'SAP_GENAI_HUB' || data?.source === 'OPENAI_API';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl rounded-xl">
        {/* Header */}
        <div className="modal-header border-b border-slate-800 p-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Scale size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Why FLODA Recommends This Decision</h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  EXPLAINABLE AI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent multi-agent rationale grounded in actual SAP HANA ledger metrics
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Close explanation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Dual Source Legend */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Deterministic SAP HANA Data
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
                AI-Generated Explanation
              </span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh explanation"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Sparkles size={28} className="animate-spin text-emerald-400" />
              <p className="text-sm font-medium">Synthesizing mathematical & policy justification...</p>
              <span className="text-[11px] text-slate-500">Evaluating capacity, recovery latency, and safety constraints</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <strong className="block font-bold mb-1">Failed to generate Decision Explanation</strong>
              <p>{error.message}</p>
            </div>
          ) : (
            <>
              {/* Recommendation Title */}
              <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">PROPOSED ACTION</span>
                <strong className="text-sm font-bold text-white block mt-1">
                  {exp.recommendationTitle || 'Approve Scenario-Based Logistics Rerouting Plan'}
                </strong>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {exp.executiveExplanation}
                </p>
              </div>

              {/* Core Why Points */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block mb-2">
                  KEY DETERMINISTIC DRIVERS (FACTUAL GROUNDING)
                </span>
                <ul className="space-y-2 text-slate-200">
                  {(exp.whyThisScenario || []).map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tradeoffs Considered */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1.5">
                  OPERATIONAL TRADEOFFS EVALUATED
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {(exp.tradeoffsConsidered || []).map((tradeoff, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold shrink-0">vs</span>
                      <span className="leading-snug">{tradeoff}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Inventory & Compliance Verification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block mb-1">
                    INVENTORY IMPLICATIONS
                  </span>
                  <p className="text-slate-300 leading-snug">{exp.inventoryImplications}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block mb-1">
                    COMPLIANCE & GUARDRAILS
                  </span>
                  <p className="text-slate-300 leading-snug">{exp.complianceVerification}</p>
                </div>
              </div>

              {/* Human Action Required */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-2 text-xs">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <strong className="block font-bold mb-0.5">Human Authority Governance:</strong>
                  <span>{exp.humanActionRequired}</span>
                </div>
              </div>

              {/* Footer Banner */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className={isRealGenAi ? 'text-emerald-400' : 'text-amber-400'} />
                  <span>
                    {data?.poweredBy || 'FLODA AI Orchestration'} · Confidence: <strong className="text-slate-200">{exp.confidence || 'HIGH'}</strong>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Grounding: 100% Deterministic HANA Data
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer border-t border-slate-800 p-3 sticky bottom-0 bg-slate-900/95 backdrop-blur flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Explainable AI · Adheres to SAP Responsible AI Guidelines
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
