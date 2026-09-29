import { useEffect, useState } from 'react';
import { Bell, RotateCcw, Plus, CheckCircle2, Layers, ChevronDown, LogOut, Radio } from 'lucide-react';
import { Button } from '../ui';
import TabNav from './TabNav';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { flodaApi } from '../../services/flodaApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonaStore, PERSONAS } from '../../store/personaStore';
import { toast } from 'sonner';
import AiStatusBadge from '../../features/ai-intelligence/AiStatusBadge';

export default function AppHeader({ onOpen }) {
  const queryClient = useQueryClient();
  const { currentUser, switchPersona } = usePersonaStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [density, setDensity] = useState('comfortable');

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.role],
    queryFn: () => flodaApi.notifications(currentUser?.role),
    refetchInterval: 5000
  });

  const unreadCount = notifications.filter(n => n.read_status === 'UNREAD').length;

  useEffect(() => {
    document.body.classList.toggle('density-compact', density === 'compact');
  }, [density]);

  const reset = async () => {
    try {
      const data = await flodaApi.reset();
      toast.success(data.message || 'Demo data reset successfully');
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markRead = async (id) => {
    try {
      await flodaApi.markNotificationRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const isAuthority = currentUser?.role === 'AUTHORITY';

  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="brand-badge">
          <Layers size={18} strokeWidth={2.4} />
        </div>
        <div className="brand-text">
          <span className="brand-name">FLODA</span>
          <span className="brand-tag">SAP FEDERATED RESILIENCE</span>
        </div>
      </div>

      <TabNav currentRole={currentUser?.role} />

      <div className="header-actions">
        {/* Reset Demo Button */}
        <Button variant="outline" onClick={reset} title="Reset demo scenario to baseline">
          <RotateCcw size={14} />
          <span>Reset Demo</span>
        </Button>

        {/* Trigger Disruption (Manual Authority Action) */}
        {isAuthority && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" title="Simulate IoT-compatible highway telemetry feeds">
                  <Radio size={14} className="text-emerald animate-pulse" />
                  <span>Telemetry Simulation</span>
                  <ChevronDown size={13} className="text-secondary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[390px] p-2 bg-white text-slate-800 shadow-2xl border border-slate-200 rounded-xl z-[9999]">
                <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1.5 border-b border-slate-100 mb-1">
                  <Radio size={12} className="text-emerald-600" />
                  <span>Simulated IoT-Compatible Feeds</span>
                </DropdownMenuLabel>

                <DropdownMenuItem
                  className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  onClick={async () => {
                    try {
                      toast.info('Simulating IoT Supply-Demand Crisis feed...');
                      const res = await flodaApi.sendTelemetryFeed({
                        scenarioId: 'SUPPLY_DEMAND_CRISIS',
                        location: 'Mugling-Narayanghat KM-36',
                        corridor: 'Birgunj-Kathmandu Arterial Highway',
                        throughputCapacity: 15,
                        averageSpeedKmh: 4.8,
                        status: 'OBSTRUCTED',
                        sensorId: 'IOT-VALLEY-SURGE-01',
                        description: 'Major rockfall blocking arterial highway. Inbound supplies to Kathmandu Valley DC halted; hospital stock plunging into critical deficit.'
                      });
                      toast.success('Supply-Demand Deficit triggered! Kathmandu DC now at 0.9 Days of Cover. Check Inventory tab!');
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <strong className="text-xs text-rose-600 flex items-center gap-1 font-bold">
                    ⚠️ 1. Supply vs Demand Deficit Crisis
                  </strong>
                  <span className="text-xs text-slate-500 leading-snug">
                    Kathmandu Valley hospital stock hits critical deficit (0.9d cover); Birgunj Gateway retains massive surplus.
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  onClick={async () => {
                    try {
                      toast.info('Simulating Trishuli River Flash Flood IoT feed...');
                      const res = await flodaApi.sendTelemetryFeed({
                        scenarioId: 'COLD_CHAIN_ALERT',
                        location: 'Trishuli River Basin KM-48',
                        corridor: 'Prithvi Highway Arterial Link',
                        throughputCapacity: 25,
                        averageSpeedKmh: 7.5,
                        status: 'OBSTRUCTED',
                        sensorId: 'IOT-HIGHWAY-SENS-48',
                        description: 'Monsoon water level threshold exceeded on causeway. Cold-chain perishable food transit impeded.'
                      });
                      toast.success('Perishables Cold-Chain alert triggered across Western Corridor!');
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <strong className="text-xs text-amber-600 flex items-center gap-1 font-bold">
                    ❄️ 2. Cold-Chain & Perishables Flood
                  </strong>
                  <span className="text-xs text-slate-500 leading-snug">
                    Causeway flooded at KM-48. Pokhara refrigerated buffer depleted; requires Narayanghat depot draw.
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  onClick={async () => {
                    try {
                      toast.info('Simulating Port Congestion IoT sensor feed...');
                      const res = await flodaApi.sendTelemetryFeed({
                        scenarioId: 'PORT_CONGESTION',
                        location: 'Nhava Sheva (JNPT) Port',
                        corridor: 'Western Freight Export-Import Corridor',
                        throughputCapacity: 30,
                        averageSpeedKmh: 12.0,
                        status: 'DEGRADED',
                        sensorId: 'IOT-PORT-BERTH-09',
                        description: 'Severe berth bottleneck and container yard backlog. Inbound clearance delayed by 48h.'
                      });
                      toast.success('Port congestion alert activated across maritime corridor!');
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <strong className="text-xs text-blue-600 flex items-center gap-1 font-bold">
                    🚢 3. Maritime Port Container Chokepoint
                  </strong>
                  <span className="text-xs text-slate-500 leading-snug">
                    70% capacity drop at primary maritime container terminal; inland staging yards put on standby.
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  onClick={async () => {
                    try {
                      toast.info('Simulating Highway Clearance & Speed Restoration...');
                      const res = await flodaApi.sendTelemetryFeed({
                        scenarioId: 'NORMAL_REOPEN',
                        location: 'Mugling-Narayanghat KM-36',
                        corridor: 'Birgunj-Kathmandu Arterial Highway',
                        throughputCapacity: 100,
                        averageSpeedKmh: 48.0,
                        status: 'NORMAL',
                        sensorId: 'IOT-HIGHWAY-SENS-48',
                        description: 'Debris cleared. Traffic velocity normalized to 48 km/h. Corridor restored.'
                      });
                      toast.success('Corridor reopened! Normal throughput restored across all regional depots.');
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <strong className="text-xs text-emerald-600 flex items-center gap-1 font-bold">
                    🟢 4. Restore Normal Corridor Velocity
                  </strong>
                  <span className="text-xs text-slate-500 leading-snug">
                    Telemetry confirms unobstructed road conditions (100% capacity). Normal pipeline resumed.
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="primary" onClick={onOpen} title="Trigger a new supply chain disruption scenario">
              <Plus size={15} />
              <span>Trigger Disruption</span>
            </Button>
          </>
        )}

        {/* SAP Generative AI Hub Status Indicator */}
        <AiStatusBadge />

        <div className="header-divider" />

        {/* Real-time Notifications Popover */}
        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <PopoverTrigger asChild>
            <button className="header-icon-button bell" aria-label="Notifications" title="Operational Notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="popover-content">
            <div className="menu-heading">
              <span>Operational Notifications</span>
              <small>{unreadCount} unread for {currentUser?.badge}</small>
            </div>
            <div className="notification-list">
              {notifications.length ? (
                notifications.slice(0, 8).map(notif => (
                  <div
                    className={`notification-row ${notif.read_status === 'UNREAD' ? 'unread' : ''}`}
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                  >
                    <CheckCircle2 size={15} className={notif.severity === 'WARNING' ? 'text-amber' : 'text-sky'} />
                    <span>
                      <b>{notif.title}</b>
                      <small>{notif.message}</small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="menu-empty">No active notifications for {currentUser?.badge}.</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                className="menu-link"
                onClick={async () => {
                  await flodaApi.markAllNotificationsRead(currentUser?.role);
                  queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }}
              >
                Mark all as read
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* Authenticated User Profile & Logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="persona-selector-btn" title="Logged in user profile">
              <span className="persona-avatar" style={{ backgroundColor: currentUser?.color || '#3b82f6' }}>
                {currentUser?.fullName?.split(' ').map(n => n[0]).join('') || 'SV'}
              </span>
              <div className="persona-meta">
                <span className="persona-name-short">{currentUser?.fullName}</span>
                <span className="persona-role-badge">{currentUser?.badge}</span>
              </div>
              <ChevronDown size={14} className="persona-chevron opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dropdown-menu-wide">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <span className="persona-avatar" style={{ backgroundColor: currentUser?.color || '#3b82f6', width: '28px', height: '28px', fontSize: '11px' }}>
                  {currentUser?.fullName?.split(' ').map(n => n[0]).join('')}
                </span>
                <div>
                  <b className="text-sm">{currentUser?.fullName}</b>
                  <p className="text-xs text-secondary">{currentUser?.title}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 text-xs text-secondary flex flex-col gap-1">
              {currentUser?.employeeId && (
                <div><strong>Employee ID:</strong> <span className="font-mono">{currentUser.employeeId}</span></div>
              )}
              <div><strong>Department:</strong> {currentUser?.department || `${currentUser?.badge} Division`}</div>
              <div><strong>Organization:</strong> {currentUser?.org}</div>
              <div><strong>Email:</strong> {currentUser?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}>
              {density === 'comfortable' ? 'Display Density: Compact' : 'Display Density: Comfortable'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose font-semibold flex items-center gap-2"
              onSelect={async () => {
                const { logout } = usePersonaStore.getState();
                await logout();
                toast.info('Logged out from FLODA console');
              }}
            >
              <LogOut size={14} />
              <span>Log Out of Console</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
