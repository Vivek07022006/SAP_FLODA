import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAiHealth,
  generateSituationReport,
  explainDecision,
  generateRecoveryBrief,
  getActiveProvider
} from './services/floda-ai-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function runTests() {
  console.log('=====================================================');
  console.log('FLODA AI ORCHESTRATION TEST SUITE');
  console.log('Active Provider:', getActiveProvider());
  console.log('=====================================================');

  // Test 1: Health Check
  console.log('\n[1/5] Testing getAiHealth()...');
  const health = await getAiHealth();
  console.log('Health Output:', JSON.stringify(health, null, 2));

  // Test 2: Situation Report
  console.log('\n[2/5] Testing generateSituationReport()...');
  const sitRep = await generateSituationReport();
  console.log('Situation Report Source:', sitRep.source, '| Provider:', sitRep.provider);
  console.log('Summary Preview:', sitRep.report?.situationSummary?.slice(0, 120) + '...');
  console.log('Impacts Count:', sitRep.report?.keyImpacts?.length);
  console.log('Critical Inventory Count:', sitRep.report?.criticalInventory?.length);

  // Test 3: Explain Decision
  console.log('\n[3/5] Testing explainDecision()...');
  const explain = await explainDecision();
  console.log('Explain Decision Source:', explain.source, '| Provider:', explain.provider);
  console.log('Explanation Preview:', explain.explanation?.executiveExplanation?.slice(0, 120) + '...');
  console.log('Why Points Count:', explain.explanation?.whyThisScenario?.length);

  // Test 4: Recovery Brief
  console.log('\n[4/5] Testing generateRecoveryBrief()...');
  const brief = await generateRecoveryBrief();
  console.log('Recovery Brief Source:', brief.source, '| Provider:', brief.provider);
  console.log('Plan Summary Preview:', brief.brief?.operationalPlanSummary?.slice(0, 120) + '...');
  console.log('Directives Count:', brief.brief?.stakeholderDirectives?.length);

  // Test 5: Fallback Simulation (invalid model)
  console.log('\n[5/5] Testing Deterministic Fallback on Model Failure...');
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = 'nonexistent-model-test-fallback';
  const fallbackRep = await generateSituationReport();
  console.log('Simulated Failure Source:', fallbackRep.source, '| Provider:', fallbackRep.provider);
  console.log('Fallback Report OK:', Boolean(fallbackRep.report?.situationSummary));
  process.env.OPENAI_MODEL = originalModel;

  console.log('\n=====================================================');
  console.log('ALL AI SERVICE TESTS COMPLETE!');
  console.log('=====================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
