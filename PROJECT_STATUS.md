# FLODA (Fairness-Led Operational Disruption Allocation) - Project Status Report

> **Document Status**: Current & Factual (Verified against running codebase & live SAP HANA Cloud instance)  
> **Verification Timestamp**: 2026-09-30 00:40:00 UTC  
> **Environment**: Windows 11 / Node.js v22.16.0 / npm 10.9.2  
> **Database**: Live SAP HANA Cloud (`Hackfest-DB`, Schema: `HACKFEST0238`)

---

## 1. Running Frontend / Backend & Exact Commands

Both the backend API server and frontend dashboard are currently running and verified:

| Service | Port / URL | Working Directory | Launch Command | Process Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API (Express + HANA)** | `http://localhost:4004` | `.../sap-floda-main/server` | `node server.js` | 🟢 **RUNNING** (PID active) |
| **Frontend Webapp (Vite + React)** | `http://localhost:5173` | `.../sap-floda-main/floda-sap/app/floda-dashboard` | `npm run dev` | 🟢 **RUNNING** (Vite v8.3.1) |

### Exact Commands to Reproduce / Restart

```powershell
# 1. Start Backend API Server
cd "c:\Users\hp\Downloads\Sap floda final\SAP Final\SAP Final\sap-floda-main\server"
node server.js

# 2. Start Frontend Dev Server
cd "c:\Users\hp\Downloads\Sap floda final\SAP Final\SAP Final\sap-floda-main\floda-sap\app\floda-dashboard"
npm run dev

# 3. Test HANA Cloud Connectivity Directly
cd "c:\Users\hp\Downloads\Sap floda final\SAP Final\SAP Final\sap-floda-main\server"
node test-conn2.js
```

---

## 2. All Frontend Pages & Features

The active user interface is located in `floda-sap/app/floda-dashboard` (React 19, Tailwind CSS v4, Lucide React, TanStack Query v5, Recharts, Sonner). The UI dynamically adapts based on the authenticated persona:

### A. Authentication & Shell Features
- **Sign In Portal (`/src/features/auth/LoginPage.jsx`)**:
  - Employee ID or email-based login with password.
  - Interactive "Demo Personas Quick-Select" grid (one-click login for Authority, Transport, Logistics, Inventory, Compliance).
  - Account registration modal (creates user in SAP HANA Cloud `FLODA_USERS`).
- **Global App Shell & Header (`/src/components/layout/`)**:
  - Persona badge showing user name, employee ID, role, and organization.
  - Live SAP HANA Cloud connection status indicator (polls `/api/health` every 15s).
  - Pending approval count badge.
  - Role-scoped notifications bell dropdown with mark-as-read and mark-all-read buttons.
  - "Trigger Disruption" modal trigger button.
  - "Simulate Telemetry Feed" trigger button (Sensing Agent IoT telemetry).
  - "Reset Demo Environment" action button (resets HANA tables to baseline).
  - Dark mode / High contrast toggle & Compact density mode toggle.

### B. Corridor Authority View (`role === 'AUTHORITY'`)
- **Executive KPI Ribbon**: Evaluated Manifests, Autonomous Dispatch Rate (%), Human Review Queue count, Immutable Audit Trail count.
- **Disruption Status Pipeline (`DisruptionStatusPipeline.jsx`)**: Visual step-by-step corridor state tracker (Sensed $\rightarrow$ Scenarios Generated $\rightarrow$ Authority Decision $\rightarrow$ Dispatched to Personas $\rightarrow$ Cleared/Resolved). Includes "Resolve Corridor" action button.
- **Autonomous Recommendation Card (`RecommendationCard.jsx`)**: Displays AI Agent pipeline recommendation (Scenario A vs B vs C) with impact metrics, vehicle/inventory requirements, and interactive "Authorize Scenario" / "Decline Scenario" action triggers.
- **Agent Pipeline Status Banner (`AgentPipeline.jsx`)**: Visual state of the 4 autonomous agents (Sensing, Allocation, Guardrail, Optimization).
- **Fairness Rankings Table (`RankingsTable.jsx`)**: Filterable table (All, Auto-Allocated, Pending Review) displaying manifests, composite score sparkline, commodity, weight, and status.
- **Agent Summary Card (`AgentsCard.jsx`)**: Overview of active autonomous agents and automated decisions.
- **Latest Disruption Card (`LatestDisruptionCard.jsx`)**: Shows active highway chokepoint telemetry, blockage severity, and estimated recovery hours.
- **Live Operational Event Stream (`LiveEventStream.jsx`)**: Real-time SSE audit feed showing events as they occur in HANA.
- **Human Review Queue View (`ApprovalQueue.jsx`)**: Full review screen with individual approve/reject controls for high-risk manifests (hazmat, $>10\text{t}$).
- **Decision Audit Trail View (`AuditLogPanel.jsx`)**: Searchable, paginated enterprise audit ledger showing SHA-like immutable log IDs, actors, roles, and rationales.

### C. Transport Lead View (`role === 'TRANSPORT'`)
- **Transport Instructions Queue**: Filter by Active, Completed, or All tasks.
- **Task Card Actions**: "Acknowledge Order" and "Transition Status" (`IN_PROGRESS`, `COMPLETED`, `BLOCKED`) with operator transit notes.
- **Live Active Highway Chokepoint Banner**: Shows real-time corridor blockage, speed limits, and bypass routes.
- **Dispatched Freight List**: Shows all shipments approved by Authority with weight, origin, destination, and carriage constraints.

### D. Logistics Lead View (`role === 'LOGISTICS'`)
- **Warehouse Bay Re-Sequencing Tasks**: Operational directives to stage emergency freight and hold non-critical cargo.
- **Fair Priority Manifest Matrix**: Prioritized manifests with calculated composite scores, cover clocks, and degradation countdowns.
- **Manifest Ingestion Quick-Form**: Allows operational logistics lead to inject new cargo manifests directly into the pipeline.

### E. Inventory Manager View (`role === 'INVENTORY'`)
- **Strategic Regional Depots Dashboard (`InventoryView.jsx`)**:
  - Live Days-of-Cover (DoC) metrics for Kathmandu Valley DC, Birgunj Border Port, Pokhara Regional Hub, and Narayanghat Depot.
  - Multi-commodity stock breakdown (LPG, Fuel, Produce, Grain, Pharma) with health badges (`CRITICAL_DEFICIT`, `WARNING`, `SURPLUS`, `HEALTHY`).
- **Interactive Supply-Demand Balancing Matrix**:
  - Transfer slider / custom input to decant surplus from Birgunj to replenish Kathmandu Valley.
  - One-click "Execute Inter-Depot Rebalance" button (persists to `FLODA_INVENTORY_PLANS`, creates operational dispatch task, logs audit trail, and broadcasts SSE).
- **Inventory Actionable Directives**: Task acknowledgment and execution workflow.

### F. Compliance Officer View (`role === 'COMPLIANCE'`)
- **Hazardous Transit & Corridor Waiver Queue**: Dedicated tasks for issuing emergency transportation waivers and hazardous materials permits.
- **Hazmat Manifest Audit**: Quick filter of high-risk cargo requiring specialized escorts.
- **Regulatory Verification Actions**: Acknowledge, approve waiver, and record compliance justification to SAP HANA Cloud.

---

## 3. All Backend API / OData / SSE Endpoints

All endpoints are hosted on `http://localhost:4004` (defined in `server/server.js`):

### Health & Schema Endpoints
- `GET /api/health`: Executes `SELECT CURRENT_USER, CURRENT_TIMESTAMP FROM DUMMY;` on SAP HANA Cloud and returns database status.
- `GET /api/schema`: Inspects schema tables in `HACKFEST0238` using `SYS.TABLES`.

### Real-Time SSE Stream
- `GET /api/events/stream`: Server-Sent Events (SSE) live connection pool with 15-second heartbeats. Broadcasts `new_event`, `notification`, `disruption_updated`, `decision_propagated`, `task_updated`, `inventory_updated`, `inventory_reallocated`, `disruption_resolved`, and `state_reset`.

### Authentication & RBAC Endpoints
- `POST /api/auth/register`: Registers a new user with bcrypt salt/hash, saves to `FLODA_USERS`, logs audit entry, returns JWT.
- `POST /api/auth/login`: Authenticates via email or employee ID + password, returns JWT token with user object.
- `GET /api/auth/me`: Returns current user from decoded JWT token.
- `POST /api/auth/logout`: Stateless logout acknowledgment.
- `GET /api/auth/users`: Returns list of users (filtered by role for organizational privacy unless requester is `AUTHORITY`).

### Disruption & Autonomous Pipeline Endpoints
- `GET /api/disruptions`: Returns all corridor disruptions from `FLODA_DISRUPTIONS` ordered by `created_at DESC`.
- `POST /api/disruptions`: Triggers multi-agent evaluation pipeline; persists disruption, chokepoint, generates 3 contextual scenarios, creates recommendation, dispatches authority notification.
- `POST /api/disruptions/:id/resolve`: Marks disruption as `RESOLVED`, restores chokepoint capacity to 100%, completes tasks, logs audit, and broadcasts notifications across all 5 roles.
- `POST /api/telemetry/corridor-feed`: Ingests simulated/live IoT highway telemetry (rainfall, river level, road status, infrastructure). Evaluates severe thresholds: triggers autonomous disruption pipeline if capacity $\le 60\%$, or autonomously resolves disruption if capacity $\ge 90\%$.

### Scenarios & Recommendations Endpoints
- `GET /api/scenarios?disruption_id=...`: Fetches generated scenarios (Scenario A, B, C) from `FLODA_SCENARIOS`.
- `GET /api/recommendations?disruption_id=...`: Fetches autonomous recommendations from `FLODA_RECOMMENDATIONS`.

### Authority Decision Endpoints
- `POST /api/decisions`: General decision processor (`APPROVED`, `REJECTED`, `MODIFIED`).
- `POST /api/decisions/:id/approve`: Authority approves scenario; updates recommendation, sets disruption to `MITIGATING`, generates role-specific tasks in `FLODA_TASKS` for Transport, Logistics, Inventory, and Compliance, broadcasts real-time SSE.
- `POST /api/decisions/:id/reject`: Authority rejects scenario; records rationale in `FLODA_DECISIONS` and `FLODA_AUDIT_LOG`.

### Persona Tasks Endpoints
- `GET /api/tasks?role=...`: Fetches tasks from `FLODA_TASKS` (filtered by assigned role unless requester is `AUTHORITY`).
- `POST /api/tasks/:id/acknowledge`: Operator marks task status as `ACKNOWLEDGED`.
- `POST /api/tasks/:id/status`: Updates task status (`IN_PROGRESS`, `COMPLETED`, `BLOCKED`) with operator notes; writes audit log.

### Notifications Endpoints
- `GET /api/notifications?role=...`: Fetches notifications from `FLODA_NOTIFICATIONS` by recipient role.
- `POST /api/notifications/:id/read`: Marks a single notification as `READ`.
- `POST /api/notifications/read-all`: Marks all notifications for a role as `READ`.

### Regional Inventory & Supply-Demand Optimization Endpoints
- `GET /api/inventory/depots`: Returns regional depots with live calculated Days-of-Cover (DoC), capacity utilization, and commodity breakdowns.
- `POST /api/inventory/reallocate`: Rebalances inventory stock between depots; writes to `FLODA_INVENTORY_PLANS`, generates an actionable `FLODA_TASKS` record, creates audit entry, and broadcasts real-time updates.

### Event Log & Enterprise Audit Trail
- `GET /api/events`: Returns the last 50 events from `FLODA_EVENTS`.
- `GET /api/audit`: Returns last 100 entries from `FLODA_AUDIT_LOG` (enforces Authority role privilege).

### Manifest Management & Demo Reset
- `POST /api/manifests`: Ingests a new manifest into `FLODA_MANIFESTS`, calculates Shapley composite priority score, inserts into `FLODA_RANKINGS`, triggers approval flag if $>10\text{t}$ or hazmat, writes audit log.
- `POST /api/reset` (also alias `/odata/v4/ranking/resetAndSeed`): Clears demo records and re-seeds baseline data into SAP HANA Cloud.

### Backward-Compatible OData v4 Endpoints
- `GET /odata/v4/ranking/Manifests`: OData format wrapper for manifests.
- `GET /odata/v4/ranking/rankedManifests()`: OData format wrapper for rankings.
- `GET /odata/v4/ranking/pendingApprovals()`: OData format wrapper for pending approvals.
- `GET /odata/v4/ranking/Chokepoints`: OData format wrapper for chokepoints.
- `GET /odata/v4/ranking/AuditLog`: OData format wrapper for audit log.
- `POST /odata/v4/ranking/approveAllocation`: Approves individual ranking; updates `FLODA_RANKINGS`, creates Transport task, notifies Transport Lead, writes audit log.
- `POST /odata/v4/ranking/rejectAllocation`: Rejects individual ranking; records rejection rationale.
- `POST /odata/v4/ranking/ingestChokepoint`: Triggers pipeline via OData convention.

---

## 4. All HANA Tables / Entities & Important Fields

All 13 tables are physically created and verified in schema `HACKFEST0238`:

```
┌─────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Table Name              │ Key Columns & Data Types                                              │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_USERS             │ user_id (PK), employee_id, email, password_hash, salt, role,          │
│                         │ full_name, organization, created_at                                    │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_DISRUPTIONS       │ disruption_id (PK), disruption_type, location, corridor, severity,    │
│                         │ description, expected_duration_hours, capacity_reduction_percent,      │
│                         │ status, created_by, created_at                                         │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_CHOKEPOINTS       │ chokepoint_id (PK), location, chokepoint_type, severity,               │
│                         │ affected_routes, capacity_reduction_percent,                           │
│                         │ estimated_resolution_hours, status, created_at                         │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_SCENARIOS         │ scenario_id (PK), disruption_id (FK), scenario_code, title,           │
│                         │ description, impact_summary, affected_shipments_count,                 │
│                         │ affected_inventory_count, affected_vehicles_count,                     │
│                         │ estimated_recovery_hours, risk_level, compliance_status,               │
│                         │ is_recommended (BOOLEAN), status, created_at                           │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_RECOMMENDATIONS   │ recommendation_id (PK), disruption_id (FK),                            │
│                         │ recommended_scenario_id (FK), title, rationale, urgency, status,       │
│                         │ decision_id, created_at                                                │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_DECISIONS         │ decision_id (PK), disruption_id (FK), recommendation_id (FK),          │
│                         │ scenario_id (FK), decision_type, decided_by, decided_by_role, notes,   │
│                         │ modifications, decided_at                                              │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_TASKS             │ task_id (PK), disruption_id, decision_id, assigned_role, title,       │
│                         │ description, priority, status, status_notes, updated_by,               │
│                         │ created_at, updated_at                                                 │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_NOTIFICATIONS     │ id (PK), recipient_user, recipient_role, event_type, title, message,   │
│                         │ severity, related_disruption_id, related_decision_id, read_status,     │
│                         │ created_at                                                             │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_EVENTS            │ event_id (PK), event_type, entity_type, entity_id, message, details,   │
│                         │ timestamp                                                              │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_MANIFESTS         │ manifest_id (PK), commodity_type, origin, destination, weight_kg,      │
│                         │ volume_cbm, substitutability, cover_clock_hours,                        │
│                         │ degradation_clock_hours, carriage_constraint, composite_score, status, │
│                         │ created_at                                                             │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_RANKINGS          │ ranking_id (PK), manifest_id (FK), chokepoint_id, priority_rank,       │
│                         │ composite_score, substitutability_score, cover_clock_score,            │
│                         │ degradation_clock_score, carriage_fit_score, allocated ('Y'/'N'),      │
│                         │ requires_approval (BOOLEAN), approval_status, approved_by,             │
│                         │ approved_at, created_at                                                │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_INVENTORY_PLANS   │ plan_id (PK), chokepoint_id, commodity_type,                           │
│                         │ recommended_safety_stock_delta, rationale, created_at                   │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ FLODA_AUDIT_LOG         │ log_id (PK), ranking_id, action, decision_rationale,                   │
│                         │ parameter_values, timestamp, actor, role, entity, entity_id,           │
│                         │ previous_state, new_state                                              │
└─────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Each Agent: Logic, Inputs, Outputs, Tools & Real/Simulated Status

FLODA implements a multi-agent orchestration architecture (`server/agent-orchestrator.js`):

| Agent Name | Role / Function | Inputs | Outputs | Real vs. Simulated | Implemented Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1️⃣ Sensing & Telemetry Agent** | Ingests corridor environmental data, evaluates threshold breach, detects chokepoints | Rainfall ($\text{mm/hr}$), river level ($\text{m}$), road condition, speed ($\text{km/h}$), throughput capacity ($\%$) | Disruption declaration, chokepoint record, capacity loss calculation, triggers or resolves pipeline | 🟡 **Simulated Input / Real Logic**: Real rule-based threshold evaluation code in Node.js, persisted to HANA; input source is HTTP feed / simulator rather than physical IoT sensors. |
| **2️⃣ Impact Analysis & Scenario Agent** | Evaluates downstream supply chain impact; dynamically models 3 alternate recovery strategies | Location, corridor, blockage type, severity, capacity loss, estimated duration | 3 recovery scenarios in `FLODA_SCENARIOS` (Scenario A: Dynamic Reroute, Scenario B: Buffer Pre-positioning, Scenario C: Safe Holding Staging) | 🟢 **Real Business Logic**: Context-aware heuristic generator that computes affected vehicles, shipments, and recovery hours based on Nepal geography. |
| **3️⃣ Fair Allocation & Ranking Agent (Shapley Logic)** | Calculates composite urgency score for each manifest to ensure fair, impartial priority queue | Cargo substitutability ($s$), cover clock hours ($c$), degradation hours ($d$), weight, carriage constraints | Composite score $\in [0, 1]$, rank order, automated dispatch flag (`allocated = 'Y'`) | 🟢 **Real Algorithmic Logic**: Deterministic weighted formula: $(1-s)\times 0.40 + (1-\frac{\min(c,120)}{120})\times 0.35 + (1-\frac{\min(d,720)}{720})\times 0.25$. |
| **4️⃣ Compliance & Policy Guardrail Agent** | Enforces safety laws; intercepts shipments exceeding weight limits or hazardous classifications | Manifest weight ($>10,000\,\text{kg}$), carriage constraint (`hazmat`, `toxic`, `heavy_cargo`) | Sets `requires_approval = TRUE`, `allocated = 'N'`, routes manifest to Authority approval queue, logs escalation audit | 🟢 **Real Business Logic**: Hard safety boundary rule engine running synchronously on every manifest ingestion and disruption event. |
| **5️⃣ Executive Recommendation Agent** | Selects optimal scenario, formulates recommendation rationale, and submits to Authority | Scenario metrics (recovery hours, risk level, throughput restoration $\%$) | `FLODA_RECOMMENDATIONS` record with rationale, urgency, and targeted scenario code | 🟢 **Real Logic**: Submits formal decision bundle to Authority with real-time SSE notifications. |
| **6️⃣ Supply-Demand Rebalancing Agent** | Monitors regional depot Days-of-Cover (DoC); detects destination depletion and triggers inter-depot stock decanting | Depot stock, daily consumption demand, active corridor disruption capacity loss | Optimal transfer delta, `FLODA_INVENTORY_PLANS` record, `FLODA_TASKS` dispatch order, updated DoC | 🟢 **Real Logic**: Continuous inventory depletion and rebalancing calculator. |

---

## 6. Current Authentication / Personas & Permissions

Authentication is fully functional using bcrypt (salt + hash) and standard JWT tokens signed with a 24-hour expiration. All accounts are initialized on server boot:

| Persona | Email | Employee ID | Default Password | Role Key | Real Capabilities in System |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Corridor Authority** | `authority@floda.local` | `EMP-AUTH-101` | `FlodaDemo2026!` | `AUTHORITY` | **Full Executive Access**: Authorize/reject disruption recovery plans, approve/reject high-risk manifests, resolve disruptions, view complete audit ledger, view all users/tasks. |
| **Transport Lead** | `transport@floda.local` | `EMP-TRN-202` | `FlodaDemo2026!` | `TRANSPORT` | **Fleet Execution**: Acknowledge carrier dispatch tasks, update transport operational status (`ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`), view assigned convoy orders. |
| **Logistics Lead** | `logistics@floda.local` | `EMP-LOG-303` | `FlodaDemo2026!` | `LOGISTICS` | **Hub Operations**: Ingest new cargo manifests, review fairness rankings, execute warehouse bay staging tasks, re-sequence bay release queues. |
| **Inventory Manager** | `inventory@floda.local` | `EMP-INV-404` | `FlodaDemo2026!` | `INVENTORY` | **Depot Balancing**: Monitor regional Days-of-Cover (DoC), execute inter-depot stock rebalancing (Birgunj $\rightarrow$ Kathmandu), complete inventory replenishment tasks. |
| **Compliance Officer** | `compliance@floda.local` | `EMP-CMP-505` | `FlodaDemo2026!` | `COMPLIANCE` | **Regulatory Governance**: Review hazmat/heavy cargo manifests, certify disaster emergency corridor clearance waivers, transition compliance tasks. |

---

## 7. Current CAP / BTP Integration Status

- **SAP CAP (`floda-sap/` directory)**:
  - `floda-sap/srv/ranking-service.cds` and `floda-sap/srv/ranking-service.js` define the original CAP Application Service with SQLite / HANA bindings.
  - **Runtime Status**: The active running backend is the native Express + `@sap/hana-client` server (`server/server.js`) rather than `cds watch` or `cds-serve`.
  - **OData v4 Compatibility**: `server/server.js` implements compatibility endpoints mimicking CAP's OData v4 URL structure (`/odata/v4/ranking/...`), ensuring that any OData-compliant caller or UI5 component can consume the same live HANA data.
- **SAP BTP Deployment**:
  - The project is configured with SAP HANA Cloud on BTP (`hna3.prod-eu10.hanacloud.ondemand.com:443`).
  - The server currently runs locally in Node.js while establishing encrypted TLS/SSL sessions directly to the remote SAP BTP HANA Cloud instance.

---

## 8. Current SAP Services Actually Connected

| SAP Service | Endpoint / Instance | Connection Driver | Status |
| :--- | :--- | :--- | :--- |
| **SAP HANA Cloud** | `64e8c26b-3e07-47e9-b246-617058b0306e.hna3.prod-eu10.hanacloud.ondemand.com:443` | `@sap/hana-client` v2.22.28 | 🟢 **ACTIVE & CONNECTED** (Schema: `HACKFEST0238`) |
| **SAP CDS / CAP Tools** | `@sap/cds` v10.1.1, `@cap-js/hana` v3 | Local project libraries | 🟡 Present in `floda-sap`, but runtime routed via Express client |
| **SAP UI5** | `floda-sap/app/com.hacksparrow.floda` | UI5 tooling | ⚪ Static project files present in repo; active dashboard is the Vite React dashboard |
| **SAP AI Core / GenAI Hub** | — | — | 🔴 **NOT CONNECTED** (Agent heuristics are executed in code, not via SAP AI Core) |

---

## 9. End-to-End User / Demo Flows That Work

The following end-to-end flows are tested and working live:

### Flow 1: Disruption Trigger $\rightarrow$ Multi-Agent Pipeline $\rightarrow$ Authority Decision $\rightarrow$ Persona Task Propagation
1. Sign in as **Corridor Authority** (`authority@floda.local`).
2. Click **"Trigger Disruption"** in header. Submit "Mugling-Narayanghat KM-36 Landslide" (85% reduction, 48h duration).
3. The backend:
   - Writes records to `FLODA_DISRUPTIONS` and `FLODA_CHOKEPOINTS`.
   - Re-evaluates ranking approval states.
   - Generates 3 contextual scenarios in `FLODA_SCENARIOS`.
   - Generates recommendation in `FLODA_RECOMMENDATIONS`.
   - Logs events to `FLODA_EVENTS` and sends real-time SSE.
4. Authority dashboard instantly displays the **Disruption Status Pipeline** and the **Recommendation Card** ("Approve Dynamic Reroute via Hetauda-Kathmandu Bypass").
5. Click **"Authorize Scenario"**.
   - Backend records approval in `FLODA_DECISIONS`.
   - Automatically generates 4 actionable records in `FLODA_TASKS` targeted to `TRANSPORT`, `LOGISTICS`, `INVENTORY`, and `COMPLIANCE`.
   - Dispatches real-time SSE notifications.
6. Switch persona to **Transport Lead** (`transport@floda.local`).
   - Transport instruction card appears immediately.
   - Click "Acknowledge Order" $\rightarrow$ Task status transitions to `ACKNOWLEDGED`.
   - Change status to `IN_PROGRESS` or `COMPLETED`. Changes are persisted to `FLODA_TASKS` and `FLODA_AUDIT_LOG`.

### Flow 2: Human-in-the-Loop Policy Escalation & Approval
1. Sign in as **Logistics Lead** (`logistics@floda.local`).
2. Add new high-risk shipment via API or seed (e.g. "High-Altitude Heating Fuel", 18,500 kg, `hazmat`).
3. Compliance Guardrail intercepts it: `requires_approval = TRUE`, status set to `pending`.
4. Switch to **Corridor Authority** $\rightarrow$ Navigate to **Approval Queue**.
5. Manifest appears with red "Hazmat & Payload $>10\text{t}$" badge.
6. Authority clicks **"Approve Allocation"**.
   - Allocation is approved in `FLODA_RANKINGS`.
   - A new transport dispatch task (`TSK-TRN-APP-...`) is created.
   - An immutable audit trail entry is inserted into `FLODA_AUDIT_LOG`.

### Flow 3: Regional Supply-Demand Rebalancing & Days-of-Cover Restoration
1. Sign in as **Inventory Manager** (`inventory@floda.local`).
2. Observe Kathmandu Valley DC in `CRITICAL_DEFICIT` ($< 1.0$ day of cover) while Birgunj Port has $40+$ days surplus.
3. Use the rebalance slider to set $3,200$ units and click **"Execute Inter-Depot Rebalance"**.
4. System updates memory depot stocks, inserts `FLODA_INVENTORY_PLANS`, generates an actionable inventory task in `FLODA_TASKS`, writes to `FLODA_AUDIT_LOG`, and broadcasts SSE.
5. Days-of-Cover for Kathmandu rises to healthy buffer; toast notification confirms success.

### Flow 4: Autonomous Telemetry-Driven Resolution
1. Disruption is active on corridor.
2. Ingest telemetry feed with normal throughput ($\ge 90\%$) or click **"Resolve Corridor"** in Authority view.
3. System marks disruption as `RESOLVED`, resets chokepoint capacity loss to 0%, closes open operational tasks, writes to `FLODA_AUDIT_LOG`, and notifies all 5 personas via SSE.

---

## 10. Features Partially Implemented or Mocked

1. **Regional Depot Master Data**:
   - Depot inventory and Days-of-Cover calculations are computed in-memory in `server/agent-orchestrator.js` (`let regionalDepots = [...]`) with live adjustment against active disruptions. Rebalance plans are saved to `FLODA_INVENTORY_PLANS` in HANA, but depot definitions themselves do not reside in a dedicated `FLODA_DEPOTS` table.
2. **IoT Sensor Ingestion**:
   - Ingestion logic, environmental thresholds (rainfall mm/hr, river gauge meters), and auto-triggers are fully implemented via `POST /api/telemetry/corridor-feed` and the UI simulator, but rely on simulated HTTP payloads rather than live physical sensors.
3. **Agent AI Execution**:
   - The multi-agent pipeline is an autonomous deterministic rule/heuristic engine written in JavaScript with database persistence, rather than an LLM prompt pipeline calling OpenAI or SAP Generative AI Hub.
4. **SAP UI5 Alternative Webapp**:
   - Files exist in `floda-sap/app/com.hacksparrow.floda`, but it is an unbuilt scaffold; the active presentation layer is `floda-dashboard`.

---

## 11. Known Bugs / Minor Nuances

1. **Cold-Start Connection Notice**:
   - On the very first second of `server.js` startup, rapid concurrent queries during `seedUsers()` can occasionally trigger a transient SSL notice (`Cannot create SSL engine` or `Invalid flags`) before the shared HANA connection pool stabilizes. Subsequent queries and all user-initiated actions run smoothly without error.
2. **Port Allocation Warning**:
   - If a developer attempts to start `cds watch` inside `floda-sap` while `server.js` is running, both will attempt to bind to port 4004. `server.js` must remain the sole process on 4004.
3. **Trailing Whitespace in `.env`**:
   - In `server/.env`, `HANA_DATABASE=Hackfest-DB   ` contains 3 trailing spaces. Code trims inputs or defaults correctly, but it is technically present in the file.

---

## 12. Recommended Features for Final Hackathon Presentation

1. **Interactive Geospatial Map**:
   - Add a Leaflet.js or MapLibre interactive map widget showing the Birgunj $\rightarrow$ Narayanghat $\rightarrow$ Kathmandu arterial corridor, plotting live landslide chokepoints and alternate bypass routes visually.
2. **SAP Generative AI Hub / LLM Integration**:
   - Connect an LLM (via SAP AI Core or external API) to generate rich narrative situation reports (SITREPs) based on active HANA chokepoint rows for executive briefings.
3. **Automated Cargo Ingestion Generator**:
   - A small "Burst Traffic Simulator" button in the Logistics view that injects 10 varied manifests at once to showcase the Shapley fairness ranking and automated vs. pending review distribution dynamically.
4. **HANA Spatial or Graph Exploration**:
   - Leverage HANA Graph (`GRAPH_TABLE`) or Spatial coordinates (`ST_POINT`) on the chokepoints table to demonstrate advanced native SAP HANA calculation engine capabilities.
