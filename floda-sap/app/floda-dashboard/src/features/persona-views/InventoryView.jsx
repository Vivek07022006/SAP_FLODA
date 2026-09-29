import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, CheckCircle2, Clock, Boxes, AlertTriangle, ArrowRightLeft, ShieldCheck, Zap, RefreshCw, TrendingUp, TrendingDown, MapPin } from 'lucide-react';
import { flodaApi } from '../../services/flodaApi';
import { Button } from '../../components/ui';
import { toast } from 'sonner';

export default function InventoryView({ currentUser }) {
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('active'); // 'active' | 'completed' | 'all'
  const [selectedTransferAmount, setSelectedTransferAmount] = useState(3200);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'INVENTORY'],
    queryFn: () => flodaApi.tasks('INVENTORY'),
    refetchInterval: 4000
  });

  const { data: chokepoints = [] } = useQuery({
    queryKey: ['chokepoints'],
    queryFn: flodaApi.chokepoints
  });

  const { data: manifests = [] } = useQuery({
    queryKey: ['manifests'],
    queryFn: flodaApi.manifests
  });

  const { data: disruptions = [] } = useQuery({
    queryKey: ['disruptions'],
    queryFn: flodaApi.disruptions
  });

  // Live Regional Depots & Days-of-Cover from SAP HANA Cloud
  const { data: depots = [], isLoading: depotsLoading } = useQuery({
    queryKey: ['depots'],
    queryFn: flodaApi.depots,
    refetchInterval: 3000
  });

  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  const displayedTasks = taskTab === 'active'
    ? activeTasks
    : taskTab === 'completed'
    ? completedTasks
    : tasks;

  const activeChokepoint = chokepoints[0];
  const activeDisruption = disruptions.find(d => d.status === 'ACTIVE' || d.status === 'MITIGATING') || disruptions[0];
  const capLoss = Number(activeChokepoint?.capacity_reduction_percent || activeDisruption?.capacity_reduction_percent || 0);

  // Extract key depots for the supply & demand matrix
  const ktmDepot = depots.find(d => d.id === 'DEPOT-KTM-01') || {
    name: 'Kathmandu Valley Destination DC',
    currentStock: 820,
    dailyDemand: 900,
    daysOfCover: 0.9,
    status: 'CRITICAL_DEFICIT'
  };

  const birgunjDepot = depots.find(d => d.id === 'DEPOT-BRG-01') || {
    name: 'Birgunj Border Inland Transshipment Hub',
    currentStock: 29500,
    dailyDemand: 1800,
    daysOfCover: 16.4,
    status: 'SURPLUS'
  };

  const isCriticalDeficit = Number(ktmDepot.daysOfCover) < 2.0;

  // Acknowledge Task Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: ({ taskId, notes }) =>
      flodaApi.acknowledgeTask(taskId, {
        notes,
        user: currentUser?.fullName || 'Inventory Lead',
        role: 'INVENTORY'
      }),
    onSuccess: () => {
      toast.success('Inventory instruction acknowledged. Stock release initiated.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => toast.error(err.message)
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status, notes }) =>
      flodaApi.updateTaskStatus(taskId, {
        status,
        notes,
        user: currentUser?.fullName || 'Inventory Lead',
        role: 'INVENTORY'
      }),
    onSuccess: (data) => {
      toast.success(`Inventory status updated: ${data.status.replace('_', ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => toast.error(err.message)
  });

  // Supply & Demand Reallocation Mutation
  const reallocateMutation = useMutation({
    mutationFn: (payload) =>
      flodaApi.reallocateInventory({
        fromDepotId: 'DEPOT-BRG-01',
        toDepotId: 'DEPOT-KTM-01',
        requestedQuantity: selectedTransferAmount,
        actor: currentUser?.fullName || 'Rajesh Shrestha (Inventory Lead)',
        role: 'INVENTORY',
        ...payload
      }),
    onSuccess: (res) => {
      toast.success(
        `Dynamic Rebalance Successful: +${res.transferQuantity.toLocaleString()} units allocated from ${res.sourceDepot} -> ${res.targetDepot}! Days of Cover elevated from ${res.prevTargetDoc}d to ${res.newTargetDoc}d.`
      );
      queryClient.invalidateQueries({ queryKey: ['depots'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(`Rebalance failed: ${err.message}`)
  });

  return (
    <div className="persona-view-container">
      <div className="intro">
        <div>
          <p className="intro-eyebrow">STRATEGIC WAREHOUSING & AUTONOMOUS REBALANCING</p>
          <h1 className="intro-title">Inventory Operations & Supply-Demand Control</h1>
          <span className="intro-subtitle">
            Autonomous multi-depot inventory balancing: dynamically re-route safety stock from high-surplus buffer zones to critical deficit areas to protect life-support Days of Cover (DoC).
          </span>
        </div>
        <div className="persona-badge-tag inventory">
          <Warehouse size={14} />
          <span>Manager: {currentUser?.fullName} ({currentUser?.org})</span>
        </div>
      </div>

      {/* Top KPI Ribbon */}
      <div className="kpi-ribbon mb-4">
        <div className="kpi-card">
          <span className="kpi-label">DESTINATION DAYS OF COVER (DoC)</span>
          <div className="kpi-value-row">
            <strong className={`kpi-val ${isCriticalDeficit ? 'text-rose font-bold' : 'text-emerald'}`}>
              {ktmDepot.daysOfCover} Days
            </strong>
            <span className={`kpi-tag ${isCriticalDeficit ? 'danger' : 'success'}`}>
              {isCriticalDeficit ? 'Critical Deficit (< 2.0d)' : 'Protected Cover (> 4.0d)'}
            </span>
          </div>
          <small className="kpi-meta">
            {isCriticalDeficit
              ? 'Emergency re-allocation required from surplus gateway'
              : 'Supply & demand balanced across active corridor'}
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">SURPLUS GATEWAY RESERVOIR</span>
          <div className="kpi-value-row">
            <strong className="kpi-val text-blue-400">{birgunjDepot.daysOfCover} Days</strong>
            <span className="kpi-tag success">Surplus Available</span>
          </div>
          <small className="kpi-meta">Birgunj Border Hub ({birgunjDepot.currentStock?.toLocaleString()} units in stock)</small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">ACTIVE TRANSFER ORDERS</span>
          <div className="kpi-value-row">
            <strong className="kpi-val text-violet">{activeTasks.length} Pending</strong>
            <span className="kpi-tag success">{completedTasks.length} Completed</span>
          </div>
          <small className="kpi-meta">Dispatched via Emergency Corridor Bypasses</small>
        </div>
      </div>

      {/* FEATURE SECTION: Supply & Demand Dynamic Rebalance Controller */}
      <div className="card mb-4 border-brand/40 bg-subtle/50">
        <div className="card-header-row">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-count text-brand font-bold">AUTONOMOUS OPTIMIZATION</span>
              <h3 className="card-title text-base">Supply & Demand Inter-Depot Balancing Engine</h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Live automated matching: detects areas with excessive stock surplus vs disaster-affected zones running low on cover.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  toast.info('Triggering Supply-Demand Deficit Simulation...');
                  await flodaApi.sendTelemetryFeed({
                    scenarioId: 'SUPPLY_DEMAND_CRISIS',
                    location: 'Mugling-Narayanghat KM-36',
                    corridor: 'Birgunj-Kathmandu Arterial Highway',
                    throughputCapacity: 15,
                    averageSpeedKmh: 4.8,
                    status: 'OBSTRUCTED',
                    sensorId: 'IOT-VALLEY-SURGE-01',
                    description: 'Major rockfall halting Kathmandu arterial. Inbound flow stopped; Kathmandu DC drops to 0.9 days.'
                  });
                  queryClient.invalidateQueries();
                  toast.success('Simulation active: Kathmandu stock depleted to 0.9 days!');
                } catch (e) {
                  toast.error(e.message);
                }
              }}
              title="Simulate high disruption and stock deficit in Kathmandu"
            >
              <AlertTriangle size={13} className="text-rose" />
              <span>Simulate Deficit Shock</span>
            </Button>

            <Button
              variant="primary"
              disabled={reallocateMutation.isPending}
              onClick={() => reallocateMutation.mutate({})}
              title="Automatically transfer surplus inventory to restore minimum safe days-of-cover"
            >
              <Zap size={14} className="text-amber animate-pulse" />
              <span>{reallocateMutation.isPending ? 'Calculating & Reallocating...' : '⚡ Rebalance Supply & Demand'}</span>
            </Button>
          </div>
        </div>

        {/* Live Reallocation Visual Route */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-surface rounded-lg border border-subtle mt-3">
          {/* Source Surplus */}
          <div className="p-3 rounded border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wide">
                <TrendingUp size={13} /> Surplus Area (Source)
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                {birgunjDepot.daysOfCover}d Cover
              </span>
            </div>
            <strong className="text-sm block">{birgunjDepot.name}</strong>
            <div className="text-xs text-secondary mt-1 space-y-0.5">
              <div>Stock: <b className="text-primary">{birgunjDepot.currentStock?.toLocaleString()} units</b> (Capacity: {birgunjDepot.capacity?.toLocaleString()})</div>
              <div>Consumption: <b>{birgunjDepot.dailyDemand} units/day</b></div>
              <div className="text-emerald-400 text-xs font-semibold mt-1">✓ Huge buffer reservoir available for draw</div>
            </div>
          </div>

          {/* Transfer Conveyance Conduit */}
          <div className="flex flex-col items-center justify-center p-3 rounded border border-subtle bg-subtle/30 text-center">
            <span className="text-xs font-bold text-brand uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowRightLeft size={14} /> Inter-Hub Allocation
            </span>
            <strong className="text-lg font-bold text-amber">
              +{selectedTransferAmount.toLocaleString()} Units
            </strong>
            <span className="text-xs text-secondary mt-0.5">
              Target: Restore to <b>4.5 Days Minimum</b>
            </span>
            <div className="mt-2 flex gap-1">
              {[2000, 3200, 4500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSelectedTransferAmount(amt)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    selectedTransferAmount === amt
                      ? 'border-brand bg-brand/20 text-brand font-bold'
                      : 'border-subtle text-secondary hover:text-primary'
                  }`}
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Target Deficit */}
          <div className={`p-3 rounded border ${isCriticalDeficit ? 'border-rose-500/40 bg-rose-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold flex items-center gap-1 uppercase tracking-wide ${isCriticalDeficit ? 'text-rose' : 'text-emerald'}`}>
                {isCriticalDeficit ? <TrendingDown size={13} /> : <CheckCircle2 size={13} />}
                {isCriticalDeficit ? 'Deficit Area (Affected)' : 'Restored Buffer'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isCriticalDeficit ? 'bg-rose-500/20 text-rose' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {ktmDepot.daysOfCover}d Cover
              </span>
            </div>
            <strong className="text-sm block">{ktmDepot.name}</strong>
            <div className="text-xs text-secondary mt-1 space-y-0.5">
              <div>Stock: <b className="text-primary">{ktmDepot.currentStock?.toLocaleString()} units</b> (Demand: {ktmDepot.dailyDemand}/d)</div>
              <div>Threshold: <b>Min 2.0 Days Required</b></div>
              <div className={`text-xs font-semibold mt-1 ${isCriticalDeficit ? 'text-rose' : 'text-emerald-400'}`}>
                {isCriticalDeficit ? '⚠️ Critical stock depletion! Rebalance required.' : '✓ Balanced operational buffer.'}
              </div>
            </div>
          </div>
        </div>

        {/* 3️⃣ INVENTORY AGENT: MULTI-COMMODITY STOCK MONITOR & ONE-CLICK REDIRECTION */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                3️⃣ Inventory Agent
              </span>
              <span className="text-xs text-secondary font-medium">
                Finds Live Commodity Days of Cover:
              </span>
            </div>
            <span className="text-xs text-secondary">
              Click <b>Redirect & Balance</b> on any commodity lacking stock
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 shadow-md">
            <div className="space-y-2.5">
              {(() => {
                // Read live calculated values from API / DB state
                const comms = ktmDepot.commodities || {
                  'LPG': { currentStock: 480, dailyDemand: 100, daysOfCover: 4.8, status: 'CRITICAL', unit: 'Cylinders' },
                  'Fuel': { currentStock: 1440, dailyDemand: 200, daysOfCover: 7.2, status: 'WARNING', unit: 'kL' },
                  'Produce': { currentStock: 255, dailyDemand: 150, daysOfCover: 1.7, status: 'CRITICAL', unit: 'Tons' },
                  'Grain': { currentStock: 5700, dailyDemand: 300, daysOfCover: 19.0, status: 'HEALTHY', unit: 'Tons' },
                  'Pharma': { currentStock: 680, dailyDemand: 80, daysOfCover: 8.5, status: 'WARNING', unit: 'Crates' }
                };

                const sourceComms = birgunjDepot.commodities || {};

                return Object.entries(comms).map(([name, data]) => {
                  const docNum = Number(data.daysOfCover || (data.currentStock / (data.dailyDemand || 1)).toFixed(1));
                  const isLow = docNum < 3.0;
                  const isWarn = docNum >= 3.0 && docNum < 8.0;
                  const isHealthy = docNum >= 8.0;
                  const dot = isLow ? 'bg-rose-500 animate-pulse' : isWarn ? 'bg-amber-400' : 'bg-emerald-400';
                  const sourceCover = sourceComms[name]?.daysOfCover || '35+';

                  return (
                    <div key={name} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-4 min-w-[150px]">
                        <span className="font-semibold text-sm w-16">{name}</span>
                        <span className="text-xs font-mono text-slate-300 w-16">{docNum} days</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${dot} shadow-sm`} />
                      </div>

                      <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Current: <b className="text-slate-200">{data.currentStock?.toLocaleString()} {data.unit || 'units'}</b> ({data.dailyDemand}/d)</span>
                        <span className="text-slate-500">|</span>
                        <span>Surplus Gateway: <b>{sourceCover}d cover</b></span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isHealthy ? (
                          <button
                            type="button"
                            disabled={reallocateMutation.isPending}
                            onClick={() => {
                              toast.info(`Redirecting ${name} from Surplus Gateway to Kathmandu Valley...`);
                              reallocateMutation.mutate({
                                commodity: name,
                                fromDepotId: 'DEPOT-BRG-01',
                                toDepotId: 'DEPOT-KTM-01',
                                requestedQuantity: name === 'Produce' ? 800 : name === 'LPG' ? 1000 : 1200
                              });
                            }}
                            className={`text-xs px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1.5 ${
                              isLow
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                                : 'bg-amber-600/80 hover:bg-amber-600 text-white'
                            }`}
                            title={`Balance stock: Redirect ${name} to Kathmandu`}
                          >
                            <ArrowRightLeft size={12} />
                            <span>Redirect & Balance {name}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 px-2.5 py-0.5 rounded bg-emerald-500/10 font-semibold flex items-center gap-1">
                            ✓ Balanced ({docNum}d)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Tasks & Regional Depots */}
      <div className="persona-grid-two">
        {/* Left Column: Assigned Tasks */}
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Inter-Hub Transfer & Pre-Positioning Orders</h3>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${taskTab === 'active' ? 'active' : ''}`}
                onClick={() => setTaskTab('active')}
              >
                Active ({activeTasks.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${taskTab === 'completed' ? 'active' : ''}`}
                onClick={() => setTaskTab('completed')}
              >
                Completed ({completedTasks.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${taskTab === 'all' ? 'active' : ''}`}
                onClick={() => setTaskTab('all')}
              >
                All ({tasks.length})
              </button>
            </div>
          </div>

          <div className="task-cards-list">
            {displayedTasks.length === 0 ? (
              <div className="empty-state-box">
                <CheckCircle2 size={24} className="text-emerald mb-2" />
                <p>
                  {taskTab === 'completed'
                    ? 'No completed inventory pre-positioning records in the archive.'
                    : 'No pending pre-positioning orders. Regional safety stock buffers operating stably.'}
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => {
                const isNew = task.status === 'NEW';
                const isAck = task.status === 'ACKNOWLEDGED';
                const isInProgress = task.status === 'IN_PROGRESS';
                const isCompleted = task.status === 'COMPLETED';

                return (
                  <div key={task.task_id} className={`operational-task-card status-${task.status.toLowerCase()}`}>
                    <div className="task-header-row">
                      <span className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</span>
                      <span className="task-status-pill">{task.status.replace('_', ' ')}</span>
                    </div>

                    <h4 className="task-title">{task.title}</h4>
                    <p className="task-desc">{task.description}</p>

                    {task.status_notes && (
                      <div className="task-notes-callout">
                        <small>Depot Telemetry: {task.status_notes}</small>
                      </div>
                    )}

                    <div className="task-actions-row">
                      {isNew && (
                        <Button
                          variant="primary"
                          disabled={acknowledgeMutation.isPending}
                          onClick={() => acknowledgeMutation.mutate({
                            taskId: task.task_id,
                            notes: `Acknowledged by ${currentUser?.fullName || 'Inventory Lead'}. Unsealing emergency reserve vault.`
                          })}
                        >
                          <CheckCircle2 size={14} />
                          <span>Acknowledge Transfer Request</span>
                        </Button>
                      )}

                      {isAck && (
                        <Button
                          variant="primary"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({
                            taskId: task.task_id,
                            status: 'IN_PROGRESS',
                            notes: `Emergency stocks decanted and staged for inter-hub transport conveyance.`
                          })}
                        >
                          <Boxes size={14} />
                          <span>Begin Stock Transfer Preparation</span>
                        </Button>
                      )}

                      {isInProgress && (
                        <Button
                          variant="primary"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({
                            taskId: task.task_id,
                            status: 'COMPLETED',
                            notes: `Emergency reserves released, loaded, and custody transferred to fleet carrier.`
                          })}
                        >
                          <CheckCircle2 size={14} />
                          <span>Confirm Dispatch & Stock Released</span>
                        </Button>
                      )}

                      {isCompleted && (
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-emerald text-sm font-semibold flex items-center gap-1">
                            <CheckCircle2 size={14} /> Transferred & Persisted in SAP HANA
                          </span>
                          {task.updated_at && (
                            <small className="text-xs text-secondary flex items-center gap-1">
                              <Clock size={11} /> Completed at {new Date(task.updated_at).toLocaleTimeString()} by {task.updated_by || 'Inventory Lead'}
                            </small>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: All Regional Depots Monitoring */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Regional Days of Cover (DoC) Stock Matrix</h3>
              <p className="text-xs text-secondary mt-0.5">Live stock replenishment vs depletion across all hubs</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['depots'] })}
              title="Refresh live depot telemetry"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="space-y-3 mt-3">
            {depots.map((depot) => {
              const doc = Number(depot.daysOfCover || 0);
              const isLow = doc < 2.0;
              const isWarn = doc >= 2.0 && doc < 4.0;
              const isSurplus = doc > 8.0;

              return (
                <div key={depot.id} className="p-3 rounded-lg border border-subtle bg-surface">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-sm flex items-center gap-1.5">
                        <MapPin size={13} className="text-brand" />
                        {depot.name}
                      </strong>
                      <span className="text-xs text-secondary block mt-0.5">
                        {depot.commodity} · {depot.region}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        isLow
                          ? 'bg-rose-500/20 text-rose'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber'
                          : isSurplus
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {doc} Days Cover
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2.5">
                    <div className="flex justify-between text-xs text-secondary mb-1">
                      <span>Stock: <b>{depot.currentStock?.toLocaleString()}</b> / {depot.capacity?.toLocaleString()} units</span>
                      <span>Demand: <b>{depot.dailyDemand} / day</b></span>
                    </div>
                    <div className="doc-progress-bar">
                      <div
                        className={`doc-progress-fill ${isLow ? 'critical' : isWarn ? 'warning' : 'safe'}`}
                        style={{ width: `${Math.min(100, Math.max(8, (doc / 12) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-xs flex items-center justify-between">
                    <span className="text-secondary">
                      {isLow
                        ? '🚨 Critical depletion! Inbound re-routing urgently needed.'
                        : isSurplus
                        ? '💎 Surplus strategic reserve ready for corridor dispatch.'
                        : '✓ Healthy operational replenishment rate.'}
                    </span>
                    {isSurplus && isCriticalDeficit && (
                      <button
                        type="button"
                        onClick={() => reallocateMutation.mutate({ fromDepotId: depot.id, toDepotId: 'DEPOT-KTM-01' })}
                        className="text-xs text-brand font-bold hover:underline flex items-center gap-1"
                      >
                        Allocate Stock →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-subtle rounded-md border border-subtle">
            <h4 className="text-xs font-bold uppercase text-secondary tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-brand" />
              Dynamic Days of Cover (DoC) Invariant
            </h4>
            <p className="text-xs text-secondary leading-relaxed">
              Formula: <code>DoC = On-Hand Stock / Daily Consumption Rate</code>. When corridor throughput drops by &gt;50%, the system computes the exact units needed from surplus storage to keep vulnerable healthcare centers above the 48-hour life-support safety threshold.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
