import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testHttpEndpoints() {
  console.log('--- 1. Authenticating as Authority ---');
  const loginRes = await fetch('http://localhost:4004/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'authority@floda.local',
      password: 'FlodaDemo2026!'
    })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  console.log('Logged in successfully. User:', loginData.user?.fullName);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n--- 2. POST /api/ai/situation-report ---');
  const sitRes = await fetch('http://localhost:4004/api/ai/situation-report', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  const sitData = await sitRes.json();
  console.log('HTTP Status:', sitRes.status);
  console.log('Source:', sitData.source);
  console.log('Provider:', sitData.provider);
  console.log('Model:', sitData.model);
  console.log('Summary Preview:', sitData.report?.situationSummary?.slice(0, 100) + '...');
  console.log('Key Impacts Count:', sitData.report?.keyImpacts?.length);

  console.log('\n--- 3. POST /api/ai/explain-decision ---');
  const expRes = await fetch('http://localhost:4004/api/ai/explain-decision', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  const expData = await expRes.json();
  console.log('HTTP Status:', expRes.status);
  console.log('Source:', expData.source);
  console.log('Provider:', expData.provider);
  console.log('Model:', expData.model);
  console.log('Explanation Preview:', expData.explanation?.executiveExplanation?.slice(0, 100) + '...');
  console.log('Why Points Count:', expData.explanation?.whyThisScenario?.length);

  console.log('\n--- 4. POST /api/ai/recovery-brief ---');
  const brfRes = await fetch('http://localhost:4004/api/ai/recovery-brief', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  const brfData = await brfRes.json();
  console.log('HTTP Status:', brfRes.status);
  console.log('Source:', brfData.source);
  console.log('Provider:', brfData.provider);
  console.log('Model:', brfData.model);
  console.log('Brief Title:', brfData.brief?.briefTitle);
  console.log('Directives Count:', brfData.brief?.stakeholderDirectives?.length);

  console.log('\n--- 5. Checking Audit Log for AI Events ---');
  const auditRes = await fetch('http://localhost:4004/api/audit', {
    headers: authHeaders
  });
  const auditData = await auditRes.json();
  const aiEvents = auditData.filter(e => e.action?.includes('AI_'));
  console.log(`Found ${aiEvents.length} AI audit events recorded in SAP HANA Cloud.`);
  aiEvents.slice(0, 3).forEach(e => {
    console.log(`- [${e.action}] ${e.decision_rationale}`);
  });
}

testHttpEndpoints().catch(err => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
