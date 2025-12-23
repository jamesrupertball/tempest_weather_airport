# Minnesota Weather Reporting - Tempest Station

A Python application that connects to your Tempest Weather Station via WebSocket API and stores real-time weather data in a Supabase cloud database.

## Features

- Real-time weather data collection via Tempest WebSocket API
- Automatic reconnection on connection loss
- Stores multiple data types:
  - Tempest observations (temperature, humidity, wind, pressure, UV, etc.)
  - Rapid wind updates
  - Precipitation events
  - Lightning strike events
  - Legacy AIR and SKY device observations

## Prerequisites

- Python 3.8 or higher
- Tempest Weather Station with API access
- Supabase account and database

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

You'll need to create the following tables in your Supabase database:

### Main Weather Observations Table
```sql
CREATE TABLE weather_observations (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    serial_number TEXT,
    wind_lull NUMERIC,
    wind_avg NUMERIC,
    wind_gust NUMERIC,
    wind_direction INTEGER,
    wind_sample_interval INTEGER,
    station_pressure NUMERIC,
    air_temperature NUMERIC,
    relative_humidity INTEGER,
    illuminance INTEGER,
    uv NUMERIC,
    solar_radiation INTEGER,
    rain_accumulated NUMERIC,
    precipitation_type INTEGER,
    lightning_avg_distance INTEGER,
    lightning_strike_count INTEGER,
    battery NUMERIC,
    report_interval INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_timestamp ON weather_observations(timestamp DESC);
```

### Rapid Wind Table
```sql
CREATE TABLE rapid_wind (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    wind_speed NUMERIC,
    wind_direction INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rapid_wind_timestamp ON rapid_wind(timestamp DESC);
```

### Precipitation Events Table
```sql
CREATE TABLE precipitation_events (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    serial_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Lightning Strikes Table
```sql
CREATE TABLE lightning_strikes (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    serial_number TEXT,
    distance INTEGER,
    energy INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Legacy Device Tables (optional)
```sql
CREATE TABLE air_observations (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    serial_number TEXT,
    station_pressure NUMERIC,
    air_temperature NUMERIC,
    relative_humidity INTEGER,
    lightning_strike_count INTEGER,
    lightning_avg_distance INTEGER,
    battery NUMERIC,
    report_interval INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sky_observations (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id INTEGER,
    serial_number TEXT,
    illuminance INTEGER,
    uv NUMERIC,
    rain_accumulated NUMERIC,
    wind_lull NUMERIC,
    wind_avg NUMERIC,
    wind_gust NUMERIC,
    wind_direction INTEGER,
    battery NUMERIC,
    report_interval INTEGER,
    solar_radiation INTEGER,
    local_day_rain_accumulation NUMERIC,
    precipitation_type INTEGER,
    wind_sample_interval INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage

Run the weather data collector:

```bash
python tempest_weather.py
```

The script will:
1. Connect to the Tempest WebSocket API
2. Listen for weather data updates
3. Automatically store received data in your Supabase database
4. Reconnect automatically if the connection drops

To run in the background (Linux/Mac):
```bash
nohup python tempest_weather.py > weather.log 2>&1 &
```

On Windows, you can use:
```bash
pythonw tempest_weather.py
```

## Data Collection

The script collects the following types of data:

- **obs_st**: Complete Tempest observations every minute
- **rapid_wind**: Wind updates every 3 seconds
- **evt_precip**: Precipitation start events
- **evt_strike**: Lightning strike events
- **obs_air**: AIR device observations (legacy)
- **obs_sky**: SKY device observations (legacy)

## Troubleshooting

### Connection Issues
- Verify your Tempest token is correct
- Check your internet connection
- Ensure the WebSocket endpoint is accessible

### Database Errors
- Verify Supabase credentials are correct
- Ensure all required tables exist in your database
- Check that table column names match the script

### Missing Data
- The script only receives data when your station reports it
- Tempest stations typically report every 1 minute
- Rapid wind updates occur every 3 seconds

## Security Notes

- Never commit your `.env` file to version control
- The `.gitignore` file is configured to exclude sensitive files
- Use environment variables for all credentials
- Consider using Supabase Row Level Security (RLS) policies

## Contributing

Feel free to submit issues or pull requests for improvements.

## License

MIT License - feel free to use and modify as needed.

## Resources

- [Tempest WebSocket API Documentation](https://weatherflow.github.io/Tempest/api/ws.html)
- [Supabase Python Documentation](https://supabase.com/docs/reference/python/introduction)
