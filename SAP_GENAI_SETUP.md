# SAP Generative AI Hub Setup Guide for FLODA

This setup guide provides step-by-step instructions for connecting FLODA to **SAP Generative AI Hub / SAP AI Core** via SAP AI Launchpad on SAP Business Technology Platform (BTP).

---

## 1. SAP AI Launchpad Access

1. Open your SAP BTP Cockpit: [https://cockpit.eu10.hana.ondemand.com/](https://cockpit.eu10.hana.ondemand.com/)
2. Navigate to your Subaccount $\rightarrow$ **Instances and Subscriptions**.
3. Under **Subscriptions**, locate **SAP AI Launchpad** and click **Go to Application**.
4. In SAP AI Launchpad, select your AI Core connection from the top-left connection dropdown (e.g., `ai-core-production` or `hackfest-ai-core`).

---

## 2. Identify the SAP AI Core Connection

1. In SAP AI Launchpad, navigate to **Workspaces** $\rightarrow$ **Resource Groups**.
2. Identify the active resource group (default is usually `default` or `floda-resilience`).
3. Under **ML Operations** $\rightarrow$ **Deployments**, locate the active Generative AI deployment:
   - Check if an **Orchestration V2** deployment exists (e.g. `orchestration-v2` or deployment ID starting with `d...`).
   - Check available foundation model deployments (e.g., `gpt-4o`, `gpt-4-32k`, or `anthropic--claude-3.5-sonnet`).
4. Note down:
   - **Resource Group Name**: e.g., `default`
   - **Model Name**: e.g., `gpt-4o`
   - **Deployment ID**: (optional if using default orchestration endpoint)

---

## 3. Obtain the SAP AI Core Service Key

1. In SAP BTP Cockpit, navigate to **Instances and Subscriptions** $\rightarrow$ **Instances**.
2. Locate your **SAP AI Core** instance (service: `aicore`, plan: `extended` or `standard`).
3. Click the instance $\rightarrow$ **Service Keys** tab.
4. If a service key exists, click **View Credentials** (JSON format).
5. If no key exists and your role permits, click **Create Service Key** with key name `floda-genai-key`.
6. From the JSON service key, extract the following parameters:

```json
{
  "clientid": "<YOUR_CLIENT_ID>",
  "clientsecret": "<YOUR_CLIENT_SECRET>",
  "url": "<YOUR_AUTH_URL>",
  "serviceurls": {
    "AI_API_URL": "<YOUR_BASE_URL>"
  }
}
```

> **Security Rule**: Never commit, share, or log your `clientsecret`. Keep it strictly in `server/.env`.

---

## 4. Required Roles and Permissions

Your SAP BTP user or technical service account requires the following role templates:
- `AICoreAdmin` or `AICoreDeveloper`
- `AILaunchpadAdmin` or `AILaunchpadViewer`

---

## 5. Required Environment Variables

Configure these variables in your `server/.env` file:

```env
# ==========================================
# SAP Generative AI Hub / SAP AI Core
# ==========================================
AICORE_CLIENT_ID=<your-client-id-from-service-key>
AICORE_CLIENT_SECRET=<your-client-secret-from-service-key>
AICORE_AUTH_URL=https://<your-subdomain>.authentication.eu10.hana.ondemand.com
AICORE_BASE_URL=https://api.ai.prod-eu10.eu-central-1.aws.ml.hana.ondemand.com
AICORE_RESOURCE_GROUP=default

# Generative AI Model Configuration
FLODA_AI_MODEL=gpt-4o
FLODA_AI_DEPLOYMENT_ID=
```

---

## 6. Starting the Backend & Testing Connectivity

### Step 1: Start Backend Server
```powershell
cd "c:\Users\hp\Downloads\Sap floda final\SAP Final\SAP Final\sap-floda-main\server"
node server.js
```

### Step 2: Verify AI Core Connection Health
Query the `/api/ai/health` endpoint:
```powershell
curl -s http://localhost:4004/api/ai/health
```

Expected Response when Connected:
```json
{
  "available": true,
  "configured": true,
  "provider": "SAP Generative AI Hub",
  "model": "gpt-4o",
  "deployment": "orchestration-v2",
  "resourceGroup": "default",
  "status": "CONNECTED",
  "message": "SAP Generative AI Hub authenticated and operational."
}
```

Expected Response when Credentials are Missing (Graceful Fallback Active):
```json
{
  "available": false,
  "configured": false,
  "provider": "SAP Generative AI Hub",
  "model": "gpt-4o",
  "status": "NOT_CONFIGURED",
  "message": "SAP AI Core credentials not configured in environment. Deterministic intelligence fallback active."
}
```

---

## 7. Testing AI Situation Report via CLI

Authenticate and trigger an AI Situation Report:

```powershell
# 1. Log in as Authority
$token = (Invoke-RestMethod -Uri "http://localhost:4004/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"authority@floda.local","password":"FlodaDemo2026!"}').token

# 2. Generate Situation Report
Invoke-RestMethod -Uri "http://localhost:4004/api/ai/situation-report" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body '{}'
```

---

## 8. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `status: "NOT_CONFIGURED"` | `AICORE_CLIENT_ID` or URLs missing in `.env` | Add service key credentials to `server/.env` and restart server. |
| `SAP AI Core auth token request failed with status 401` | Invalid client ID or secret | Verify `clientid` and `clientsecret` in SAP BTP service key. |
| `SAP GenAI Hub API error (404)` | Deployment not found or inactive | Check SAP AI Launchpad Deployments; specify active deployment ID in `FLODA_AI_DEPLOYMENT_ID`. |
| `AI-Resource-Group header rejected` | Resource group does not exist | Check SAP AI Launchpad $\rightarrow$ Resource Groups and update `AICORE_RESOURCE_GROUP`. |
| `Deterministic Fallback Active` | Normal behavior when external API is unreachable | The application automatically uses deterministic intelligence grounded in SAP HANA Cloud. No operational downtime occurs. |
