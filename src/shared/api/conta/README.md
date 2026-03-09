# Conta API Integration

This directory contains the integration with Conta accounting software.

## Files

- `conta-external-api.json` - Swagger/OpenAPI specification from Conta (27,516 lines)
- `client.ts` - Conta API client setup
- `types.ts` - TypeScript types generated from the API specification

## Setup

1. **Add the Swagger JSON file**:
   - Download the Conta API specification from their developer portal
   - Place it as `conta-external-api.json` in this directory
   - ⚠️ Note: This file is gitignored due to size (~1.4MB)

2. Install dependencies for type generation:

   ```bash
   npm install --save-dev openapi-typescript
   ```

3. Generate TypeScript types:

   ```bash
   npm run conta:types
   ```

4. Configure environment variables in `.env.local`:

   ```env
   VITE_CONTA_API_URL_PROD=https://api.gateway.conta.no
   VITE_CONTA_API_URL_SANDBOX=https://api.gateway.conta-sandbox.no
   # Optional fallback for legacy setups:
   VITE_CONTA_API_URL=https://api.gateway.conta.no
   ```

   Note: API keys are stored per-company in the database, not in environment variables.

5. **Use production Conta in local dev** (optional): To hit production Conta API when running locally (e.g. `npm run dev`), set:

   ```env
   VITE_CONTA_USE_PRODUCTION_IN_DEV=true
   ```

   The app will then use the company’s **production** API key and production URL regardless of the company’s “Sandbox / Production” setting. Only has effect when running in development mode.

## Usage

Import the client in your features:

```typescript
import { contaClient } from '@shared/api/conta/client'

// Use the client to make API calls
// The client automatically uses the current user's selected company
const data = await contaClient.get('/some-endpoint')
```

**Note:** The API key is stored encrypted in the `company_expansions` table per company and is automatically decrypted server-side using the `get_conta_api_key()` RPC function. The RPC ensures:

- User is authenticated
- User belongs to the company
- Only then returns the decrypted API key
