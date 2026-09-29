import { executeQuery } from './db/hana.js';

// Real-time Event Broadcaster (SSE connections pool)
class RealTimeBroadcaster {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  sendHeartbeat() {
    for (const client of this.clients) {
      try {
        client.write(`: heartbeat\n\n`);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}

export const broadcaster = new RealTimeBroadcaster();
setInterval(() => broadcaster.sendHeartbeat(), 15000);

// Helper to log event to HANA and broadcast
export async function logEvent(eventType, message, details = {}, entityType = 'DISRUPTION', entityId = null) {
  const eventId = `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

  await executeQuery(
    `INSERT INTO FLODA_EVENTS (event_id, event_type, entity_type, entity_id, message, details, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [eventId, eventType, entityType, entityId, message, detailsStr]
  );

  const eventObj = {
    eventId,
    eventType,
    entityType,
    entityId,
    message,
    details: detailsStr,
    timestamp: new Date().toISOString()
  };

  broadcaster.broadcast('new_event', eventObj);
  return eventObj;
}

// Helper to create notifications in HANA and broadcast
export async function createNotification(recipientRole, title, message, severity = 'INFO', disruptionId = null, decisionId = null, recipientUser = null) {
  const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await executeQuery(
    `INSERT INTO FLODA_NOTIFICATIONS (id, recipient_user, recipient_role, event_type, title, message, severity, related_disruption_id, related_decision_id, read_status, created_at)
     VALUES (?, ?, ?, 'DECISION_DISPATCH', ?, ?, ?, ?, ?, 'UNREAD', CURRENT_TIMESTAMP)`,
    [notifId, recipientUser, recipientRole, title, message, severity, disruptionId, decisionId]
  );

  const notifObj = {
    id: notifId,
    recipient_role: recipientRole,
    recipient_user: recipientUser,
    title,
    message,
    severity,
    related_disruption_id: disruptionId,
    related_decision_id: decisionId,
    read_status: 'UNREAD',
    created_at: new Date().toISOString()
  };

  broadcaster.broadcast('notification', notifObj);
  return notifObj;
}

// Orchestrator: Trigger disruption -> Agent pipeline
export async function executeAgentPipeline(disruptionData, createdBy = 'Srivatsan Venkat') {
  const {
    location,
    chokepoint_type = 'landslide',
    severity = 'critical',
    corridor = 'Birgunj-Kathmandu Arterial Highway',
    affected_routes = 'Central Nepal Trans-Himalayan Corridor',
    description = 'Severe corridor blockage impacting essential cargo freight',
    capacity_reduction_percent = 75,
    expected_duration_hours = 48
  } = disruptionData;

  const disruptionId = `DISR-${Date.now()}`;
  const chokepointId = `CP-${Date.now()}`;

  // 1. Persist Disruption & Chokepoint in HANA
  await executeQuery(
    `INSERT INTO FLODA_DISRUPTIONS (disruption_id, disruption_type, location, corridor, severity, description, expected_duration_hours, capacity_reduction_percent, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)`,
    [disruptionId, chokepoint_type, location, corridor, severity, description, Number(expected_duration_hours), Number(capacity_reduction_percent), createdBy]
  );

  await executeQuery(
    `INSERT INTO FLODA_CHOKEPOINTS (chokepoint_id, location, chokepoint_type, severity, affected_routes, capacity_reduction_percent, estimated_resolution_hours, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)`,
    [chokepointId, location, chokepoint_type, severity, affected_routes, Number(capacity_reduction_percent), Number(expected_duration_hours)]
  );

  // Audit entry for disruption creation
  await executeQuery(
    `INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, entity_id, previous_state, new_state)
     VALUES (?, 'DISRUPTION_CREATED', ?, CURRENT_TIMESTAMP, ?, 'AUTHORITY', 'DISRUPTION', ?, 'NORMAL', 'ACTIVE')`,
    [`LOG-${Date.now()}-1`, `Disruption ${chokepoint_type.toUpperCase()} at ${location} triggered by Authority`, createdBy, disruptionId]
  );

  await logEvent('DISRUPTION_CREATED', `Disruption triggered at ${location} on ${corridor}`, { severity, capacity_reduction_percent }, 'DISRUPTION', disruptionId);

  // 2. Sensing & Allocation Engine Re-Evaluation
  await executeQuery(`
    UPDATE FLODA_RANKINGS 
    SET allocated = CASE WHEN requires_approval = TRUE THEN 'N' ELSE 'Y' END,
        approval_status = CASE WHEN requires_approval = TRUE THEN 'pending' ELSE 'approved' END,
        approved_by = CASE WHEN requires_approval = TRUE THEN NULL ELSE 'AGENT_LOGISTICS_AUTO' END,
        approved_at = CASE WHEN requires_approval = TRUE THEN NULL ELSE CURRENT_TIMESTAMP END,
        chokepoint_id = ?
  `, [chokepointId]);

  await logEvent('SENSING_AGENT_COMPLETED', `Sensing agent verified telemetry: ${capacity_reduction_percent}% throughput loss at ${location}`, {}, 'DISRUPTION', disruptionId);

  // 3. Impact & Scenario Analysis Agent
  await logEvent('IMPACT_ANALYSIS_STARTED', `Impact agent evaluating active cargo manifests and downstream regional cover clocks...`, {}, 'DISRUPTION', disruptionId);

  // Helper to generate dynamic recovery scenarios based on disruption context
  const getContextualScenarios = (loc, corr, type, sev, capRed, dur) => {
    const isWater = type === 'flood';
    const isSlide = type === 'landslide';
    const isPort = type === 'port_congestion';
    const isClosure = type === 'road_closure';
    const isWeather = type === 'weather';

    let bypassRouteName = `Secondary Regional Arterial Bypass`;
    let depotName = `Regional Forward Logistics Hub`;
    let stagingHub = `Staging & Transshipment Depot`;

    if (loc.toLowerCase().includes('mugling') || loc.toLowerCase().includes('narayanghat') || corr.toLowerCase().includes('birgunj') || corr.toLowerCase().includes('kathmandu')) {
      bypassRouteName = 'Hetauda-Kathmandu Bypass (Route 2)';
      depotName = 'Narayanghat Strategic Depot';
      stagingHub = 'Birgunj Inland Port';
    } else if (loc.toLowerCase().includes('pokhara') || corr.toLowerCase().includes('prithvi')) {
      bypassRouteName = 'Mugling-Gorkha Ridge Link';
      depotName = 'Pokhara Regional Hub';
      stagingHub = 'Khairenitar Staging Yard';
    } else if (isPort || loc.toLowerCase().includes('port') || loc.toLowerCase().includes('dry port')) {
      bypassRouteName = 'Off-Dock Container Freight Station Lane';
      depotName = 'Bonded Transit Warehouse Hub';
      stagingHub = 'Customs Staging Yard';
    } else {
      bypassRouteName = `Alternate Corridor Bypass for ${loc}`;
      depotName = `Forward Safety Stock Hub`;
      stagingHub = `Upstream Transshipment Yard`;
    }

    const estRecA = Math.max(8, Math.round(dur * 0.35));
    const estRecB = Math.max(16, Math.round(dur * 0.75));
    const estRecC = Math.max(24, Math.round(dur * 1.5));

    let scenarioA = {
      code: 'SCENARIO_A',
      title: isWater
        ? `Dynamic Reroute via ${bypassRouteName} with Elevated Causeway Escort`
        : isPort
          ? `Fast-Track Off-Dock Clearance via ${bypassRouteName} Priority Corridor`
          : isClosure
            ? `Modular Bailey Bridge Crossing via ${bypassRouteName}`
            : isWeather
              ? `Severe Weather Convoy with Police Pilot via ${bypassRouteName}`
              : `Dynamic Reroute via ${bypassRouteName} with Priority Convoy`,
      desc: `Reroute high-priority cargo and life-support supplies through ${bypassRouteName}. Enforces strict safety speed and axle weight regulations to ensure continuous flow around ${loc}.`,
      impact: `Restores up to ${100 - Math.round(capRed * 0.25)}% of critical supply delivery within ${estRecA} hours. Bypasses affected zone on ${corr}.`,
      shipments: Math.max(3, Math.round(capRed / 15)),
      inventory: Math.max(2, Math.round(capRed / 25)),
      vehicles: Math.max(4, Math.round(capRed / 10)),
      recoveryHours: estRecA,
      riskLevel: sev === 'critical' ? 'Moderate' : 'Low',
      compliance: 'Requires Emergency Corridor Authorization Waiver',
      isRec: true
    };

    let scenarioB = {
      code: 'SCENARIO_B',
      title: `Regional Pre-Positioning & ${depotName} Stock Draw`,
      desc: `Divert heavy freight to ${depotName}. Release regional safety buffer reserves to supply critical facilities while ground crews clear ${loc}.`,
      impact: `Provides buffer reserves for downstream destinations. General cargo deliveries delayed by ${estRecB} hours.`,
      shipments: Math.max(5, Math.round(capRed / 10)),
      inventory: Math.max(3, Math.round(capRed / 18)),
      vehicles: Math.max(6, Math.round(capRed / 8)),
      recoveryHours: estRecB,
      riskLevel: 'Low',
      compliance: 'Standard Regional Buffer SOP Compliant',
      isRec: false
    };

    let scenarioC = {
      code: 'SCENARIO_C',
      title: `Hold & Safe Staging at ${stagingHub} Pending Infrastructure Clearance`,
      desc: `Hold all non-urgent inbound transit at ${stagingHub} until ${type.replace('_', ' ')} clearance is verified at ${loc}. Auxiliary power maintained for sensitive cargo.`,
      impact: `Zero collision/breakdown risk along disrupted corridor, but downstream safety buffer drops significantly over ${estRecC} hours.`,
      shipments: Math.max(6, Math.round(capRed / 8)),
      inventory: Math.max(4, Math.round(capRed / 14)),
      vehicles: Math.max(8, Math.round(capRed / 6)),
      recoveryHours: estRecC,
      riskLevel: 'High',
      compliance: 'Transit Holding & Delay Notification Required',
      isRec: false
    };

    return { scenarioA, scenarioB, scenarioC };
  };

  const { scenarioA, scenarioB, scenarioC } = getContextualScenarios(
    location,
    corridor,
    chokepoint_type,
    severity,
    Number(capacity_reduction_percent),
    Number(expected_duration_hours)
  );

  // Scenarios generation
  const scenarioAId = `SCN-${Date.now()}-A`;
  const scenarioBId = `SCN-${Date.now()}-B`;
  const scenarioCId = `SCN-${Date.now()}-C`;

  // Scenario A: Dynamic Reroute (Recommended)
  await executeQuery(
    `INSERT INTO FLODA_SCENARIOS (scenario_id, disruption_id, scenario_code, title, description, impact_summary, affected_shipments_count, affected_inventory_count, affected_vehicles_count, estimated_recovery_hours, risk_level, compliance_status, is_recommended, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, 'PROPOSED', CURRENT_TIMESTAMP)`,
    [
      scenarioAId,
      disruptionId,
      scenarioA.code,
      scenarioA.title,
      scenarioA.desc,
      scenarioA.impact,
      scenarioA.shipments,
      scenarioA.inventory,
      scenarioA.vehicles,
      scenarioA.recoveryHours,
      scenarioA.riskLevel,
      scenarioA.compliance
    ]
  );

  // Scenario B: Pre-positioning
  await executeQuery(
    `INSERT INTO FLODA_SCENARIOS (scenario_id, disruption_id, scenario_code, title, description, impact_summary, affected_shipments_count, affected_inventory_count, affected_vehicles_count, estimated_recovery_hours, risk_level, compliance_status, is_recommended, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'PROPOSED', CURRENT_TIMESTAMP)`,
    [
      scenarioBId,
      disruptionId,
      scenarioB.code,
      scenarioB.title,
      scenarioB.desc,
      scenarioB.impact,
      scenarioB.shipments,
      scenarioB.inventory,
      scenarioB.vehicles,
      scenarioB.recoveryHours,
      scenarioB.riskLevel,
      scenarioB.compliance
    ]
  );

  // Scenario C: Hold & Stage
  await executeQuery(
    `INSERT INTO FLODA_SCENARIOS (scenario_id, disruption_id, scenario_code, title, description, impact_summary, affected_shipments_count, affected_inventory_count, affected_vehicles_count, estimated_recovery_hours, risk_level, compliance_status, is_recommended, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'PROPOSED', CURRENT_TIMESTAMP)`,
    [
      scenarioCId,
      disruptionId,
      scenarioC.code,
      scenarioC.title,
      scenarioC.desc,
      scenarioC.impact,
      scenarioC.shipments,
      scenarioC.inventory,
      scenarioC.vehicles,
      scenarioC.recoveryHours,
      scenarioC.riskLevel,
      scenarioC.compliance
    ]
  );

  await logEvent('IMPACT_ANALYSIS_COMPLETED', `Impact analysis for ${location}: ${scenarioA.shipments + scenarioB.shipments} manifests affected. 3 recovery scenarios generated.`, { scenarios: ['A', 'B', 'C'] }, 'DISRUPTION', disruptionId);

  // 4. Logistics & Transport Agent Analysis
  await logEvent('LOGISTICS_ANALYSIS_COMPLETED', `Logistics Agent: Evaluated bypass capacity for ${location}. ${scenarioA.vehicles} vehicles fit prioritized convoy criteria.`, {}, 'DISRUPTION', disruptionId);

  // 5. Inventory Agent Analysis
  await logEvent('INVENTORY_ANALYSIS_COMPLETED', `Inventory Agent: Downstream hospital & essential depot cover calculated at ${(scenarioA.recoveryHours / 24).toFixed(1)} days under active disruption.`, {}, 'DISRUPTION', disruptionId);

  // 6. Compliance Agent Guardrail Check
  await logEvent('COMPLIANCE_AGENT_CHECK', `Compliance Agent: Policy validation complete for ${chokepoint_type.toUpperCase()} response. Human authorization required.`, {}, 'DISRUPTION', disruptionId);

  // 7. Decision Recommendation Creation
  const recId = `REC-${Date.now()}`;
  const recTitle = `Approve ${scenarioA.title} (Scenario A)`;
  const recRationale = `${scenarioA.title} maintains critical supply chain continuity for destination hubs impacted by ${chokepoint_type.replace('_', ' ')} at ${location} (${corridor}), restoring operations within ${scenarioA.recoveryHours}h.`;

  await executeQuery(
    `INSERT INTO FLODA_RECOMMENDATIONS (recommendation_id, disruption_id, recommended_scenario_id, title, rationale, urgency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', CURRENT_TIMESTAMP)`,
    [recId, disruptionId, scenarioAId, recTitle, recRationale, severity.toUpperCase()]
  );

  await logEvent('RECOMMENDATION_CREATED', `Autonomous recommendation submitted to Corridor Authority approval queue: ${recTitle}`, { recommendationId: recId, scenario: 'Scenario A' }, 'RECOMMENDATION', recId);

  // Notify Corridor Authority
  await createNotification(
    'AUTHORITY',
    'Action Required: Disruption Recovery Recommendation',
    `Disruption at ${location} on ${corridor} has generated Recovery Plan (${recTitle}). Awaiting your executive authorization.`,
    severity === 'critical' ? 'WARNING' : 'INFO',
    disruptionId,
    null
  );

  broadcaster.broadcast('disruption_updated', { disruptionId, status: 'RECOMMENDATION_READY' });

  return {
    disruptionId,
    chokepointId,
    scenarios: [scenarioAId, scenarioBId, scenarioCId],
    recommendationId: recId
  };
}

// Process Authority Decision (APPROVE / REJECT / MODIFY) and Propagate
export async function processAuthorityDecision(decisionData) {
  const {
    recommendationId,
    disruptionId,
    scenarioId,
    decisionType = 'APPROVED',
    decidedBy = 'Srivatsan Venkat',
    decidedByRole = 'AUTHORITY',
    notes = 'Authorized under emergency executive authority',
    modifications = null
  } = decisionData;

  const decisionId = `DEC-${Date.now()}`;

  // 1. Record Decision in HANA
  await executeQuery(
    `INSERT INTO FLODA_DECISIONS (decision_id, disruption_id, recommendation_id, scenario_id, decision_type, decided_by, decided_by_role, notes, modifications, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [decisionId, disruptionId, recommendationId, scenarioId, decisionType, decidedBy, decidedByRole, notes, modifications]
  );

  // 2. Update Recommendation and Scenario status
  if (recommendationId) {
    await executeQuery(
      `UPDATE FLODA_RECOMMENDATIONS SET status = ?, decision_id = ? WHERE recommendation_id = ?`,
      [decisionType, decisionId, recommendationId]
    );
  }

  if (scenarioId) {
    await executeQuery(
      `UPDATE FLODA_SCENARIOS SET status = ? WHERE scenario_id = ?`,
      [decisionType, scenarioId]
    );
  }

  // 3. Update Disruption status
  await executeQuery(
    `UPDATE FLODA_DISRUPTIONS SET status = ? WHERE disruption_id = ?`,
    [decisionType === 'APPROVED' ? 'MITIGATING' : 'REJECTED', disruptionId]
  );

  // 4. Update Rankings allocations
  if (decisionType === 'APPROVED') {
    await executeQuery(
      `UPDATE FLODA_RANKINGS SET allocated = 'Y', approval_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE approval_status = 'pending'`,
      [decidedBy]
    );
  }

  // 5. Audit Log Entry
  await executeQuery(
    `INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, entity_id, previous_state, new_state)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'DECISION', ?, 'PENDING_REVIEW', ?)`,
    [`LOG-${Date.now()}-DEC`, `DECISION_${decisionType}`, notes, decidedBy, decidedByRole, decisionId, decisionType]
  );

  await logEvent(
    `AUTHORITY_DECISION_${decisionType}`,
    `Corridor Authority ${decidedBy} ${decisionType.toLowerCase()} recovery plan: ${notes}`,
    { decisionId, disruptionId, scenarioId },
    'DECISION',
    decisionId
  );

  if (decisionType === 'APPROVED') {
    // 6. GENERATE PERSONA TASKS IN SAP HANA BASED ON DISRUPTION AND SCENARIO
    const disruptionRows = await executeQuery(`SELECT * FROM FLODA_DISRUPTIONS WHERE disruption_id = ?`, [disruptionId]);
    const scenarioRows = await executeQuery(`SELECT * FROM FLODA_SCENARIOS WHERE scenario_id = ?`, [scenarioId]);
    const activeDisr = disruptionRows[0] || {};
    const activeScen = scenarioRows[0] || {};

    const loc = activeDisr.location || 'Corridor Hotspot';
    const disrType = (activeDisr.disruption_type || 'Disruption').toUpperCase();
    const scenTitle = activeScen.title || 'Dynamic Reroute & Staging';

    const tasks = [
      {
        id: `TSK-TRN-${Date.now()}`,
        role: 'TRANSPORT',
        title: `Execute Transport Operations: ${scenTitle}`,
        desc: `Dispatch convoy and enforce axle load/speed restrictions around ${loc}. Active routing: ${activeScen.description || scenTitle}.`,
        priority: activeDisr.severity === 'critical' ? 'CRITICAL' : 'HIGH'
      },
      {
        id: `TSK-LOG-${Date.now()}`,
        role: 'LOGISTICS',
        title: `Re-sequence Hub Dispatch Priority (${disrType} Response)`,
        desc: `Re-prioritize life-support manifests to immediate bay release. Hold non-critical dry cargo at staging yard until corridor capacity reaches baseline.`,
        priority: 'HIGH'
      },
      {
        id: `TSK-INV-${Date.now()}`,
        role: 'INVENTORY',
        title: `Strategic Inventory Buffer Allocation for ${loc}`,
        desc: `Unlock regional reserve safety inventory. Pre-position stocks to support critical receiving facilities for up to ${activeScen.estimated_recovery_hours || 24} hours.`,
        priority: activeDisr.severity === 'critical' ? 'CRITICAL' : 'MEDIUM'
      },
      {
        id: `TSK-CMP-${Date.now()}`,
        role: 'COMPLIANCE',
        title: `Issue Emergency Corridor Clearance Waiver (${disrType})`,
        desc: `Certify regulatory inspection waivers and audit adherence under Disaster Management Protocol for freight bypassing ${loc}.`,
        priority: 'HIGH'
      }
    ];

    for (const t of tasks) {
      await executeQuery(
        `INSERT INTO FLODA_TASKS (task_id, disruption_id, decision_id, assigned_role, title, description, priority, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', CURRENT_TIMESTAMP)`,
        [t.id, disruptionId, decisionId, t.role, t.title, t.desc, t.priority]
      );

      // Create Notification for each affected persona
      await createNotification(
        t.role,
        `New Operational Action: ${t.title}`,
        t.desc,
        t.priority === 'CRITICAL' ? 'WARNING' : 'INFO',
        disruptionId,
        decisionId
      );
    }

    await logEvent('TASKS_DISPATCHED', 'Operational instructions propagated in real-time to Transport, Logistics, Inventory, and Compliance personas.', { taskCount: tasks.length }, 'DECISION', decisionId);
  }

  broadcaster.broadcast('decision_propagated', { decisionId, disruptionId, decisionType });

  return { decisionId, decisionType, status: 'SUCCESS' };
}

// Update Task Status (ACKNOWLEDGE / IN_PROGRESS / COMPLETED / BLOCKED)
export async function updateTaskStatus(taskId, status, user, role, notes = '') {
  await executeQuery(
    `UPDATE FLODA_TASKS SET status = ?, status_notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
    [status, notes, user, taskId]
  );

  // Audit entry for task status transition
  await executeQuery(
    `INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, entity_id, previous_state, new_state)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'TASK', ?, 'PREVIOUS', ?)`,
    [`LOG-${Date.now()}-TSK`, `TASK_${status.toUpperCase()}`, notes || `Task marked ${status} by ${user}`, user, role, taskId, status]
  );

  await logEvent(
    `TASK_${status.toUpperCase()}`,
    `${role} Operator (${user}) transitioned task to ${status.replace('_', ' ')}${notes ? `: ${notes}` : ''}`,
    { taskId, status, notes },
    'TASK',
    taskId
  );

  broadcaster.broadcast('task_updated', { taskId, status, user, role, notes, timestamp: new Date().toISOString() });

  return { taskId, status, updated_by: user };
}

// Reset Demo Data
export async function resetDemoState() {
  // Clear demo records from HANA
  await executeQuery(`DELETE FROM FLODA_TASKS`);
  await executeQuery(`DELETE FROM FLODA_NOTIFICATIONS`);
  await executeQuery(`DELETE FROM FLODA_EVENTS`);
  await executeQuery(`DELETE FROM FLODA_DECISIONS`);
  await executeQuery(`DELETE FROM FLODA_RECOMMENDATIONS`);
  await executeQuery(`DELETE FROM FLODA_SCENARIOS`);
  await executeQuery(`DELETE FROM FLODA_DISRUPTIONS`);
  await executeQuery(`DELETE FROM FLODA_INVENTORY_PLANS`).catch(() => {});
  await executeQuery(`DELETE FROM FLODA_CHOKEPOINTS WHERE chokepoint_id LIKE 'CP-%'`);

  // Restore in-memory regional depot stocks to baseline
  if (regionalDepots && regionalDepots.length >= 2) {
    regionalDepots[0].currentStock = 4500;
    regionalDepots[1].currentStock = 29500;
    if (regionalDepots[0].commodities) {
      regionalDepots[0].commodities['LPG'].currentStock = 1400;
      regionalDepots[0].commodities['LPG'].daysOfCover = 14.0;
      regionalDepots[0].commodities['LPG'].status = 'HEALTHY';
      regionalDepots[0].commodities['Fuel'].currentStock = 3000;
      regionalDepots[0].commodities['Fuel'].daysOfCover = 15.0;
      regionalDepots[0].commodities['Fuel'].status = 'HEALTHY';
      regionalDepots[0].commodities['Produce'].currentStock = 1800;
      regionalDepots[0].commodities['Produce'].daysOfCover = 12.0;
      regionalDepots[0].commodities['Produce'].status = 'HEALTHY';
    }
  }

  // Re-seed baseline chokepoints and audit
  await executeQuery(`
    INSERT INTO FLODA_CHOKEPOINTS (chokepoint_id, location, chokepoint_type, severity, affected_routes, capacity_reduction_percent, estimated_resolution_hours, status, created_at)
    VALUES ('CP-NEPAL-001', 'Mugling-Narayanghat KM-36', 'landslide', 'critical', 'Birgunj-Kathmandu Arterial', 80, 48, 'ACTIVE', CURRENT_TIMESTAMP)
  `).catch(() => { });

  await executeQuery(`
    UPDATE FLODA_RANKINGS SET allocated = 'N', approval_status = 'pending', approved_by = NULL, approved_at = NULL WHERE requires_approval = TRUE
  `);

  await executeQuery(`
    INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, new_state)
    VALUES (?, 'DEMO_STATE_RESET', 'Demo environment restored to baseline operational state', CURRENT_TIMESTAMP, 'SYSTEM_ADMIN', 'SYSTEM', 'SYSTEM', 'NORMAL_OPERATIONS')
  `, [`LOG-${Date.now()}-RST`]);

  await logEvent('DEMO_RESET', 'Demo environment restored to normal operations baseline state.', {}, 'SYSTEM', 'SYS-001');

  broadcaster.broadcast('state_reset', { message: 'Demo environment reset successfully' });
  broadcaster.broadcast('inventory_updated', { depots: await getInventoryDepots() });
  return { success: true, message: 'FLODA demo state reset to baseline operational state in SAP HANA Cloud' };
}

// ==========================================
// AUTO-RESOLUTION & RECOVERY PIPELINE
// ==========================================
export async function resolveDisruption(disruptionId, resolvedBy = 'Autonomous Sensing Agent', notes = 'Corridor infrastructure cleared. Baseline throughput fully restored.') {
  const disruptionRows = await executeQuery(`SELECT * FROM FLODA_DISRUPTIONS WHERE disruption_id = ?`, [disruptionId]);
  const disruption = disruptionRows[0] || {};
  const location = disruption.location || 'Corridor';

  // 1. Mark Disruption as RESOLVED in HANA
  await executeQuery(
    `UPDATE FLODA_DISRUPTIONS SET status = 'RESOLVED' WHERE disruption_id = ?`,
    [disruptionId]
  );

  // 2. Mark Chokepoint as INACTIVE / RESOLVED
  await executeQuery(
    `UPDATE FLODA_CHOKEPOINTS SET status = 'RESOLVED', capacity_reduction_percent = 0 WHERE location = ? OR chokepoint_id LIKE 'CP-%'`,
    [location]
  );

  // 3. Mark Recommendation as ARCHIVED/RESOLVED
  await executeQuery(
    `UPDATE FLODA_RECOMMENDATIONS SET status = 'RESOLVED' WHERE disruption_id = ?`,
    [disruptionId]
  );

  // 4. Mark operational tasks for this disruption as COMPLETED/STANDBY
  await executeQuery(
    `UPDATE FLODA_TASKS SET status = 'COMPLETED', status_notes = 'Corridor obstruction cleared. Standard baseline routing resumed.' WHERE disruption_id = ? AND status != 'COMPLETED'`,
    [disruptionId]
  );

  // 5. Audit Log Entry
  const logId = `LOG-${Date.now()}-RES`;
  await executeQuery(
    `INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, entity_id, previous_state, new_state)
     VALUES (?, 'DISRUPTION_RESOLVED', ?, CURRENT_TIMESTAMP, ?, 'SYSTEM', 'DISRUPTION', ?, 'ACTIVE', 'RESOLVED')`,
    [logId, notes, resolvedBy, disruptionId]
  );

  // 6. Broadcast Real-Time Notifications across all departments
  const roles = ['AUTHORITY', 'TRANSPORT', 'LOGISTICS', 'INVENTORY', 'COMPLIANCE'];
  for (const r of roles) {
    await createNotification(
      r,
      `Corridor Restored: ${location}`,
      `Disruption at ${location} has been successfully resolved. Normal operational routing restored.`,
      'INFO',
      disruptionId
    );
  }

  await logEvent(
    'DISRUPTION_RESOLVED',
    `Corridor cleared at ${location}. Baseline traffic & supply allocations restored to 100%.`,
    { disruptionId, resolvedBy },
    'DISRUPTION',
    disruptionId
  );

  broadcaster.broadcast('disruption_resolved', { disruptionId, location, status: 'RESOLVED' });
  return { success: true, disruptionId, status: 'RESOLVED', message: `Disruption at ${location} resolved successfully.` };
}

// ==========================================
// AUTOMATED IoT / TELEMETRY INGESTION ENGINE
// ==========================================
export async function processCorridorTelemetry(telemetry) {
  const {
    scenarioId = 'GENERIC',
    corridor = 'Birgunj-Kathmandu Arterial Highway',
    location = 'Mugling-Narayanghat KM-36',
    throughputCapacity = null, // percentage (0 - 100)
    averageSpeedKmh = 45,
    status = 'NORMAL', // 'NORMAL' | 'DEGRADED' | 'OBSTRUCTED'
    sensorId = 'IOT-SENSING-AGENT-01',
    description = 'Autonomous telemetry update',
    demandSurge = false,
    // Sensing Agent Environmental Telemetry
    rainfall = null, // e.g. "145 mm/hr (Torrential)"
    riverLevel = null, // e.g. "9.8m (Above Danger Threshold)"
    roadStatus = null, // e.g. "Submerged / Mudslide Breach"
    infrastructureDisruption = null // e.g. "Bridge Abutment Compromised"
  } = telemetry;

  // 1️⃣ Sensing Agent evaluates environmental parameters:
  // If rainfall > 100mm, river level > danger threshold, road obstructed or infra disrupted, capacity expected to fall to 0%
  let computedCapacity = throughputCapacity !== null ? Number(throughputCapacity) : 100;
  let sensingDetails = [];

  if (rainfall) sensingDetails.push(`Rainfall: ${rainfall}`);
  if (riverLevel) sensingDetails.push(`River Level: ${riverLevel}`);
  if (roadStatus) sensingDetails.push(`Road Status: ${roadStatus}`);
  if (infrastructureDisruption) sensingDetails.push(`Infrastructure: ${infrastructureDisruption}`);

  const isSevereEnvironmental =
    (rainfall && (String(rainfall).includes('Torrential') || parseInt(rainfall) > 80)) ||
    (riverLevel && (String(riverLevel).includes('Danger') || parseFloat(riverLevel) > 8.0)) ||
    (roadStatus && (String(roadStatus).toLowerCase().includes('submerged') || String(roadStatus).toLowerCase().includes('breach') || String(roadStatus).toLowerCase().includes('blocked'))) ||
    (infrastructureDisruption && infrastructureDisruption !== 'Normal');

  if (isSevereEnvironmental && throughputCapacity === null) {
    computedCapacity = 0; // Route capacity expected to fall to 0%
  }

  const capacityDrop = 100 - computedCapacity;

  // If this is a supply-demand crisis simulation preset, adjust inventory levels
  if (scenarioId === 'SUPPLY_DEMAND_CRISIS' || capacityDrop >= 70) {
    regionalDepots[0].currentStock = 820; // Kathmandu DC drops to 0.9 days
    regionalDepots[1].currentStock = 29500; // Birgunj has massive surplus
    if (regionalDepots[0].commodities) {
      regionalDepots[0].commodities['LPG'].daysOfCover = 4.8;
      regionalDepots[0].commodities['Fuel'].daysOfCover = 7.2;
      regionalDepots[0].commodities['Produce'].daysOfCover = 1.7;
      regionalDepots[0].commodities['Grain'].daysOfCover = 19.0;
      regionalDepots[0].commodities['Pharma'].daysOfCover = 8.5;
    }
  } else if (scenarioId === 'COLD_CHAIN_ALERT') {
    regionalDepots[2].currentStock = 1800; // Pokhara cold chain drops
  }

  // Check active disruptions for this location
  const activeDisruptions = await executeQuery(
    `SELECT * FROM FLODA_DISRUPTIONS WHERE location = ? AND (status = 'ACTIVE' OR status = 'MITIGATING')`,
    [location]
  );

  // CASE 1: Normal throughput (>= 90%) and active disruption exists -> AUTONOMOUS RESOLUTION
  if (computedCapacity >= 90 && activeDisruptions.length > 0) {
    const targetDisruption = activeDisruptions[0];
    const resolved = await resolveDisruption(
      targetDisruption.disruption_id,
      `Autonomous Sensing Agent (${sensorId})`,
      `Telemetry verified: Traffic velocity ${averageSpeedKmh} km/h with ${computedCapacity}% throughput. Corridor reopened.`
    );
    // Restore baseline stocks
    regionalDepots[0].currentStock = 4500;
    broadcaster.broadcast('inventory_updated', { depots: await getInventoryDepots() });
    return resolved;
  }

  // CASE 2: Capacity drop >= 40% (throughput <= 60%) -> AUTONOMOUS INGESTION & PIPELINE TRIGGER
  if (computedCapacity <= 60) {
    const severity = capacityDrop >= 70 ? 'critical' : capacityDrop >= 50 ? 'high' : 'medium';
    const chokepointType = status === 'OBSTRUCTED' || infrastructureDisruption ? 'infrastructure_failure' : 'weather';

    const sensorSummary = sensingDetails.length > 0 ? ` [Sensing Agent Telemetry: ${sensingDetails.join(' | ')}]` : '';
    const outcomeText = computedCapacity === 0
      ? 'Route capacity expected to fall to 0%.'
      : `Route capacity dropped to ${computedCapacity}%.`;

    const result = await executeAgentPipeline({
      location,
      corridor,
      chokepoint_type: chokepointType,
      severity,
      capacity_reduction_percent: capacityDrop,
      expected_duration_hours: Math.max(12, Math.round(capacityDrop * 0.6)),
      affected_routes: `${corridor} Trans-Himalayan Arterial`,
      description: `[1️⃣ Sensing Agent Alert - ${sensorId}]: ${outcomeText}${sensorSummary} ${description}`
    }, `Autonomous Sensing Agent (${sensorId})`);

    await logEvent(
      'AUTONOMOUS_SENSING_TRIGGERED',
      `1️⃣ Sensing Agent at ${location} detected ${capacityDrop}% throughput loss. ${outcomeText}${sensorSummary}`,
      { sensorId, rainfall, riverLevel, roadStatus, infrastructureDisruption, computedCapacity, scenarioId },
      'TELEMETRY',
      sensorId
    );

    broadcaster.broadcast('inventory_updated', { depots: await getInventoryDepots() });

    return {
      success: true,
      action: 'AUTONOMOUS_PIPELINE_EXECUTED',
      disruptionId: result.disruptionId,
      capacityDrop,
      location,
      scenarioId
    };
  }

  return {
    success: true,
    action: 'TELEMETRY_LOGGED_NORMAL',
    throughputCapacity,
    status
  };
}

// ==========================================
// REGIONAL INVENTORY & DAYS OF COVER (DoC) ENGINE
// ==========================================
let regionalDepots = [
  {
    id: 'DEPOT-KTM-01',
    name: 'Kathmandu Valley Destination DC',
    region: 'Central Nepal (Destination Zone)',
    commodity: 'Pharmaceuticals & Cryo Vaccines',
    capacity: 10000,
    currentStock: 820,
    dailyDemand: 900,
    role: 'DESTINATION_FULFILLMENT',
    transitTimeHours: 6,
    commodities: {
      'LPG': { currentStock: 480, dailyDemand: 100, daysOfCover: 4.8, status: 'CRITICAL', unit: 'Cylinders' },
      'Fuel': { currentStock: 1440, dailyDemand: 200, daysOfCover: 7.2, status: 'WARNING', unit: 'kL' },
      'Produce': { currentStock: 255, dailyDemand: 150, daysOfCover: 1.7, status: 'CRITICAL', unit: 'Tons' },
      'Grain': { currentStock: 5700, dailyDemand: 300, daysOfCover: 19.0, status: 'HEALTHY', unit: 'Tons' },
      'Pharma': { currentStock: 680, dailyDemand: 80, daysOfCover: 8.5, status: 'WARNING', unit: 'Crates' }
    }
  },
  {
    id: 'DEPOT-BRG-01',
    name: 'Birgunj Border Inland Transshipment Hub',
    region: 'Southern Border (National Gateway)',
    commodity: 'Strategic Reserve Stock (All Commodities)',
    capacity: 50000,
    currentStock: 29500,
    dailyDemand: 1800,
    role: 'STRATEGIC_IMPORT_GATEWAY',
    transitTimeHours: 8,
    commodities: {
      'LPG': { currentStock: 5200, dailyDemand: 120, daysOfCover: 43.3, status: 'SURPLUS', unit: 'Cylinders' },
      'Fuel': { currentStock: 8900, dailyDemand: 250, daysOfCover: 35.6, status: 'SURPLUS', unit: 'kL' },
      'Produce': { currentStock: 3400, dailyDemand: 180, daysOfCover: 18.8, status: 'SURPLUS', unit: 'Tons' },
      'Grain': { currentStock: 14000, dailyDemand: 350, daysOfCover: 40.0, status: 'SURPLUS', unit: 'Tons' },
      'Pharma': { currentStock: 4200, dailyDemand: 90, daysOfCover: 46.6, status: 'SURPLUS', unit: 'Crates' }
    }
  },
  {
    id: 'DEPOT-PKR-01',
    name: 'Pokhara Regional Hub',
    region: 'Western Corridor Hub',
    commodity: 'Cold-Chain Perishables & Essentials',
    capacity: 20000,
    currentStock: 8400,
    dailyDemand: 1400,
    role: 'REGIONAL_BUFFER',
    transitTimeHours: 5,
    commodities: {
      'LPG': { currentStock: 1200, dailyDemand: 80, daysOfCover: 15.0, status: 'HEALTHY', unit: 'Cylinders' },
      'Fuel': { currentStock: 2100, dailyDemand: 150, daysOfCover: 14.0, status: 'HEALTHY', unit: 'kL' },
      'Produce': { currentStock: 850, dailyDemand: 120, daysOfCover: 7.0, status: 'HEALTHY', unit: 'Tons' },
      'Grain': { currentStock: 3200, dailyDemand: 200, daysOfCover: 16.0, status: 'HEALTHY', unit: 'Tons' },
      'Pharma': { currentStock: 950, dailyDemand: 70, daysOfCover: 13.5, status: 'HEALTHY', unit: 'Crates' }
    }
  },
  {
    id: 'DEPOT-NAR-01',
    name: 'Narayanghat Mid-Corridor Buffer Depot',
    region: 'Prithvi Highway Confluence',
    commodity: 'Emergency Safety Reserve Stock',
    capacity: 15000,
    currentStock: 6200,
    dailyDemand: 1000,
    role: 'INTER_HUB_STAGING',
    transitTimeHours: 4,
    commodities: {
      'LPG': { currentStock: 900, dailyDemand: 60, daysOfCover: 15.0, status: 'HEALTHY', unit: 'Cylinders' },
      'Fuel': { currentStock: 1800, dailyDemand: 110, daysOfCover: 16.3, status: 'HEALTHY', unit: 'kL' },
      'Produce': { currentStock: 450, dailyDemand: 90, daysOfCover: 5.0, status: 'HEALTHY', unit: 'Tons' },
      'Grain': { currentStock: 2200, dailyDemand: 160, daysOfCover: 13.7, status: 'HEALTHY', unit: 'Tons' },
      'Pharma': { currentStock: 850, dailyDemand: 60, daysOfCover: 14.1, status: 'HEALTHY', unit: 'Crates' }
    }
  }
];

export async function getInventoryDepots() {
  // Check if there is an active disruption to compute live dynamic impact
  let capLoss = 0;
  try {
    const disrRows = await executeQuery(`SELECT capacity_reduction_percent FROM FLODA_DISRUPTIONS WHERE status = 'ACTIVE' OR status = 'MITIGATING' ORDER BY created_at DESC`);
    if (disrRows && disrRows.length > 0) {
      capLoss = Number(disrRows[0].capacity_reduction_percent || disrRows[0].CAPACITY_REDUCTION_PERCENT || 0);
    }
  } catch (_) { }

  return regionalDepots.map(depot => {
    // If destination depot and disruption active without recent rebalance, reflect depletion
    let currentStock = depot.currentStock;
    const dailyDemand = depot.dailyDemand;
    const doc = Number((currentStock / dailyDemand).toFixed(1));

    let status = 'ADEQUATE';
    if (doc < 2.0) status = 'CRITICAL_DEFICIT';
    else if (doc < 4.0) status = 'VULNERABLE';
    else if (doc > 8.0) status = 'SURPLUS';

    return {
      ...depot,
      currentStock,
      daysOfCover: doc,
      status,
      utilizationPercent: Math.min(100, Math.round((currentStock / depot.capacity) * 100)),
      corridorCapLoss: capLoss
    };
  });
}

// Execute Supply & Demand Inventory Rebalance
export async function executeSupplyDemandRebalance(params = {}) {
  const {
    fromDepotId = 'DEPOT-BRG-01',
    toDepotId = 'DEPOT-KTM-01',
    commodity = null,
    requestedQuantity = null,
    actor = 'Rajesh Shrestha (Inventory Lead)',
    role = 'INVENTORY',
    notes = 'Dynamic supply-demand rebalance based on live Days-of-Cover gap'
  } = params;

  const sourceDepot = regionalDepots.find(d => d.id === fromDepotId) || regionalDepots[1];
  const targetDepot = regionalDepots.find(d => d.id === toDepotId) || regionalDepots[0];

  let commodityKey = commodity;
  if (!commodityKey && targetDepot.commodities) {
    // Pick the most critical commodity under cover
    const sorted = Object.entries(targetDepot.commodities).sort((a, b) => a[1].daysOfCover - b[1].daysOfCover);
    commodityKey = sorted[0]?.[0] || 'LPG';
  }

  let transferQuantity = 0;
  let targetCommodityName = commodityKey || targetDepot.commodity;

  if (commodityKey && targetDepot.commodities && targetDepot.commodities[commodityKey]) {
    const tgtComm = targetDepot.commodities[commodityKey];
    const srcComm = sourceDepot.commodities ? sourceDepot.commodities[commodityKey] : null;

    const targetDesired = Math.round(tgtComm.dailyDemand * 14); // target healthy ~14 days
    const delta = Math.max(100, targetDesired - tgtComm.currentStock);
    transferQuantity = requestedQuantity ? Number(requestedQuantity) : delta;

    if (srcComm) {
      srcComm.currentStock = Math.max(0, srcComm.currentStock - transferQuantity);
      srcComm.daysOfCover = Number((srcComm.currentStock / srcComm.dailyDemand).toFixed(1));
    }
    tgtComm.currentStock = tgtComm.currentStock + transferQuantity;
    tgtComm.daysOfCover = Number((tgtComm.currentStock / tgtComm.dailyDemand).toFixed(1));
    tgtComm.status = tgtComm.daysOfCover < 3.0 ? 'CRITICAL' : tgtComm.daysOfCover < 7.0 ? 'WARNING' : 'HEALTHY';
  } else {
    const targetDesiredStock = Math.round(targetDepot.dailyDemand * 4.5);
    const calculatedTransfer = Math.max(1500, Math.min(6000, targetDesiredStock - targetDepot.currentStock));
    transferQuantity = requestedQuantity ? Number(requestedQuantity) : calculatedTransfer;
  }

  const prevSourceStock = sourceDepot.currentStock;
  const prevTargetStock = targetDepot.currentStock;
  const prevTargetDoc = (prevTargetStock / targetDepot.dailyDemand).toFixed(1);

  // Execute transfer in memory state
  sourceDepot.currentStock = Math.max(0, sourceDepot.currentStock - transferQuantity);
  targetDepot.currentStock = targetDepot.currentStock + transferQuantity;

  const newSourceDoc = (sourceDepot.currentStock / sourceDepot.dailyDemand).toFixed(1);
  const newTargetDoc = (targetDepot.currentStock / targetDepot.dailyDemand).toFixed(1);

  const planId = `PLAN-REBAL-${Date.now()}`;
  const taskId = `TSK-INV-DISPATCH-${Date.now()}`;
  const rationale = `Supply-Demand Balancing: Redirected ${transferQuantity.toLocaleString()} units of ${targetCommodityName} from ${sourceDepot.name} (Surplus -> ${newSourceDoc}d cover) to ${targetDepot.name} (Protected -> ${newTargetDoc}d cover).`;

  // 1. Store in SAP HANA Cloud FLODA_INVENTORY_PLANS
  await executeQuery(
    `INSERT INTO FLODA_INVENTORY_PLANS (plan_id, chokepoint_id, commodity_type, recommended_safety_stock_delta, rationale, created_at)
     VALUES (?, 'CP-SUPPLY-DEMAND', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [planId, targetCommodityName, transferQuantity, rationale]
  ).catch(err => console.warn('HANA insert inventory plan notice:', err.message));

  // 2. Generate actionable task for INVENTORY persona in FLODA_TASKS
  await executeQuery(
    `INSERT INTO FLODA_TASKS (task_id, disruption_id, assigned_role, title, description, priority, status, status_notes, created_at, updated_at)
     VALUES (?, 'DISR-SUPPLY-DEMAND', 'INVENTORY', ?, ?, 'CRITICAL', 'NEW', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      taskId,
      `Redirect ${transferQuantity.toLocaleString()} ${targetCommodityName}: ${sourceDepot.name} -> ${targetDepot.name}`,
      `Emergency inter-depot stock redirection authorized. Decant and dispatch ${transferQuantity.toLocaleString()} units of ${targetCommodityName} from Surplus Hub to restore Kathmandu Valley buffer.`,
      `Optimal stock delta calculated: +${transferQuantity.toLocaleString()} units of ${targetCommodityName}`
    ]
  ).catch(err => console.warn('HANA insert task notice:', err.message));

  // 3. Record in SAP HANA FLODA_AUDIT_LOG
  await executeQuery(
    `INSERT INTO FLODA_AUDIT_LOG (log_id, action, decision_rationale, timestamp, actor, role, entity, entity_id, previous_state, new_state)
     VALUES (?, 'INVENTORY_REALLOCATED', ?, CURRENT_TIMESTAMP, ?, ?, 'INVENTORY', ?, ?, ?)`,
    [
      `LOG-${Date.now()}-INV`,
      rationale,
      actor,
      role,
      planId,
      `${prevTargetDoc} Days Cover (${prevTargetStock} units)`,
      `${newTargetDoc} Days Cover (${targetDepot.currentStock} units)`
    ]
  ).catch(err => console.warn('HANA audit log notice:', err.message));

  // 4. Create Notifications for Inventory and Logistics personas
  await createNotification(
    'INVENTORY',
    `Inter-Depot Stock Reallocated: ${targetDepot.name}`,
    `Days of Cover restored from ${prevTargetDoc}d to ${newTargetDoc}d. ${transferQuantity.toLocaleString()} units in transit from ${sourceDepot.name}.`,
    'SUCCESS',
    planId
  );
  await createNotification(
    'LOGISTICS',
    `Transport Escort Scheduled: Stock Rebalance`,
    `Priority convoy assigned to convey ${transferQuantity.toLocaleString()} units from ${sourceDepot.name} to ${targetDepot.name}.`,
    'INFO',
    planId
  );

  // 5. Broadcast real-time SSE updates
  const updatedDepots = await getInventoryDepots();
  broadcaster.broadcast('inventory_reallocated', {
    planId,
    taskId,
    sourceDepot: sourceDepot.name,
    targetDepot: targetDepot.name,
    transferQuantity,
    prevTargetDoc,
    newTargetDoc,
    rationale,
    depots: updatedDepots
  });
  broadcaster.broadcast('task_created', { taskId, role: 'INVENTORY' });

  await logEvent(
    'INVENTORY_REALLOCATION_COMPLETED',
    `Supply-Demand Autonomous Balancing: ${transferQuantity.toLocaleString()} units re-routed to ${targetDepot.name}. Days of Cover elevated to ${newTargetDoc} days.`,
    { planId, transferQuantity, from: sourceDepot.id, to: targetDepot.id, newTargetDoc },
    'INVENTORY',
    planId
  );

  return {
    success: true,
    planId,
    taskId,
    transferQuantity,
    sourceDepot: sourceDepot.name,
    targetDepot: targetDepot.name,
    prevTargetDoc,
    newTargetDoc,
    rationale,
    depots: updatedDepots
  };
}
