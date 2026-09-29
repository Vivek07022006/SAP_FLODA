import { executeQuery } from '../db/hana.js';
import { getInventoryDepots } from '../agent-orchestrator.js';

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase()] = value;
    normalized[key] = value;
  }
  return normalized;
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeRow) : [];
}

/**
 * Builds a sanitized, factual operational context from SAP HANA Cloud for GenAI inference.
 * Strictly excludes secrets, credentials, tokens, or unnecessary PII.
 *
 * @param {Object} options
 * @param {string} [options.disruptionId]
 * @param {string} [options.scenarioId]
 * @param {string} [options.recommendationId]
 * @returns {Promise<Object>} Factual operational snapshot
 */
export async function buildOperationalContext({ disruptionId, scenarioId, recommendationId } = {}) {
  // 1. Fetch Active Disruption
  let disruption = null;
  try {
    let query = `SELECT * FROM FLODA_DISRUPTIONS`;
    const params = [];
    if (disruptionId) {
      query += ` WHERE disruption_id = ?`;
      params.push(disruptionId);
    } else {
      query += ` WHERE status = 'ACTIVE' OR status = 'MITIGATING' ORDER BY created_at DESC`;
    }
    const rows = await executeQuery(query, params);
    if (rows && rows.length > 0) {
      disruption = normalizeRow(rows[0]);
    } else if (!disruptionId) {
      // Fallback to latest recorded disruption if none active
      const latestRows = await executeQuery(`SELECT * FROM FLODA_DISRUPTIONS ORDER BY created_at DESC LIMIT 1`);
      if (latestRows && latestRows.length > 0) {
        disruption = normalizeRow(latestRows[0]);
      }
    }
  } catch (err) {
    console.warn('[AI Context] Disruption fetch warning:', err.message);
  }

  const activeDisruptionId = disruption?.disruption_id || disruptionId || null;

  // 2. Fetch Active Chokepoints
  let chokepoints = [];
  try {
    const cpRows = await executeQuery(`SELECT * FROM FLODA_CHOKEPOINTS WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 3`);
    chokepoints = normalizeRows(cpRows).map(cp => ({
      chokepointId: cp.chokepoint_id,
      location: cp.location,
      type: cp.chokepoint_type,
      severity: cp.severity,
      affectedRoutes: cp.affected_routes,
      capacityReductionPercent: Number(cp.capacity_reduction_percent || 0),
      estimatedResolutionHours: Number(cp.estimated_resolution_hours || 0)
    }));
  } catch (err) {
    console.warn('[AI Context] Chokepoints fetch warning:', err.message);
  }

  // 3. Fetch Scenarios
  let scenarios = [];
  try {
    let scnQuery = `SELECT * FROM FLODA_SCENARIOS`;
    const scnParams = [];
    if (activeDisruptionId) {
      scnQuery += ` WHERE disruption_id = ?`;
      scnParams.push(activeDisruptionId);
    }
    scnQuery += ` ORDER BY created_at DESC LIMIT 5`;
    const scnRows = await executeQuery(scnQuery, scnParams);
    scenarios = normalizeRows(scnRows).map(s => ({
      scenarioId: s.scenario_id,
      code: s.scenario_code,
      title: s.title,
      description: s.description,
      impactSummary: s.impact_summary,
      affectedShipments: Number(s.affected_shipments_count || 0),
      affectedInventory: Number(s.affected_inventory_count || 0),
      affectedVehicles: Number(s.affected_vehicles_count || 0),
      estimatedRecoveryHours: Number(s.estimated_recovery_hours || 0),
      riskLevel: s.risk_level,
      complianceStatus: s.compliance_status,
      isRecommended: Boolean(s.is_recommended),
      status: s.status
    }));
  } catch (err) {
    console.warn('[AI Context] Scenarios fetch warning:', err.message);
  }

  // 4. Fetch Recommendation
  let recommendation = null;
  try {
    let recQuery = `SELECT * FROM FLODA_RECOMMENDATIONS`;
    const recParams = [];
    if (recommendationId) {
      recQuery += ` WHERE recommendation_id = ?`;
      recParams.push(recommendationId);
    } else if (activeDisruptionId) {
      recQuery += ` WHERE disruption_id = ? ORDER BY created_at DESC`;
      recParams.push(activeDisruptionId);
    } else {
      recQuery += ` ORDER BY created_at DESC LIMIT 1`;
    }
    const recRows = await executeQuery(recQuery, recParams);
    if (recRows && recRows.length > 0) {
      const rec = normalizeRow(recRows[0]);
      recommendation = {
        recommendationId: rec.recommendation_id,
        title: rec.title,
        rationale: rec.rationale,
        urgency: rec.urgency,
        status: rec.status,
        recommendedScenarioId: rec.recommended_scenario_id,
        decisionId: rec.decision_id || null
      };
    }
  } catch (err) {
    console.warn('[AI Context] Recommendation fetch warning:', err.message);
  }

  // 5. Fetch Existing Decision (if made)
  let decision = null;
  try {
    let decQuery = `SELECT * FROM FLODA_DECISIONS`;
    const decParams = [];
    if (recommendation?.decisionId) {
      decQuery += ` WHERE decision_id = ?`;
      decParams.push(recommendation.decisionId);
    } else if (activeDisruptionId) {
      decQuery += ` WHERE disruption_id = ? ORDER BY decided_at DESC`;
      decParams.push(activeDisruptionId);
    } else {
      decQuery += ` ORDER BY decided_at DESC LIMIT 1`;
    }
    const decRows = await executeQuery(decQuery, decParams);
    if (decRows && decRows.length > 0) {
      const d = normalizeRow(decRows[0]);
      decision = {
        decisionId: d.decision_id,
        decisionType: d.decision_type,
        decidedBy: d.decided_by,
        decidedByRole: d.decided_by_role,
        notes: d.notes,
        decidedAt: d.decided_at
      };
    }
  } catch (err) {
    console.warn('[AI Context] Decision fetch warning:', err.message);
  }

  // 6. Fetch Regional Depots & Days-of-Cover
  let regionalDepotsData = [];
  try {
    const rawDepots = await getInventoryDepots();
    regionalDepotsData = rawDepots.map(d => ({
      depotId: d.id,
      name: d.name,
      region: d.region,
      daysOfCover: Number(d.daysOfCover || 0),
      status: d.status,
      currentStock: d.currentStock,
      dailyDemand: d.dailyDemand,
      criticalCommodities: d.commodities
        ? Object.entries(d.commodities).map(([comm, info]) => ({
            commodity: comm,
            daysOfCover: Number(info.daysOfCover || 0),
            status: info.status,
            unit: info.unit
          }))
        : []
    }));
  } catch (err) {
    console.warn('[AI Context] Depots fetch warning:', err.message);
  }

  // 7. Fetch Recent Operational Tasks
  let tasksSummary = [];
  try {
    let taskQuery = `SELECT assigned_role, priority, status, COUNT(*) AS count FROM FLODA_TASKS`;
    const taskParams = [];
    if (activeDisruptionId) {
      taskQuery += ` WHERE disruption_id = ?`;
      taskParams.push(activeDisruptionId);
    }
    taskQuery += ` GROUP BY assigned_role, priority, status`;
    const taskRows = await executeQuery(taskQuery, taskParams);
    tasksSummary = normalizeRows(taskRows).map(t => ({
      role: t.assigned_role,
      priority: t.priority,
      status: t.status,
      count: Number(t.count || 0)
    }));
  } catch (err) {
    console.warn('[AI Context] Tasks summary fetch warning:', err.message);
  }

  // 8. Fetch Cargo Compliance Escalations
  let complianceEscalations = { pendingApprovals: 0, hazmatCount: 0, heavyCount: 0 };
  try {
    const rnkRows = await executeQuery(`
      SELECT r.allocated, r.requires_approval, r.approval_status, m.carriage_constraint, m.weight_kg
      FROM FLODA_RANKINGS r
      LEFT JOIN FLODA_MANIFESTS m ON r.manifest_id = m.manifest_id
      WHERE r.requires_approval = TRUE
    `);
    const norm = normalizeRows(rnkRows);
    complianceEscalations.pendingApprovals = norm.filter(r => r.approval_status === 'pending').length;
    complianceEscalations.hazmatCount = norm.filter(r => String(r.carriage_constraint).toLowerCase().includes('hazmat')).length;
    complianceEscalations.heavyCount = norm.filter(r => Number(r.weight_kg) > 10000).length;
  } catch (err) {
    console.warn('[AI Context] Compliance escalations fetch warning:', err.message);
  }

  return {
    timestamp: new Date().toISOString(),
    disruption: disruption ? {
      disruptionId: disruption.disruption_id,
      type: disruption.disruption_type,
      location: disruption.location,
      corridor: disruption.corridor,
      severity: disruption.severity,
      description: disruption.description,
      capacityReductionPercent: Number(disruption.capacity_reduction_percent || 0),
      expectedDurationHours: Number(disruption.expected_duration_hours || 0),
      status: disruption.status
    } : null,
    chokepoints,
    scenarios,
    recommendation,
    decision,
    regionalDepots: regionalDepotsData,
    tasksSummary,
    complianceEscalations
  };
}
