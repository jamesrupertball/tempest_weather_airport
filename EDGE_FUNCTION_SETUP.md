# Supabase Edge Function Setup Guide

This guide explains how to deploy and configure the Supabase Edge Function for automated weather data collection with pg_cron scheduling.

## Overview

This approach uses:
- **Supabase Edge Function** (TypeScript/Deno) - Fetches data from Tempest API and inserts to database
- **pg_cron** - Triggers the Edge Function every 5 minutes via HTTP POST

## Advantages

✅ **Reliable 5-minute intervals** - No GitHub Actions delays
✅ **No pg_net dependency** - Uses standard HTTP requests
✅ **Easy to test and debug** - Can invoke function directly from browser/curl
✅ **Familiar syntax** - TypeScript is similar to JavaScript/Python
✅ **Built-in monitoring** - Supabase Dashboard shows function logs
✅ **Free tier friendly** - Minimal Edge Function invocations (~8,640/month)

## Prerequisites

- Supabase CLI installed (see installation instructions below)
- Supabase project created
- `observations_tempest` table created (see README.md)
- Tempest API token
- pg_cron extension enabled in Supabase

## Step 1: Install Supabase CLI

### Windows (PowerShell):
```powershell
scoop install supabase
```

Or download from: https://github.com/supabase/cli/releases

### macOS:
```bash
brew install supabase/tap/supabase
```

### Linux:
```bash
brew install supabase/tap/supabase
```

Verify installation:
```bash
supabase --version
```

## Step 2: Link Your Project

```bash
# Login to Supabase
supabase login

# Link to your project (you'll need your project ref)
supabase link --project-ref your-project-ref
```

Your project ref is in your Supabase URL: `https://YOUR-PROJECT-REF.supabase.co`

## Step 3: Set Function Secrets

The Edge Function needs your Tempest API token as an environment variable:

```bash
# Set the Tempest token secret
supabase secrets set TEMPEST_TOKEN=your_tempest_token_here
```

**Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided by Supabase.

## Step 4: Deploy the Edge Function

From your project root directory:

```bash
# Deploy the collect-weather function
supabase functions deploy collect-weather
```

This will:
1. Upload the TypeScript code to Supabase
2. Build and deploy the function
3. Make it available at `https://your-project-ref.supabase.co/functions/v1/collect-weather`

## Step 5: Test the Edge Function

Test the function manually to ensure it works:

### Via curl:
```bash
curl -i --location --request POST \
  'https://your-project-ref.supabase.co/functions/v1/collect-weather' \
  --header 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  --header 'Content-Type: application/json'
```

### Via Supabase Dashboard:
1. Go to **Edge Functions** in the Supabase Dashboard
2. Click on **collect-weather**
3. Click **Invoke Function**

You should see a JSON response like:
```json
{
  "status": "success",
  "timestamp": "2025-12-23T21:30:00.000Z",
  "total_observations": 15,
  "stored": 12,
  "skipped": 3,
  "time_range_minutes": 15
}
```

## Step 6: Schedule with pg_cron

Now that the Edge Function is deployed and working, schedule it to run every 5 minutes:

1. Open Supabase SQL Editor
2. Open the file `supabase_edge_function_setup.sql`
3. Update the secrets in Step 2 with your actual values:
   - `supabase_project_url` - Your full Supabase URL (e.g., `https://abc123.supabase.co`)
   - `supabase_service_key` - Your service role key (found in Project Settings → API)
4. Run the entire script

This will create a cron job that POSTs to your Edge Function every 5 minutes.

## Step 7: Monitor Execution

### Check cron job runs:
```sql
SELECT
    start_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobname = 'invoke-collect-weather-edge-function'
ORDER BY start_time DESC
LIMIT 10;
```

### Check Edge Function logs:
1. Go to **Edge Functions** in Supabase Dashboard
2. Click on **collect-weather**
3. View the **Logs** tab

### Check collected data:
```sql
SELECT
    timestamp,
    air_temperature,
    relative_humidity,
    wind_avg
FROM observations_tempest
ORDER BY timestamp DESC
LIMIT 20;
```

## Updating the Function

If you need to make changes to the Edge Function:

1. Edit `supabase/functions/collect-weather/index.ts`
2. Redeploy:
```bash
supabase functions deploy collect-weather
```

The cron job will automatically use the updated version.

## Troubleshooting

### Function returns errors about missing environment variables

Make sure secrets are set:
```bash
supabase secrets list
```

If `TEMPEST_TOKEN` is missing:
```bash
supabase secrets set TEMPEST_TOKEN=your_token_here
```

### Cron job not triggering the function

Check if pg_cron is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

Check if the cron job exists:
```sql
SELECT * FROM cron.job WHERE jobname = 'invoke-collect-weather-edge-function';
```

### Function works manually but fails from cron

The cron job might be using the wrong authentication. Verify the service role key in vault:
```sql
SELECT name FROM vault.decrypted_secrets;
```

## Alternative: HTTP Extension Method

If `net.http_post` doesn't work, you can use the `http` extension instead:

```sql
-- Enable http extension
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule using http extension
SELECT cron.schedule(
    'invoke-collect-weather-edge-function',
    '*/5 * * * *',
    $$
    SELECT
      content::jsonb
    FROM http((
        'POST',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_project_url')
           || '/functions/v1/collect-weather',
        ARRAY[
          http_header('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{}'
    )::http_request);
    $$
);
```

## Cost Considerations

**Edge Function Invocations:**
- Free tier: 500,000 invocations/month
- Your usage: ~8,640 invocations/month (12 per hour × 24 × 30)
- **Cost: FREE** (less than 2% of free tier limit)

**Execution time:**
- Each invocation takes ~1-3 seconds
- Well within Supabase limits

## Comparison: Direct SQL vs Edge Function

| Aspect | Direct SQL (pg_net) | Edge Function |
|--------|---------------------|---------------|
| **Setup Complexity** | ⚠️ Complex, pg_net issues | ✅ Straightforward |
| **Debugging** | ❌ Difficult | ✅ Easy (logs, direct invoke) |
| **Code Familiarity** | ❌ PL/pgSQL | ✅ TypeScript |
| **Reliability** | ⚠️ pg_net compatibility issues | ✅ Standard HTTP |
| **Performance** | ✅ Slightly faster (local) | ✅ Fast enough (~2sec) |
| **Maintainability** | ⚠️ Harder to update | ✅ Easy to update |

## Next Steps

Once deployed and scheduled:

1. Monitor the first few executions (check logs and database)
2. Verify data is being collected every 5 minutes
3. Optionally disable GitHub Actions workflow (keep as backup)
4. Set up alerts or dashboards with your weather data

## Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/introduction)
- [Deno Documentation](https://deno.land/manual)
- [Tempest API Documentation](https://weatherflow.github.io/Tempest/api/swagger/)
