import { useState } from 'react';
import { X, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../components/ui';
import { flodaApi } from '../../services/flodaApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function DisruptionDialog({ open, onClose }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    location: 'Mugling-Narayanghat KM-36',
    corridor: 'Birgunj-Kathmandu Arterial Highway',
    chokepoint_type: 'landslide',
    severity: 'critical',
    affected_routes: 'Central Nepal Trans-Himalayan Corridor',
    description: 'Major rockfall blocking both lanes. 14 heavy freight carriers trapped.',
    capacity_reduction_percent: 85,
    expected_duration_hours: 48
  });

  const triggerMutation = useMutation({
    mutationFn: (payload) => flodaApi.triggerDisruption(payload),
    onSuccess: () => {
      toast.success('Disruption sensed! Agentic pipeline executed and scenarios generated in SAP HANA.');
      queryClient.invalidateQueries({ queryKey: ['disruptions'] });
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['chokepoints'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      onClose();
    },
    onError: (error) => toast.error(error.message)
  });

  if (!open) return null;

  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    triggerMutation.mutate({
      ...formData,
      capacity_reduction_percent: Number(formData.capacity_reduction_percent),
      expected_duration_hours: Number(formData.expected_duration_hours)
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-icon-badge">
                <SlidersHorizontal size={16} />
              </span>
              <div>
                <h2 className="modal-heading">Trigger Corridor Disruption Scenario</h2>
                <p className="modal-subheading">Simulate live supply chain chokepoint to execute autonomous multi-agent pipeline.</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            <div className="form-grid-two">
              <label className="input-group">
                <span className="input-label">Disruption Location</span>
                <input
                  className="form-input"
                  value={formData.location}
                  onChange={e => updateField('location', e.target.value)}
                  placeholder="e.g. Mugling-Narayanghat KM-36"
                  required
                />
              </label>

              <label className="input-group">
                <span className="input-label">Disruption Type</span>
                <select
                  className="form-select"
                  value={formData.chokepoint_type}
                  onChange={e => updateField('chokepoint_type', e.target.value)}
                >
                  <option value="landslide">Landslide / Rockfall</option>
                  <option value="flood">Flash Flood</option>
                  <option value="road_closure">Road Closure / Bridge Collapse</option>
                  <option value="port_congestion">Port Congestion</option>
                  <option value="weather">Severe Himalayan Weather</option>
                  <option value="other">Other Incident</option>
                </select>
              </label>
            </div>

            <div className="form-grid-two">
              <label className="input-group">
                <span className="input-label">Affected Highway / Corridor</span>
                <input
                  className="form-input"
                  value={formData.corridor}
                  onChange={e => updateField('corridor', e.target.value)}
                  placeholder="e.g. Birgunj-Kathmandu Arterial"
                  required
                />
              </label>

              <label className="input-group">
                <span className="input-label">Impact Severity</span>
                <select
                  className="form-select"
                  value={formData.severity}
                  onChange={e => updateField('severity', e.target.value)}
                >
                  <option value="low">Low Impact</option>
                  <option value="medium">Medium Impact</option>
                  <option value="high">High Impact</option>
                  <option value="critical">Critical Impact</option>
                </select>
              </label>
            </div>

            <label className="input-group">
              <span className="input-label">Incident Description</span>
              <textarea
                className="form-input form-textarea"
                rows="2"
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Details of the obstruction, stranded carriers, or hazards..."
                required
              />
            </label>

            {/* 1️⃣ SENSING AGENT TELEMETRY SECTION */}
            <div className="p-3 my-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  1️⃣ Sensing Agent Telemetry Sensors
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Autonomous Ingestion
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mb-2">
                Simulated IoT-compatible telemetry & environmental inputs dynamically compute corridor capacity impact:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">🌧️ Rainfall Rate:</span>
                  <input
                    className="form-input text-xs py-1"
                    value={formData.rainfall || '145 mm/hr (Torrential)'}
                    onChange={e => updateField('rainfall', e.target.value)}
                    placeholder="e.g. 145 mm/hr (Torrential)"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">🌊 River Level:</span>
                  <input
                    className="form-input text-xs py-1"
                    value={formData.riverLevel || '9.8m (Danger Mark +2.2m)'}
                    onChange={e => updateField('riverLevel', e.target.value)}
                    placeholder="e.g. 9.8m (Danger Mark)"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">🛣️ Road Status:</span>
                  <input
                    className="form-input text-xs py-1"
                    value={formData.roadStatus || 'Submerged / Mudslide Breach'}
                    onChange={e => updateField('roadStatus', e.target.value)}
                    placeholder="e.g. Submerged / Breached"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">🏗️ Infrastructure Disruption:</span>
                  <input
                    className="form-input text-xs py-1"
                    value={formData.infrastructureDisruption || 'Bridge Abutment Scour / Structural Risk'}
                    onChange={e => updateField('infrastructureDisruption', e.target.value)}
                    placeholder="e.g. Bridge Abutment Risk"
                  />
                </div>
              </div>
              <div className="mt-2.5 p-2 rounded bg-rose-500/20 border border-rose-500/30 flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-300">
                  🎯 1️⃣ Sensing Agent Output:
                </span>
                <span className="font-bold text-rose-200">
                  Route capacity expected to fall to 0%.
                </span>
              </div>
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span className="input-label">Throughput Capacity Reduction</span>
                <strong className="slider-value">{formData.capacity_reduction_percent}%</strong>
              </div>
              <input
                type="range"
                className="form-range"
                min="10"
                max="100"
                value={formData.capacity_reduction_percent}
                onChange={e => updateField('capacity_reduction_percent', e.target.value)}
              />
            </div>

            <label className="input-group">
              <span className="input-label">Estimated Duration (Hours)</span>
              <input
                type="number"
                className="form-input"
                min="1"
                max="720"
                value={formData.expected_duration_hours}
                onChange={e => updateField('expected_duration_hours', e.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={triggerMutation.isPending}>
              <Play size={14} />
              <span>{triggerMutation.isPending ? 'Sensing & Analyzing...' : 'Trigger Disruption & Run Agents'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
