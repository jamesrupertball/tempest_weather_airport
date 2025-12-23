# Metadata Setup Guide

This guide explains how to collect and store station and device metadata from your Tempest Weather Station using the `fetch_metadata.py` script.

## Overview

The `fetch_metadata.py` script is a **one-time setup utility** that fetches comprehensive information about your weather station(s) and device(s) from the Tempest REST API and stores it in Supabase database tables.

## What is Metadata?

Metadata includes static or semi-static information about your weather station setup:

- **Station Information**: Name, location (lat/lon), timezone, elevation, public name
- **Device Information**: Serial numbers, device types, hardware/firmware versions, WiFi details
- **Configuration Details**: Height above ground level (AGL), environment type, sharing settings

This information is separate from the weather observations (temperature, wind, etc.) and typically doesn't change frequently.

## Prerequisites

- Tempest Weather Station with API access
- Supabase account and database
- Python 3.8 or higher
- Environment variables configured in `.env` file
- `stations` and `devices` tables created in Supabase (see below)

## Database Setup

Before running the metadata script, you need to create two tables in your Supabase database.

### 1. Create Stations Table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE stations (
    id BIGSERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL UNIQUE,
    name TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    timezone TEXT,
    public_name TEXT,
    elevation NUMERIC,
    share_with_wf BOOLEAN,
    share_with_wu BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stations_station_id ON stations(station_id);
```

### 2. Create Devices Table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE devices (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL UNIQUE,
    station_id INTEGER REFERENCES stations(station_id),
    serial_number TEXT,
    device_type TEXT,
    hardware_revision TEXT,
    firmware_revision TEXT,
    agl NUMERIC,
    device_name TEXT,
    environment TEXT,
    wifi_network_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_station_id ON devices(station_id);
```

## Running the Metadata Script

### 1. Ensure Environment Variables are Set

Your `.env` file should contain:

```env
TEMPEST_TOKEN=your_tempest_token_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
```

### 2. Run the Script

```bash
python fetch_metadata.py
```

### 3. Expected Output

You should see output like this:

```
============================================================
Tempest Metadata Fetcher
============================================================
Fetching station and device information from Tempest API...

Found 1 station(s)

============================================================
Station: My Home Weather (ID: 12345)
Location: 45.1234, -93.5678
Timezone: America/Chicago
Elevation: 285.0m
✓ Station record stored/updated

Found 1 device(s) for this station:
  - ST (Serial: ST-00012345, ID: 469455)
    Hardware: 1, Firmware: 177
    Name: Tempest
    Height AGL: 3.0m
    Environment: outdoor
    ✓ Device record stored/updated

============================================================
Metadata sync completed!
```

## When to Run This Script

Run `fetch_metadata.py` in these situations:

1. **Initial Setup**: When first setting up your weather data collection system
2. **New Device Added**: When you add a new device to your station
3. **Configuration Changes**: When you change device settings (name, height, etc.)
4. **Firmware Updates**: Optionally, to record new firmware versions
5. **Station Relocation**: When you move your station to a new location

**Note**: You typically only need to run this once unless your hardware or configuration changes.

## Understanding the Tables

### Stations Table

Stores information about each weather station location:

| Column | Type | Description |
|--------|------|-------------|
| `station_id` | INTEGER | Unique identifier from Tempest API |
| `name` | TEXT | Station name (e.g., "My Home Weather") |
| `latitude` | NUMERIC | Latitude coordinate |
| `longitude` | NUMERIC | Longitude coordinate |
| `timezone` | TEXT | IANA timezone (e.g., "America/Chicago") |
| `public_name` | TEXT | Public display name if shared |
| `elevation` | NUMERIC | Elevation in meters above sea level |
| `share_with_wf` | BOOLEAN | Sharing with WeatherFlow network |
| `share_with_wu` | BOOLEAN | Sharing with Weather Underground |

### Devices Table

Stores information about each physical device:

| Column | Type | Description |
|--------|------|-------------|
| `device_id` | INTEGER | Unique device identifier from Tempest API |
| `station_id` | INTEGER | Foreign key to stations table |
| `serial_number` | TEXT | Device serial number (e.g., "ST-00012345") |
| `device_type` | TEXT | Device type code (e.g., "ST" for Tempest) |
| `hardware_revision` | TEXT | Hardware revision number |
| `firmware_revision` | TEXT | Current firmware version |
| `agl` | NUMERIC | Height above ground level in meters |
| `device_name` | TEXT | Custom device name |
| `environment` | TEXT | Environment type (indoor/outdoor) |
| `wifi_network_name` | TEXT | Connected WiFi network name |

## Querying Metadata

### View All Stations

```sql
SELECT
    station_id,
    name,
    latitude,
    longitude,
    elevation,
    timezone
FROM stations
ORDER BY name;
```

### View All Devices with Station Info

```sql
SELECT
    d.device_id,
    d.serial_number,
    d.device_type,
    d.firmware_revision,
    s.name AS station_name,
    s.latitude,
    s.longitude
FROM devices d
JOIN stations s ON d.station_id = s.station_id
ORDER BY d.device_id;
```

### Get Device Details for Observations

This is useful for joining weather observations with device metadata:

```sql
SELECT
    o.timestamp,
    o.air_temperature,
    o.wind_avg,
    d.serial_number,
    d.device_type,
    d.agl AS height_agl,
    s.name AS station_name,
    s.elevation
FROM observations_tempest o
JOIN devices d ON o.device_id = d.device_id
JOIN stations s ON d.station_id = s.station_id
ORDER BY o.timestamp DESC
LIMIT 10;
```

## Upsert Behavior

The script uses **upsert** operations, which means:

- **First run**: Creates new records for stations and devices
- **Subsequent runs**: Updates existing records with any changes
- **No duplicates**: The UNIQUE constraint on `station_id` and `device_id` prevents duplicates

This makes the script safe to run multiple times without creating duplicate entries.

## Troubleshooting

### Error: "relation 'stations' does not exist"

**Solution**: You need to create the `stations` table first (see Database Setup above).

### Error: "relation 'devices' does not exist"

**Solution**: You need to create the `devices` table first (see Database Setup above).

### Error: "TEMPEST_TOKEN not found in .env file"

**Solution**: Ensure your `.env` file exists and contains the `TEMPEST_TOKEN` variable.

### No Data Returned

**Possible causes**:
- Invalid or expired Tempest API token
- No stations associated with your account
- Network connectivity issues

**Debug steps**:
1. Verify your token at [Tempest Developer Portal](https://tempestwx.com/settings/tokens)
2. Check that you have at least one station registered in your Tempest account
3. Test API access manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://swd.weatherflow.com/swd/rest/stations
   ```

### Permission Errors

If you get Supabase permission errors, verify:
- Your `SUPABASE_KEY` is the **service role key** (not anon key)
- Row Level Security (RLS) policies allow inserts on `stations` and `devices` tables

## Integration with Weather Observations

The `device_id` field in the `observations_tempest` table can be used to join with the `devices` table:

```sql
-- Get observations with full context
SELECT
    o.timestamp,
    o.air_temperature,
    o.relative_humidity,
    o.wind_avg,
    d.serial_number,
    d.agl,
    s.name AS station_name,
    s.latitude,
    s.longitude,
    s.elevation,
    s.timezone
FROM observations_tempest o
LEFT JOIN devices d ON o.device_id = d.device_id
LEFT JOIN stations s ON d.station_id = s.station_id
WHERE o.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY o.timestamp DESC;
```

## Multiple Stations Support

If you have multiple weather stations associated with your Tempest account:

- The script will automatically fetch and store all of them
- Each station will have its own record in the `stations` table
- Devices will be properly linked to their respective stations via `station_id`

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables for all credentials
- The `SUPABASE_KEY` should be the service role key for write access
- Consider using Supabase Row Level Security (RLS) policies to restrict access

## Related Documentation

- [README.md](README.md) - Main project documentation
- [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md) - Automated data collection setup
- [Tempest REST API Documentation](https://weatherflow.github.io/Tempest/api/swagger/)
- [Supabase Python Documentation](https://supabase.com/docs/reference/python/introduction)

## Next Steps

After setting up metadata:

1. Verify data was inserted:
   ```sql
   SELECT * FROM stations;
   SELECT * FROM devices;
   ```

2. Set up automated weather data collection (see [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md))

3. Create views or dashboards that combine observations with metadata

4. Re-run `fetch_metadata.py` only when your hardware or configuration changes
