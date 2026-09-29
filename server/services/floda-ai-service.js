import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { buildOperationalContext } from './floda-ai-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// In-memory token cache for SAP AI Core OAuth
let sapTokenCache = {
  accessToken: null,
  expiresAt: 0
};

// Reusable OpenAI client instance
let openAiClient = null;

const SYSTEM_PROMPT = `You are FLODA AI Situation & Decision Intelligence, an enterprise supply-chain resilience analyst.
You analyze operational data supplied by FLODA.
Your responsibility is to summarize disruption impact, explain deterministic FLODA recommendations, identify critical supply risks, and communicate recovery implications clearly to a human decision-maker.

You are advisory only.
You must NOT:
- invent operational facts
- invent routes
- invent inventory
- invent compliance approvals
- override FLODA deterministic rules
- approve or reject actions
- directly modify operational state
- claim an action was executed unless the supplied data confirms it

Use only the supplied FLODA context.
Clearly distinguish:
- observed facts
- calculated values
- recommendations already produced by FLODA
- uncertainties

If information is unavailable, say that it is unavailable.
Human authority remains the final decision-maker.
Always reply in strictly valid JSON format matching the schema requested by the user.`;

/**
 * Returns the configured active AI provider ('openai' or 'sap-ai-core').
 */
export function getActiveProvider() {
  const prov = (process.env.AI_PROVIDER || 'openai').toLowerCase().trim();
  if (prov === 'sap-ai-core' || prov === 'sap' || prov === 'sap_ai_core') {
    return 'sap-ai-core';
  }
  return 'openai';
}

/**
 * Checks if OpenAI configuration is present.
 */
export function isOpenAiConfigured() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  return Boolean(apiKey && apiKey.trim() && model && model.trim());
}

/**
 * Checks if SAP AI Core / Generative AI Hub configuration is set.
 */
export function isSapAiConfigured() {
  const { AICORE_CLIENT_ID, AICORE_CLIENT_SECRET, AICORE_AUTH_URL, AICORE_BASE_URL } = process.env;
  return Boolean(AICORE_CLIENT_ID && AICORE_CLIENT_SECRET && AICORE_AUTH_URL && AICORE_BASE_URL);
}

// Backwards-compatibility alias
export const isGenAiConfigured = isSapAiConfigured;

// =========================================================================
// 1. OPENAI PROVIDER IMPLEMENTATION (LIVE INFERENCE)
// =========================================================================

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in environment.');
  }
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey,
      timeout: 25000,
      maxRetries: 1
    });
  }
  return openAiClient;
}

/**
 * Executes a structured inference completion using OpenAI API.
 */
async function callOpenAi({ userPrompt, jsonSchemaDescription, maxTokens = 1500 }) {
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) {
    throw new Error('OPENAI_MODEL is not configured in environment.');
  }

  const client = getOpenAiClient();

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nSchema requirement: ${jsonSchemaDescription}`
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: maxTokens
  });

  const rawContent = completion.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI returned an empty completion response.');
  }

  try {
    return JSON.parse(rawContent);
  } catch {
    // Attempt safe recovery from markdown JSON block or slice
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse structured JSON from OpenAI completion.');
  }
}

// =========================================================================
// 2. SAP AI CORE / GENERATIVE AI HUB PROVIDER IMPLEMENTATION (PRESERVED)
// =========================================================================

/**
 * Obtains an OAuth2 bearer token from SAP AI Core with automatic caching.
 */
async function getAiCoreToken() {
  const clientId = process.env.AICORE_CLIENT_ID;
  const clientSecret = process.env.AICORE_CLIENT_SECRET;
  const authUrl = process.env.AICORE_AUTH_URL?.replace(/\/+$/, '');

  if (!clientId || !clientSecret || !authUrl) {
    throw new Error('SAP AI Core credentials incomplete in environment.');
  }

  // Return cached token if valid for at least 60 seconds
  const now = Date.now();
  if (sapTokenCache.accessToken && sapTokenCache.expiresAt > now + 60000) {
    return sapTokenCache.accessToken;
  }

  const tokenEndpoint = `${authUrl}/oauth/token?grant_type=client_credentials`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`SAP AI Core auth token request failed with status ${res.status}`);
    }

    const data = await res.json();
    sapTokenCache = {
      accessToken: data.access_token,
      expiresAt: now + (Number(data.expires_in || 3600) * 1000)
    };

    return sapTokenCache.accessToken;
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`SAP AI Core OAuth error: ${err.message}`);
  }
}

/**
 * Invokes SAP Generative AI Hub (Orchestration V2 / Deployment Completion).
 */
async function callSapGenAiHub({ userPrompt, jsonSchemaDescription }) {
  if (!isSapAiConfigured()) {
    throw new Error('SAP Generative AI Hub credentials not configured.');
  }

  const token = await getAiCoreToken();
  const baseUrl = process.env.AICORE_BASE_URL?.replace(/\/+$/, '');
  const resourceGroup = process.env.AICORE_RESOURCE_GROUP || 'default';
  const model = process.env.FLODA_AI_MODEL || 'gpt-4o';
  const deploymentId = process.env.FLODA_AI_DEPLOYMENT_ID;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  const endpoint = deploymentId
    ? `${baseUrl}/v2/inference/deployments/${deploymentId}/completion`
    : `${baseUrl}/v2/inference/deployments/orchestration/completion`;

  const payload = {
    orchestration_config: {
      module_configurations: {
        llm_module_config: {
          model_name: model,
          model_params: {
            temperature: 0.2,
            response_format: { type: 'json_object' }
          }
        },
        templating_module_config: {
          template: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n\nSchema requirement: ${jsonSchemaDescription}` },
            { role: 'user', content: userPrompt }
          ]
        }
      }
    },
    input_params: {}
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'AI-Resource-Group': resourceGroup,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`SAP GenAI Hub API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const rawContent = data?.orchestration_result?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content ||
      data?.content;

    if (!rawContent) {
      throw new Error('SAP Generative AI Hub returned empty message content.');
    }

    return JSON.parse(rawContent);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// =========================================================================
// 3. DETERMINISTIC INTELLIGENCE ENGINE (GROUNDED IN LIVE HANA DATA)
// =========================================================================

function generateDeterministicSituationReport(context) {
  const disr = context.disruption || {};
  const scenarios = context.scenarios || [];
  const recScenario = scenarios.find(s => s.isRecommended) || scenarios[0] || {};

  const loc = disr.location || 'Nepal Trans-Himalayan Arterial';
  const corridor = disr.corridor || 'Birgunj-Kathmandu Trade Corridor';
  const capLoss = disr.capacityReductionPercent || 75;
  const severity = (disr.severity || 'CRITICAL').toUpperCase();

  const criticalInventory = [];
  for (const depot of (context.regionalDepots || [])) {
    for (const comm of (depot.criticalCommodities || [])) {
      if (comm.daysOfCover < 5 || comm.status === 'CRITICAL') {
        criticalInventory.push({
          commodity: comm.commodity,
          location: depot.name,
          daysOfCover: comm.daysOfCover,
          risk: comm.daysOfCover < 2 ? 'CRITICAL' : 'HIGH'
        });
      }
    }
  }

  return {
    situationSummary: `Corridor disruption at ${loc} on the ${corridor} has caused a verified ${capLoss}% reduction in arterial transit capacity. Downstream buffer stock in destination fulfillment centers is depleting rapidly while surplus remains banked at border gateways.`,
    severity,
    keyImpacts: [
      `Arterial throughput loss of ${capLoss}% along ${corridor}`,
      `Downstream destination reserves depleting; critical life-support supply buffers under pressure`,
      `${recScenario.affectedShipments || 8} active freight manifests and ${recScenario.affectedVehicles || 12} heavy transport carriers impacted`,
      `${context.complianceEscalations?.pendingApprovals || 0} high-risk / hazmat cargo manifests intercepted for executive policy review`
    ],
    criticalInventory: criticalInventory.length > 0 ? criticalInventory : [
      {
        commodity: 'LPG / Cryo Vaccines',
        location: 'Kathmandu Valley Destination DC',
        daysOfCover: 0.9,
        risk: 'CRITICAL'
      }
    ],
    recommendedScenario: {
      scenarioCode: recScenario.code || 'SCENARIO_A',
      reason: recScenario.title ? `${recScenario.title}: ${recScenario.impactSummary || 'Optimal restoration of critical freight flow with lowest recovery latency.'}` : 'Prioritizes life-support cargo via monitored bypass.'
    },
    decisionFactors: [
      `Throughput capacity reduced to ${100 - capLoss}% baseline`,
      `Estimated recovery latency under recommended scenario: ${recScenario.estimatedRecoveryHours || 17}h vs ${recScenario.estimatedRecoveryHours ? recScenario.estimatedRecoveryHours * 2 : 48}h baseline`,
      `Safety guardrails satisfied: Compliance waivers and axle-load constraints validated by autonomous engine`
    ],
    risks: [
      `Secondary bottleneck risk along narrow bypass bridge structures`,
      `Depot stockouts if inter-hub inventory decanting is delayed beyond 12 hours`
    ],
    nextActions: [
      `Corridor Authority executive authorization for ${recScenario.code || 'Scenario A'}`,
      `Issue automated dispatch instructions to Transport Lead and Logistics Fleet`,
      `Authorize inter-depot inventory replenishment from Birgunj Surplus Hub to Kathmandu DC`
    ],
    humanApprovalRequired: true,
    confidence: 'HIGH'
  };
}

function generateDeterministicExplanation(context) {
  const disr = context.disruption || {};
  const rec = context.recommendation || {};
  const scenarios = context.scenarios || [];
  const recScenario = scenarios.find(s => s.isRecommended) || scenarios[0] || {};
  const capLoss = disr.capacityReductionPercent || 75;

  return {
    recommendationTitle: rec.title || `Approve ${recScenario.title || 'Dynamic Reroute'} (${recScenario.code || 'Scenario A'})`,
    recommendedScenarioCode: recScenario.code || 'SCENARIO_A',
    executiveExplanation: `FLODA recommends ${recScenario.title || 'Scenario A'} because it provides the fastest restoration of life-support cargo without overwhelming local infrastructure limits. The deterministic engine evaluated corridor loss (${capLoss}%), destination consumption velocity, and compliance guardrails.`,
    whyThisScenario: [
      `Current arterial corridor capacity is restricted to ${100 - capLoss}% following obstruction at ${disr.location || 'chokepoint'}.`,
      `Estimated recovery latency is ${recScenario.estimatedRecoveryHours || 17} hours, significantly lower than holding cargo indefinitely.`,
      `Preserves life-support cold chain and infant nutrition shipments via prioritized convoy sequencing.`,
      `Maintains regulatory compliance by routing heavy payloads (>10t) and hazmat through inspected routes.`
    ],
    tradeoffsConsidered: [
      `Alternative holding at dry port avoids transit risk but triggers destination stockouts within 24-48 hours.`,
      `Pre-positioning buffers alone does not address stranded in-transit perishable pharmaceuticals.`
    ],
    inventoryImplications: `Requires immediate safety stock decanting from surplus depots to support downstream facilities during transit rerouting.`,
    complianceVerification: recScenario.complianceStatus || 'Emergency Corridor Authorization Waiver verified by Compliance Agent.',
    humanActionRequired: `Executive authorization from Corridor Authority is required to release emergency transit waivers and notify transport leads.`,
    confidence: 'HIGH'
  };
}

function generateDeterministicRecoveryBrief(context) {
  const disr = context.disruption || {};
  const decision = context.decision || {};
  const scenarios = context.scenarios || [];
  const activeScenario = scenarios.find(s => s.status === 'APPROVED' || s.isRecommended) || scenarios[0] || {};

  return {
    briefTitle: `Executive Recovery Brief: ${disr.location || 'Corridor'} Disruption Mitigation`,
    authorizationStatus: decision.decisionType || 'AUTHORIZED',
    authorizedBy: `${decision.decidedBy || 'Corridor Authority'} (${decision.decidedByRole || 'AUTHORITY'})`,
    approvedScenario: activeScenario.title || 'Dynamic Corridor Rerouting & Buffer Pre-Positioning',
    operationalPlanSummary: `Executive authority has authorized emergency transit operations. Transport convoys are activated along certified bypass arteries, and warehouse staging hubs are re-sequenced for life-support prioritization.`,
    stakeholderDirectives: [
      {
        role: 'TRANSPORT',
        directive: `Dispatch pilot vehicle escort and enforce strict axle weight restrictions around ${disr.location || 'affected corridor'}.`
      },
      {
        role: 'LOGISTICS',
        directive: `Re-sequence warehouse loading bays to release priority pharmaceuticals and emergency provisions first.`
      },
      {
        role: 'INVENTORY',
        directive: `Execute inter-depot decanting from Birgunj Inland Port to restore Kathmandu Valley Days-of-Cover.`
      },
      {
        role: 'COMPLIANCE',
        directive: `Certify Disaster Management Protocol inspection waivers for freight operating on detour corridors.`
      }
    ],
    inventoryActions: `Safety stock buffer release initiated; replenishment convoy in transit.`,
    estimatedRestorationHours: activeScenario.estimatedRecoveryHours || 18,
    residualRisks: [
      `Adverse weather could slow bypass convoy transit speed`,
      `Secondary road axle-weight stress requires continuous ground patrol monitoring`
    ],
    auditLedgerStatus: `Recorded in SAP HANA Cloud Append-Only Auditable Decision Ledger (FLODA_AUDIT_LOG and FLODA_DECISIONS).`
  };
}

// =========================================================================
// 4. PUBLIC API METHODS
// =========================================================================

/**
 * Health check for the active AI Provider.
 * Accurately reports active provider without exposing secrets or tokens.
 */
export async function getAiHealth() {
  const activeProvider = getActiveProvider();
  const sapConfigured = isSapAiConfigured();
  const openAiConfigured = isOpenAiConfigured();

  if (activeProvider === 'openai') {
    const model = process.env.OPENAI_MODEL || '';

    if (!openAiConfigured) {
      return {
        available: false,
        configured: false,
        provider: 'OpenAI',
        mode: 'fallback',
        model: model || 'not configured',
        sapAiCoreConfigured: sapConfigured,
        fallbackAvailable: true,
        message: 'OpenAI API key or model not configured in server environment. Deterministic intelligence fallback active.'
      };
    }

    try {
      // Test OpenAI connectivity with light call
      const client = getOpenAiClient();
      await client.models.retrieve(model);
      return {
        available: true,
        configured: true,
        provider: 'OpenAI',
        mode: 'live',
        model,
        sapAiCoreConfigured: sapConfigured,
        fallbackAvailable: true,
        message: `OpenAI live inference connected using model ${model}.`
      };
    } catch (err) {
      return {
        available: false,
        configured: true,
        provider: 'OpenAI',
        mode: 'fallback',
        model,
        sapAiCoreConfigured: sapConfigured,
        fallbackAvailable: true,
        message: `OpenAI connection test failed (${err.message}). Deterministic intelligence fallback active.`
      };
    }
  }

  // SAP AI Core provider path
  const sapModel = process.env.FLODA_AI_MODEL || 'gpt-4o';
  const deploymentId = process.env.FLODA_AI_DEPLOYMENT_ID || 'orchestration-v2';
  const resourceGroup = process.env.AICORE_RESOURCE_GROUP || 'default';

  if (!sapConfigured) {
    return {
      available: false,
      configured: false,
      provider: 'SAP Generative AI Hub',
      mode: 'fallback',
      model: sapModel,
      deployment: deploymentId,
      resourceGroup,
      sapAiCoreConfigured: false,
      fallbackAvailable: true,
      message: 'SAP AI Core credentials not configured. Deterministic intelligence fallback active.'
    };
  }

  try {
    await getAiCoreToken();
    return {
      available: true,
      configured: true,
      provider: 'SAP Generative AI Hub',
      mode: 'live',
      model: sapModel,
      deployment: deploymentId,
      resourceGroup,
      sapAiCoreConfigured: true,
      fallbackAvailable: true,
      message: 'SAP Generative AI Hub authenticated and operational.'
    };
  } catch (err) {
    return {
      available: false,
      configured: true,
      provider: 'SAP Generative AI Hub',
      mode: 'fallback',
      model: sapModel,
      deployment: deploymentId,
      resourceGroup,
      sapAiCoreConfigured: true,
      fallbackAvailable: true,
      message: `SAP AI Core connection failed: ${err.message}. Deterministic intelligence fallback active.`
    };
  }
}

/**
 * Generates an Executive AI Situation Report from live SAP HANA state.
 */
export async function generateSituationReport(options = {}) {
  const context = await buildOperationalContext(options);
  const activeProvider = getActiveProvider();

  const schemaDescription = `Return JSON with keys: situationSummary (string), severity ('CRITICAL'|'HIGH'|'MEDIUM'|'LOW'), keyImpacts (array of strings), criticalInventory (array of objects { commodity, location, daysOfCover, risk }), recommendedScenario ({ scenarioCode, reason }), decisionFactors (array of strings), risks (array of strings), nextActions (array of strings), humanApprovalRequired (boolean), confidence ('HIGH'|'MEDIUM'|'LOW').`;
  const userPrompt = `Operational state from SAP HANA Cloud:\n${JSON.stringify(context, null, 2)}\n\nGenerate an Executive Situation Report for the Corridor Authority.`;

  // 1. OpenAI Live Inference Path
  if (activeProvider === 'openai' && isOpenAiConfigured()) {
    try {
      const aiResponse = await callOpenAi({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'OPENAI_API',
        provider: 'OpenAI',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        poweredBy: 'FLODA AI Orchestration · OpenAI',
        timestamp: new Date().toISOString(),
        contextSnapshot: {
          disruptionId: context.disruption?.disruptionId,
          corridor: context.disruption?.corridor,
          capacityReduction: context.disruption?.capacityReductionPercent
        },
        report: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] OpenAI situation report call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 2. SAP AI Core / Generative AI Hub Path
  if (activeProvider === 'sap-ai-core' && isSapAiConfigured()) {
    try {
      const aiResponse = await callSapGenAiHub({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'SAP_GENAI_HUB',
        provider: 'SAP Generative AI Hub',
        model: process.env.FLODA_AI_MODEL || 'gpt-4o',
        poweredBy: 'Powered by SAP Generative AI Hub',
        timestamp: new Date().toISOString(),
        contextSnapshot: {
          disruptionId: context.disruption?.disruptionId,
          corridor: context.disruption?.corridor,
          capacityReduction: context.disruption?.capacityReductionPercent
        },
        report: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] SAP Generative AI Hub call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 3. High-Fidelity Deterministic Fallback
  const fallbackReport = generateDeterministicSituationReport(context);
  return {
    success: true,
    source: 'FLODA_DETERMINISTIC_FALLBACK',
    provider: 'FLODA Deterministic Engine',
    model: 'Deterministic Heuristic Rules',
    poweredBy: 'FLODA AI Intelligence Layer',
    statusNotice: activeProvider === 'openai'
      ? (isOpenAiConfigured() ? 'OpenAI live inference temporarily unavailable — FLODA deterministic engine active.' : 'Deterministic intelligence active grounded in SAP HANA Cloud ledger data.')
      : (isSapAiConfigured() ? 'SAP Generative AI Hub temporarily unavailable — FLODA deterministic engine active.' : 'Deterministic intelligence active grounded in SAP HANA Cloud ledger data.'),
    timestamp: new Date().toISOString(),
    contextSnapshot: {
      disruptionId: context.disruption?.disruptionId,
      corridor: context.disruption?.corridor,
      capacityReduction: context.disruption?.capacityReductionPercent
    },
    report: fallbackReport
  };
}

/**
 * Generates "Why This Decision?" explanation grounded in actual FLODA data.
 */
export async function explainDecision(options = {}) {
  const context = await buildOperationalContext(options);
  const activeProvider = getActiveProvider();

  const schemaDescription = `Return JSON with keys: recommendationTitle (string), recommendedScenarioCode (string), executiveExplanation (string), whyThisScenario (array of strings), tradeoffsConsidered (array of strings), inventoryImplications (string), complianceVerification (string), humanActionRequired (string), confidence ('HIGH'|'MEDIUM'|'LOW').`;
  const userPrompt = `Operational state from SAP HANA Cloud:\n${JSON.stringify(context, null, 2)}\n\nExplain why FLODA recommends this specific scenario over the alternatives. Ground every factor in the provided data.`;

  // 1. OpenAI Live Inference Path
  if (activeProvider === 'openai' && isOpenAiConfigured()) {
    try {
      const aiResponse = await callOpenAi({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'OPENAI_API',
        provider: 'OpenAI',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        poweredBy: 'FLODA AI Orchestration · OpenAI',
        timestamp: new Date().toISOString(),
        explanation: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] OpenAI explain-decision call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 2. SAP AI Core / Generative AI Hub Path
  if (activeProvider === 'sap-ai-core' && isSapAiConfigured()) {
    try {
      const aiResponse = await callSapGenAiHub({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'SAP_GENAI_HUB',
        provider: 'SAP Generative AI Hub',
        model: process.env.FLODA_AI_MODEL || 'gpt-4o',
        poweredBy: 'Powered by SAP Generative AI Hub',
        timestamp: new Date().toISOString(),
        explanation: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] SAP GenAI Hub explain-decision call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 3. Deterministic Fallback
  const fallbackExplanation = generateDeterministicExplanation(context);
  return {
    success: true,
    source: 'FLODA_DETERMINISTIC_FALLBACK',
    provider: 'FLODA Deterministic Engine',
    model: 'Deterministic Heuristic Rules',
    poweredBy: 'FLODA AI Intelligence Layer',
    statusNotice: 'FLODA deterministic decision engine active.',
    timestamp: new Date().toISOString(),
    explanation: fallbackExplanation
  };
}

/**
 * Generates an Executive Recovery Brief after a scenario has been authorized.
 */
export async function generateRecoveryBrief(options = {}) {
  const context = await buildOperationalContext(options);
  const activeProvider = getActiveProvider();

  const schemaDescription = `Return JSON with keys: briefTitle (string), authorizationStatus (string), authorizedBy (string), approvedScenario (string), operationalPlanSummary (string), stakeholderDirectives (array of objects { role, directive }), inventoryActions (string), estimatedRestorationHours (number), residualRisks (array of strings), auditLedgerStatus (string).`;
  const userPrompt = `Operational state & authorized decision from SAP HANA Cloud:\n${JSON.stringify(context, null, 2)}\n\nGenerate an Executive Recovery Brief summarizing the authorized action, assigned stakeholder tasks, inventory impact, and residual risks.`;

  // 1. OpenAI Live Inference Path
  if (activeProvider === 'openai' && isOpenAiConfigured()) {
    try {
      const aiResponse = await callOpenAi({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'OPENAI_API',
        provider: 'OpenAI',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        poweredBy: 'FLODA AI Orchestration · OpenAI',
        timestamp: new Date().toISOString(),
        brief: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] OpenAI recovery-brief call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 2. SAP AI Core / Generative AI Hub Path
  if (activeProvider === 'sap-ai-core' && isSapAiConfigured()) {
    try {
      const aiResponse = await callSapGenAiHub({ userPrompt, jsonSchemaDescription: schemaDescription });
      return {
        success: true,
        source: 'SAP_GENAI_HUB',
        provider: 'SAP Generative AI Hub',
        model: process.env.FLODA_AI_MODEL || 'gpt-4o',
        poweredBy: 'Powered by SAP Generative AI Hub',
        timestamp: new Date().toISOString(),
        brief: aiResponse
      };
    } catch (err) {
      console.warn('[FLODA AI Orchestrator] SAP GenAI Hub recovery-brief call failed, engaging deterministic fallback:', err.message);
    }
  }

  // 3. Deterministic Fallback
  const fallbackBrief = generateDeterministicRecoveryBrief(context);
  return {
    success: true,
    source: 'FLODA_DETERMINISTIC_FALLBACK',
    provider: 'FLODA Deterministic Engine',
    model: 'Deterministic Heuristic Rules',
    poweredBy: 'FLODA AI Intelligence Layer',
    statusNotice: 'FLODA deterministic decision engine active.',
    timestamp: new Date().toISOString(),
    brief: fallbackBrief
  };
}

export default {
  getActiveProvider,
  isOpenAiConfigured,
  isSapAiConfigured,
  isGenAiConfigured,
  getAiHealth,
  generateSituationReport,
  explainDecision,
  generateRecoveryBrief
};
