# Minnesota Weather Reporting - Tempest Station

A weather data collection and display system that fetches data from your Tempest Weather Station via the REST API, stores it in Supabase, and serves it through a Vercel-hosted web interface.

## Architecture

1. **Data Collection**: Supabase Edge Function (TypeScript) fetches weather data from Tempest REST API every 5 minutes via pg_cron
2. **Data Storage**: Weather observations stored in Supabase PostgreSQL database
3. **Web Interface**: Static website deployed on Vercel displays real-time weather data

## Features

- Automated weather data collection every 5 minutes
- Real-time weather dashboard showing:
  - Temperature, humidity, wind speed/direction, and pressure
  - UV index, solar radiation, and illuminance
  - Precipitation and lightning data
  - Battery levels and device metrics
- Duplicate detection to prevent redundant data storage
- Responsive web interface

## Prerequisites

- Tempest Weather Station with API access
- Supabase account and database
- Vercel account for web hosting
- Supabase CLI installed

## Setup

### 1. Clone Repository

```bash
git clone <your-repository-url>
cd 00MN_weather_reporting
```

### 2. Configure Environment Variables

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
TEMPEST_TOKEN=your_tempest_token_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
```

### 3. Database Setup

Create the observations table in your Supabase database:

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

The UNIQUE constraint on `timestamp` prevents duplicate observations.

### 4. Deploy Edge Function

Install Supabase CLI:

```bash
# Windows
scoop install supabase

# Mac/Linux
brew install supabase/tap/supabase
```

Login and link your project:

```bash
supabase login
supabase link --project-ref your-project-ref
```

Set your Tempest API token as a secret:

```bash
supabase secrets set TEMPEST_TOKEN=your_token_here
```

Deploy the edge function:

```bash
supabase functions deploy collect-weather
```

### 5. Schedule the Edge Function

In your Supabase SQL Editor, run:

```sql
SELECT cron.schedule(
    'collect-weather-every-5-min',
    '*/5 * * * *',
    $$
    SELECT
      net.http_post(
          url:='https://your-project-ref.supabase.co/functions/v1/collect-weather',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
      ) AS request_id;
    $$
);
```

Replace `your-project-ref` and `YOUR_ANON_KEY` with your actual values.

### 6. Deploy to Vercel

Install Vercel CLI:

```bash
npm i -g vercel
```

Deploy:

```bash
vercel --prod
```

Configure environment variables in Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_KEY`

## Project Structure

```
├── supabase/
│   ├── functions/
│   │   └── collect-weather/
│   │       └── index.ts          # Edge function for data collection
│   ├── config.toml                # Supabase configuration
│   └── migrations/                # Database migrations
├── app.js                         # Frontend JavaScript
├── index.html                     # Main web interface
├── style.css                      # Styles
├── build.js                       # Build script for Vercel
├── config.js                      # Frontend configuration
├── vercel.json                    # Vercel deployment config
└── README.md                      # This file
```

## Monitoring

- **Edge Function Logs**: Supabase Dashboard → Edge Functions → collect-weather
- **Database**: Supabase Dashboard → Table Editor → observations_tempest
- **Website**: Your Vercel deployment URL

## Troubleshooting

### Edge Function Not Running

- Check cron job status: `SELECT * FROM cron.job;`
- View recent runs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- Check edge function logs in Supabase Dashboard

### No Data Appearing

- Verify Tempest API token is valid
- Check edge function logs for errors
- Ensure device ID in edge function matches your station
- Verify database table exists and has correct schema

### Website Issues

- Check browser console for JavaScript errors
- Verify Supabase credentials in Vercel environment variables
- Ensure CORS is configured correctly in Supabase

## Resources

- [Tempest REST API Documentation](https://weatherflow.github.io/Tempest/api/swagger/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Vercel Deployment](https://vercel.com/docs)
- [Tempest Developer Portal](https://tempestwx.com/settings/tokens)

## License

MIT License - feel free to use and modify as needed.
