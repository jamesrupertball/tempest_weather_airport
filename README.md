# Minnesota Weather Reporting - Tempest Station

A weather data collection system that fetches historical data from your Tempest Weather Station via the REST API and stores it in a Supabase cloud database.

## Features

- Historical weather data collection via Tempest REST API
- Configurable lookback period for data collection
- Duplicate detection to prevent redundant data storage
- **Automated collection via Supabase Cron (recommended)** - Reliable 5-minute intervals
- Alternative: GitHub Actions automation (15-20 minute intervals)
- Python scripts for local/manual data collection
- Stores Tempest observations including:
  - Temperature, humidity, wind speed/direction, and pressure
  - UV index, solar radiation, and illuminance
  - Precipitation and lightning data
  - Battery levels and device metrics

## Prerequisites

- Tempest Weather Station with API access
- Supabase account and database
- Python 3.8 or higher (only for local/manual collection)

## Installation

1. Clone this repository:
```bash
git clone <your-repository-url>
cd 00MN_weather_reporting
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the project root with your credentials:
```bash
cp .env.example .env
```

4. Edit the `.env` file and add your credentials:
```env
TEMPEST_TOKEN=your_tempest_token_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
```

## Database Setup

You'll need to create the following table in your Supabase database:

### Tempest Observations Table
```sql
CREATE TABLE observations_tempest (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL UNIQUE,
    device_id INTEGER,
    wind_lull NUMERIC,
    wind_avg NUMERIC,
    wind_gust NUMERIC,
    wind_direction INTEGER,
    wind_sample_interval INTEGER,
    pressure NUMERIC,
    air_temperature NUMERIC,
    relative_humidity INTEGER,
    illuminance INTEGER,
    uv_index NUMERIC,
    solar_radiation INTEGER,
    rain_accumulation NUMERIC,
    precipitation_type INTEGER,
    lightning_avg_distance INTEGER,
    lightning_strike_count INTEGER,
    battery NUMERIC,
    report_interval INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tempest_timestamp ON observations_tempest(timestamp DESC);
CREATE INDEX idx_tempest_device ON observations_tempest(device_id);
```

Note: The UNIQUE constraint on `timestamp` prevents duplicate observations from being stored.

## Usage

There are three ways to collect weather data:

1. **Supabase Cron (Recommended)** - Fully automated, runs every 5 minutes within Supabase
2. **GitHub Actions** - Automated via GitHub (actual interval: 15-20 minutes)
3. **Python Scripts** - Manual or self-hosted collection

### Method 1: Automated Collection with Supabase Edge Function + Cron (Recommended)

This is the **recommended approach** for automated data collection. It uses a Supabase Edge Function (TypeScript) triggered by pg_cron every 5 minutes.

**Advantages:**
- ✅ Reliable 5-minute intervals (no delays or throttling)
- ✅ No external dependencies or GitHub Actions minutes
- ✅ Easy to test and debug (invoke function directly)
- ✅ TypeScript is familiar and maintainable
- ✅ Built-in monitoring via Supabase Dashboard
- ✅ Free tier friendly (~8,640 invocations/month vs 500,000 limit)

**Setup:**

See the detailed guide in [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md) for complete instructions.

**Quick Start:**

1. Install Supabase CLI: `scoop install supabase` (Windows) or `brew install supabase/tap/supabase` (Mac/Linux)
2. Login and link project: `supabase login && supabase link --project-ref your-ref`
3. Set secrets: `supabase secrets set TEMPEST_TOKEN=your_token`
4. Deploy function: `supabase functions deploy collect-weather`
5. Test it: Invoke from Supabase Dashboard → Edge Functions
6. Schedule with cron: Run `supabase_edge_function_setup.sql` in SQL Editor

The Edge Function will run every 5 minutes automatically.

### Method 2: Automated Collection with GitHub Actions

This repository includes a GitHub Actions workflow that collects historical weather data using the Python script.

**Note:** GitHub Actions scheduled workflows run on a "best effort" basis and are often delayed during peak usage. The workflow is configured for 5-minute intervals but typically runs every 15-20 minutes in practice.

**Setup GitHub Secrets:**

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three secrets:

   - Name: `TEMPEST_TOKEN`
     Value: Your Tempest API token

   - Name: `SUPABASE_URL`
     Value: Your Supabase project URL

   - Name: `SUPABASE_KEY`
     Value: Your Supabase service role key

4. The workflow will start running automatically (actual interval: ~15-20 minutes)
5. You can manually trigger it from the **Actions** tab → **Collect Weather Data** → **Run workflow**

**Monitor the workflow:**
- Go to the **Actions** tab to see runs and logs
- Each run collects the last 15 minutes of weather data by default
- Duplicate observations are automatically skipped

**Recommendation:** If you need reliable 5-minute collection intervals, use Supabase Cron (Method 1) instead.

### Method 3: Manual Local Usage with Python Scripts

Run the weather data collector locally:

**Single collection (default - collects last 15 minutes):**
```bash
python tempest_weather.py
```

**Custom lookback period:**
```bash
python tempest_weather.py --lookback=30  # Collect last 30 minutes of data
```

**Continuous monitoring mode:**
```bash
python tempest_weather.py --continuous  # Runs every 5 minutes indefinitely
```

The script will:
1. Fetch historical observations from the Tempest REST API
2. Store new observations in your Supabase database
3. Automatically skip duplicate records
4. Display summary statistics for each collection

To run in the background (Linux/Mac):
```bash
nohup python tempest_weather.py --continuous > weather.log 2>&1 &
```

On Windows, you can use:
```bash
pythonw tempest_weather.py --continuous
```

## Data Collection

The script collects historical Tempest observations, which are typically recorded every minute and include:

- **Environmental Data**: Temperature, humidity, pressure
- **Wind Data**: Lull, average, gust speeds and direction
- **Solar Data**: UV index, solar radiation, illuminance
- **Precipitation Data**: Rain accumulation, precipitation type
- **Lightning Data**: Strike count and average distance
- **Device Metrics**: Battery level, report intervals

The data is fetched from the Tempest REST API using a configurable lookback period (default: 15 minutes) to ensure no observations are missed between collection runs.

## Troubleshooting

### API Issues
- Verify your Tempest API token is correct and active
- Check your internet connection
- Ensure the REST API endpoint (`https://swd.weatherflow.com/swd/rest`) is accessible
- Check that your device ID (469455) is correct for your station

### Database Errors
- Verify Supabase credentials are correct
- Ensure the `observations_tempest` table exists in your database
- Check that table column names match the script
- Duplicate key errors are normal and will be silently skipped

### Missing or Incomplete Data
- The script fetches historical data based on the lookback period
- If running every 5 minutes, a 15-minute lookback provides overlap to prevent gaps
- Tempest stations typically record observations every 1 minute
- Check your station's online status at the Tempest web interface

## Security Notes

- Never commit your `.env` file to version control
- The `.gitignore` file is configured to exclude sensitive files
- Use environment variables for all credentials
- Consider using Supabase Row Level Security (RLS) policies

## Contributing

Feel free to submit issues or pull requests for improvements.

## License

MIT License - feel free to use and modify as needed.

## Comparison: Edge Function vs GitHub Actions vs Local Python

| Feature | Supabase Edge Function | GitHub Actions | Local Python |
|---------|------------------------|----------------|--------------|
| **Interval Reliability** | ✅ Every 5 min | ⚠️ 15-20 min | ✅ Every 5 min |
| **Setup Complexity** | ⚠️ CLI + SQL | ✅ Easy | ✅ Easy |
| **Debugging** | ✅ Easy (logs, invoke) | ✅ Good (Actions UI) | ✅ Direct |
| **Code Language** | ✅ TypeScript | ✅ Python | ✅ Python |
| **External Dependencies** | ❌ None | ⚠️ GitHub | ⚠️ Your server |
| **Monitoring** | ✅ Dashboard + logs | ✅ Actions UI | ⚠️ Manual |
| **Cost** | ✅ Free (< 2% limit) | ✅ Free | ⚠️ Server cost |
| **Best For** | Production use | Backup/fallback | Testing/dev |

## Resources

- [Edge Function Setup Guide](EDGE_FUNCTION_SETUP.md) - Recommended deployment method
- [Metadata Setup Guide](METADATA_SETUP.md) - Station and device metadata collection
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron)
- [Tempest REST API Documentation](https://weatherflow.github.io/Tempest/api/swagger/)
- [Supabase Python Documentation](https://supabase.com/docs/reference/python/introduction)
- [Tempest Developer Portal](https://tempestwx.com/settings/tokens)
