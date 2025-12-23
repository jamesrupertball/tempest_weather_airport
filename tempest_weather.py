#!/usr/bin/env python3
"""
Tempest Weather Station REST API Client
Fetches historical weather data from Tempest API and stores it in Supabase
"""

import os
import requests
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

TEMPEST_TOKEN = os.getenv('TEMPEST_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Tempest REST API endpoint
TEMPEST_API_BASE_URL = "https://swd.weatherflow.com/swd/rest"
DEVICE_ID = 469455  # Your Tempest station device ID


class TempestWeatherClient:
    def __init__(self, lookback_minutes=15):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.lookback_minutes = lookback_minutes
        self.session = requests.Session()
        self.session.headers.update({'Authorization': f'Bearer {TEMPEST_TOKEN}'})

    def fetch_observations(self):
        """Fetch recent observations from Tempest REST API"""
        # Calculate time range (lookback in minutes to ensure we don't miss data)
        end_time = int(time.time())
        start_time = end_time - (self.lookback_minutes * 60)

        url = f"{TEMPEST_API_BASE_URL}/observations/device/{DEVICE_ID}"
        params = {
            'time_start': start_time,
            'time_end': end_time
        }

        print(f"Fetching observations from {datetime.fromtimestamp(start_time)} to {datetime.fromtimestamp(end_time)}")

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            return data

        except requests.exceptions.RequestException as e:
            print(f"Error fetching observations: {e}")
            return None

    def store_tempest_observation(self, obs, device_id):
        """Store Tempest observation in Supabase"""
        try:
            # Tempest observation format:
            # [0] Epoch time, [1] Wind Lull, [2] Wind Avg, [3] Wind Gust,
            # [4] Wind Direction, [5] Wind Sample Interval, [6] Station Pressure,
            # [7] Air Temperature, [8] Relative Humidity, [9] Illuminance,
            # [10] UV, [11] Solar Radiation, [12] Rain accumulated,
            # [13] Precipitation Type, [14] Lightning Strike Avg Distance,
            # [15] Lightning Strike Count, [16] Battery, [17] Report Interval

            record = {
                'timestamp': datetime.fromtimestamp(obs[0], tz=timezone.utc).isoformat(),
                'device_id': device_id,
                'wind_lull': obs[1],
                'wind_avg': obs[2],
                'wind_gust': obs[3],
                'wind_direction': obs[4],
                'wind_sample_interval': obs[5],
                'pressure': obs[6],
                'air_temperature': obs[7],
                'relative_humidity': obs[8],
                'illuminance': obs[9],
                'uv_index': obs[10],
                'solar_radiation': obs[11],
                'rain_accumulation': obs[12],
                'precipitation_type': obs[13],
                'lightning_avg_distance': obs[14],
                'lightning_strike_count': obs[15],
                'battery': obs[16],
                'report_interval': obs[17]
            }

            # Try to insert; if it fails due to duplicate, that's okay
            try:
                self.supabase.table('observations_tempest').insert(record).execute()
                return True
            except Exception as insert_error:
                # Check if it's a duplicate key error
                error_msg = str(insert_error)
                if 'duplicate' in error_msg.lower() or 'unique' in error_msg.lower():
                    # Silently skip duplicates
                    return False
                else:
                    # Re-raise other errors
                    raise

        except Exception as e:
            print(f"Error storing Tempest observation: {e}")
            print(f"Observation data: {obs}")
            return False

    def collect_and_store(self):
        """Fetch and store observations"""
        print(f"\n[{datetime.now()}] Starting data collection")

        data = self.fetch_observations()

        if not data:
            print("No data received from API")
            return 0

        obs_list = data.get('obs', [])
        device_id = data.get('device_id')

        if not obs_list:
            print("No observations found in response")
            return 0

        print(f"Received {len(obs_list)} observations")

        stored_count = 0
        skipped_count = 0

        for obs in obs_list:
            if self.store_tempest_observation(obs, device_id):
                stored_count += 1
                # Print details of first and last observation
                if stored_count == 1 or stored_count == len(obs_list):
                    timestamp = datetime.fromtimestamp(obs[0])
                    print(f"  [{timestamp}] Temp={obs[7]}°C, Humidity={obs[8]}%, Wind={obs[2]}m/s")
            else:
                skipped_count += 1

        print(f"\nStored {stored_count} observations")
        if skipped_count > 0:
            print(f"Skipped {skipped_count} duplicate observations")

        return stored_count


def main():
    """Main entry point"""
    import sys

    # Validate environment variables
    if not TEMPEST_TOKEN:
        print("ERROR: TEMPEST_TOKEN not found in .env file")
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env file")
        return

    # Parse command line arguments
    lookback_minutes = 15  # Default lookback period
    continuous = '--continuous' in sys.argv

    # Check for custom lookback period
    for arg in sys.argv:
        if arg.startswith('--lookback='):
            try:
                lookback_minutes = int(arg.split('=')[1])
            except ValueError:
                print(f"Invalid lookback value: {arg}")
                return

    print("=" * 60)
    print("Tempest Weather Station REST API Client")
    print("=" * 60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Token: {TEMPEST_TOKEN[:10]}...")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Lookback period: {lookback_minutes} minutes")
    print(f"Mode: {'Continuous monitoring' if continuous else 'Single collection'}")
    print("=" * 60)

    client = TempestWeatherClient(lookback_minutes=lookback_minutes)

    if continuous:
        # Continuous mode - run every 5 minutes
        print("\nRunning in continuous mode (Ctrl+C to stop)")
        try:
            while True:
                client.collect_and_store()
                print(f"\nWaiting 5 minutes until next collection...")
                time.sleep(300)  # Wait 5 minutes
        except KeyboardInterrupt:
            print("\n\nShutting down...")
    else:
        # Single run mode - collect data and exit
        try:
            count = client.collect_and_store()
            if count > 0:
                print(f"\nSuccess! Collected {count} observations")
            else:
                print("\nNo new observations collected")
                sys.exit(1)
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()
