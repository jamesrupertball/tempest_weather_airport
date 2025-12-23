-- Supabase Edge Function + Cron Setup
-- This script schedules a cron job to invoke the Edge Function every 5 minutes

-- ============================================================================
-- Prerequisites
-- ============================================================================
-- 1. Edge Function must be deployed first (see EDGE_FUNCTION_SETUP.md)
-- 2. pg_cron extension must be enabled
-- 3. Secrets must be configured in Supabase Dashboard

-- ============================================================================
-- Step 1: Verify pg_cron is enabled
-- ============================================================================
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- If this returns no rows, enable pg_cron in Database → Extensions

-- ============================================================================
-- Step 2: Store Supabase Project URL and Service Role Key in Vault
-- ============================================================================

-- IMPORTANT: Replace these placeholder values with your actual credentials

SELECT vault.create_secret(
    'https://your-project-ref.supabase.co',
    'supabase_project_url',
    'Supabase Project URL'
);

SELECT vault.create_secret(
    'your_supabase_service_role_key_here',
    'supabase_service_key',
    'Supabase Service Role Key'
);

-- Verify secrets were created
SELECT name, description FROM vault.decrypted_secrets;

-- ============================================================================
-- Step 3: Schedule the Edge Function to run every 5 minutes
-- ============================================================================

-- This cron job makes an HTTP POST request to your Edge Function
SELECT cron.schedule(
    'invoke-collect-weather-edge-function',
    '*/5 * * * *',  -- Every 5 minutes
    $$
    SELECT
      net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_project_url')
                 || '/functions/v1/collect-weather',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')
          ),
          body := jsonb_build_object('time', now()::text)
      ) AS request_id;
    $$
);

-- ============================================================================
-- Step 4: Verify the cron job was created
-- ============================================================================

SELECT * FROM cron.job WHERE jobname = 'invoke-collect-weather-edge-function';

-- ============================================================================
-- Monitoring Commands
-- ============================================================================

-- View recent cron job executions
SELECT
    jobid,
    runid,
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobname = 'invoke-collect-weather-edge-function'
ORDER BY start_time DESC
LIMIT 20;

-- Check recent weather observations
SELECT
    timestamp,
    air_temperature,
    relative_humidity,
    wind_avg,
    pressure,
    created_at
FROM observations_tempest
ORDER BY timestamp DESC
LIMIT 10;

-- ============================================================================
-- Management Commands
-- ============================================================================

-- Unschedule the cron job (if needed)
-- SELECT cron.unschedule('invoke-collect-weather-edge-function');

-- Re-schedule with different interval (e.g., every 10 minutes)
-- SELECT cron.unschedule('invoke-collect-weather-edge-function');
-- SELECT cron.schedule(
--     'invoke-collect-weather-edge-function',
--     '*/10 * * * *',
--     $$ ... same SQL as above ... $$
-- );
