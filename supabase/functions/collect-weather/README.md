# Collect Weather Edge Function

This Supabase Edge Function fetches weather data from the Tempest API and stores it in the Supabase database.

## How It Works

1. Calculates a 15-minute lookback window
2. Fetches observations from the Tempest REST API
3. Inserts each observation into the `observations_tempest` table
4. Skips duplicates automatically (based on UNIQUE timestamp constraint)
5. Returns a summary of stored vs. skipped observations

## Environment Variables

The function requires these environment variables (set in Supabase Dashboard):

- `TEMPEST_TOKEN` - Your Tempest API token
- `SUPABASE_URL` - Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (auto-provided)

## Deployment

See `EDGE_FUNCTION_SETUP.md` in the project root for deployment instructions.

## Testing

You can test the function locally or invoke it from the Supabase Dashboard or via HTTP request.

## Scheduling

This function is designed to be called by a pg_cron job every 1 minute. See the SQL setup script for scheduling configuration.
