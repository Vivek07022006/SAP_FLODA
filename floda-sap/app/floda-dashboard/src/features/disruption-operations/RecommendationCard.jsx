import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, ShieldAlert, Truck, Package, Clock, Sparkles, FileText } from 'lucide-react';
import { flodaApi } from '../../services/flodaApi';
import { Button } from '../../components/ui';
import { toast } from 'sonner';
import AiExplainDecisionModal from '../ai-intelligence/AiExplainDecisionModal';
import AiRecoveryBriefModal from '../ai-intelligence/AiRecoveryBriefModal';

export default function RecommendationCard({ disruption }) {
  const queryClient = useQueryClient();
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [recoveryBriefOpen, setRecoveryBriefOpen] = useState(false);

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', disruption?.disruption_id],
    queryFn: () => flodaApi.recommendations(disruption?.disruption_id),
    enabled: !!disruption?.disruption_id
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenarios', disruption?.disruption_id],
    queryFn: () => flodaApi.scenarios(disruption?.disruption_id),
    enabled: !!disruption?.disruption_id
  });

  const activeRec = recommendations[0];
  const activeScenarioId = selectedScenarioId || activeRec?.recommended_scenario_id || scenarios[0]?.scenario_id;
  const currentScenario = scenarios.find(s => s.scenario_id === activeScenarioId) || scenarios[0];

  const approveMutation = useMutation({
    mutationFn: (variables) => flodaApi.approveDecision(activeRec?.recommendation_id, variables),
    onSuccess: () => {
      toast.success('Recommendation Approved: Decision propagated to all operational personas');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const rejectMutation = useMutation({
    mutationFn: (variables) => flodaApi.rejectDecision(activeRec?.recommendation_id, variables),
    onSuccess: () => {
      toast.error('Recommendation Rejected: Operations held in staging');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: (err) => toast.error(err.message)
  });

  if (!disruption || scenarios.length === 0) return null;

  const isApproved = activeRec?.status === 'APPROVED';

  return (
    <div className="card recommendation-card mb-4">
      <div className="recommendation-header">
        <div>
          <span className="recommendation-pill">AUTONOMOUS RECOMMENDATION ENGINE</span>
          <h2 className="recommendation-title">
            Approve {currentScenario?.title || activeRec?.title || 'Emergency Rerouting Proposal'} ({currentScenario?.scenario_code?.replace('_', ' ') || 'Scenario'})
          </h2>
          <p className="recommendation-rationale">
            {currentScenario?.impact_summary || currentScenario?.description || activeRec?.rationale}
          </p>
        </div>
        <div className="recommendation-status-box">
          <span className={`status-badge-lg ${isApproved ? 'approved' : 'pending'}`}>
            {isApproved ? 'AUTHORIZED BY AUTHORITY' : 'AWAITING EXECUTIVE SIGN-OFF'}
          </span>
        </div>
      </div>

      <div className="scenarios-selector-grid">
        {scenarios.map((sc) => {
          const isSelected = sc.scenario_id === activeScenarioId;
          const isRecommended = sc.is_recommended || sc.scenario_code === 'SCENARIO_A';

          return (
            <div
              key={sc.scenario_id}
              className={`scenario-choice-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
              onClick={() => setSelectedScenarioId(sc.scenario_id)}
            >
              <div className="scenario-top">
                <span className="scenario-code">{sc.scenario_code}</span>
                {isRecommended && <span className="rec-flag">Recommended</span>}
              </div>
              <h4 className="scenario-title">{sc.title}</h4>
              <p className="scenario-desc">{sc.description}</p>

              <div className="scenario-metrics">
                <div className="metric-item">
                  <Clock size={12} />
                  <span>{sc.estimated_recovery_hours}h recovery</span>
                </div>
                <div className="metric-item">
                  <Package size={12} />
                  <span>{sc.affected_shipments_count} manifests</span>
                </div>
                <div className="metric-item">
                  <Truck size={12} />
                  <span>{sc.affected_vehicles_count} vehicles</span>
                </div>
              </div>

              <div className="scenario-footer-row">
                <span className={`risk-tag risk-${sc.risk_level?.toLowerCase()}`}>
                  Risk: {sc.risk_level}
                </span>
                <span className="compliance-tag" title={sc.compliance_status}>
                  {sc.compliance_status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!isApproved ? (
        <div className="recommendation-action-bar">
          <div className="action-info">
            <ShieldAlert size={16} className="text-amber" />
            <span>Approval will immediately generate real-time dispatch orders to Transport, Logistics, Inventory, and Compliance officers.</span>
          </div>

          <div className="action-buttons-group">
            <Button
              variant="outline"
              type="button"
              onClick={() => setExplainOpen(true)}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
              title="Explain deterministic decision via SAP Generative AI Hub"
            >
              <Sparkles size={14} className="text-emerald-400" />
              <span>Explain Decision</span>
            </Button>

            <Button
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({
                disruptionId: disruption.disruption_id,
                scenarioId: activeScenarioId,
                reason: `Corridor Authority rejected proposed scenario (${scenarios.find(s => s.scenario_id === activeScenarioId)?.title || 'Recovery Plan'}) for ${disruption.location}`
              })}
            >
              <X size={14} />
              <span>Reject</span>
            </Button>

            <Button
              variant="primary"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate({
                disruptionId: disruption.disruption_id,
                scenarioId: activeScenarioId,
                notes: `Approved ${currentScenario?.title || 'emergency recovery plan'} for ${disruption.location} (${disruption.corridor}).`
              })}
            >
              <Check size={14} />
              <span>Approve & Propagate {currentScenario?.scenario_code?.replace('_', ' ') || 'Plan'}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 mt-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sparkles size={15} className="text-amber-400 shrink-0" />
            <span>Scenario authorized by executive command. Decision intelligence briefs are available for multi-stakeholder briefing.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setExplainOpen(true)}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5 text-xs"
            >
              <Sparkles size={13} />
              <span>Explain Decision</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => setRecoveryBriefOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileText size={13} />
              <span>Generate Recovery Brief</span>
            </Button>
          </div>
        </div>
      )}

      {/* AI Modals */}
      <AiExplainDecisionModal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        disruptionId={disruption.disruption_id}
        recommendationId={activeRec?.recommendation_id}
        scenarioId={activeScenarioId}
      />

      <AiRecoveryBriefModal
        open={recoveryBriefOpen}
        onClose={() => setRecoveryBriefOpen(false)}
        disruptionId={disruption.disruption_id}
        decisionId={activeRec?.decision_id}
      />
    </div>
  );
}

