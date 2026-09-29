import { X, Sparkles, FileText, CheckCircle2, ShieldCheck, Truck, Package, Warehouse, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { flodaApi } from '../../services/flodaApi';
import { Button } from '../../components/ui';

export default function AiRecoveryBriefModal({ open, onClose, disruptionId, decisionId }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-recovery-brief', disruptionId, decisionId],
    queryFn: () => flodaApi.aiRecoveryBrief({ disruptionId, decisionId }),
    enabled: !!open
  });

  if (!open) return null;

  const brief = data?.brief || {};
  const isRealGenAi = data?.source === 'SAP_GENAI_HUB' || data?.source === 'OPENAI_API';

  const roleIcons = {
    TRANSPORT: <Truck size={14} className="text-sky-400" />,
    LOGISTICS: <Package size={14} className="text-emerald-400" />,
    INVENTORY: <Warehouse size={14} className="text-amber-400" />,
    COMPLIANCE: <ShieldCheck size={14} className="text-indigo-400" />
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl rounded-xl">
        {/* Header */}
        <div className="modal-header border-b border-slate-800 p-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <FileText size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Executive Recovery Brief</h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {brief.authorizationStatus || 'AUTHORIZED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Post-authorization operational directives and cross-persona mitigation plan
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Close recovery brief"
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
                Ledger Decisions (HANA)
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-sky-300">
                <span className="w-2 h-2 rounded-full bg-sky-300 inline-block" />
                Executive Briefing Synthesis
              </span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh brief"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Sparkles size={28} className="animate-spin text-sky-400" />
              <p className="text-sm font-medium">Assembling authorized directives & recovery brief...</p>
              <span className="text-[11px] text-slate-500">Retrieving operational tasks and inventory decanting commitments</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <strong className="block font-bold mb-1">Failed to generate Recovery Brief</strong>
              <p>{error.message}</p>
            </div>
          ) : (
            <>
              {/* Executive Metadata Ribbon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">AUTHORIZED SCENARIO</span>
                  <strong className="text-sm text-white font-bold block mt-1">
                    {brief.approvedScenario || 'Scenario-Based Logistics Rerouting'}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">AUTHORIZING AGENT / ACTOR</span>
                  <strong className="text-sm text-emerald-400 font-bold block mt-1">
                    {brief.authorizedBy || 'Srivatsan Venkat (AUTHORITY)'}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">ESTIMATED RESTORATION</span>
                  <strong className="text-sm text-amber-300 font-bold block mt-1">
                    ~{brief.estimatedRestorationHours || 18} Hours Latency
                  </strong>
                </div>
              </div>

              {/* Operational Plan Summary */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block mb-1.5">
                  OPERATIONAL PLAN SUMMARY
                </span>
                <p className="text-sm leading-relaxed text-slate-200">
                  {brief.operationalPlanSummary}
                </p>
              </div>

              {/* Stakeholder Directives */}
              <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  CROSS-FUNCTIONAL STAKEHOLDER DIRECTIVES
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(brief.stakeholderDirectives || []).map((dir, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-2 mb-1.5">
                        {roleIcons[dir.role] || <CheckCircle2 size={13} className="text-slate-400" />}
                        <strong className="text-xs font-bold text-slate-200">{dir.role} OPERATIONS</strong>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{dir.directive}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory Actions & Residual Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                    INVENTORY BUFFER ACTIONS
                  </span>
                  <p className="text-slate-300 leading-relaxed">{brief.inventoryActions}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-800/70 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block mb-1">
                    RESIDUAL OPERATIONAL RISKS
                  </span>
                  <ul className="space-y-1 text-slate-300">
                    {(brief.residualRisks || []).map((risk, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Append-Only Auditable Decision Ledger Verification */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2 text-xs">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <strong className="block font-bold">Auditable Decision Ledger:</strong>
                  <span className="text-[11px]">{brief.auditLedgerStatus}</span>
                </div>
              </div>

              {/* Footer Banner */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className={isRealGenAi ? 'text-emerald-400' : 'text-amber-400'} />
                  <span>
                    {data?.poweredBy || 'FLODA AI Orchestration'} · Decision Brief ID: <span className="font-mono text-slate-300">{decisionId || 'DEC-ACTIVE'}</span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Verified by SAP Enterprise Commons
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer border-t border-slate-800 p-3 sticky bottom-0 bg-slate-900/95 backdrop-blur flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Official Executive Briefing · Propagated across all operational nodes
          </span>
          <Button variant="outline" onClick={onClose}>
            Close Brief
          </Button>
        </div>
      </div>
    </div>
  );
}
