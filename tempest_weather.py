#!/usr/bin/env python3
"""
Tempest Weather Station WebSocket Client
Fetches real-time weather data from Tempest API and stores it in Supabase
"""

import os
import json
import asyncio
import websockets
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

TEMPEST_TOKEN = os.getenv('TEMPEST_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Tempest WebSocket endpoint
TEMPEST_WS_URL = "wss://ws.weatherflow.com/swd/data"


class TempestWeatherClient:
    def __init__(self, run_once=False):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.device_id = None
        self.run_once = run_once
        self.data_received = False

    async def connect_and_listen(self):
        """Connect to Tempest WebSocket API and listen for weather data"""
        # Connect with authorization token in URL parameters
        ws_url_with_auth = f"{TEMPEST_WS_URL}?token={TEMPEST_TOKEN}"
        async with websockets.connect(ws_url_with_auth) as websocket:
            # Subscribe to weather data using your token
            subscribe_message = {
                "type": "listen_start",
                "device_id": 469455,  # Tempest station device ID
                "id": "tempest-listener"
            }

            await websocket.send(json.dumps(subscribe_message))
            print(f"Connected to Tempest WebSocket API at {datetime.now()}")
            print("Waiting for weather data...")

            try:
                async for message in websocket:
                    data = json.loads(message)
                    await self.process_message(data)

                    # If run_once mode and we've received data, exit
                    if self.run_once and self.data_received:
                        print(f"Data collected successfully. Exiting.")
                        return
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed. Reconnecting...")
                await asyncio.sleep(5)
                await self.connect_and_listen()

    async def process_message(self, data):
        """Process incoming WebSocket messages"""
        msg_type = data.get('type')

        print(f"\n[{datetime.now()}] Received: {msg_type}")

        if msg_type == 'obs_st':
            # Tempest observation data
            await self.store_tempest_observation(data)
        elif msg_type == 'obs_air':
            # AIR observation data (for older devices)
            await self.store_air_observation(data)
        elif msg_type == 'obs_sky':
            # SKY observation data (for older devices)
            await self.store_sky_observation(data)
        elif msg_type == 'rapid_wind':
            # Rapid wind updates
            await self.store_rapid_wind(data)
        elif msg_type == 'evt_precip':
            # Precipitation event
            await self.store_precipitation_event(data)
        elif msg_type == 'evt_strike':
            # Lightning strike event
            await self.store_lightning_strike(data)
        elif msg_type == 'device_status':
            # Device status update
            print(f"Device status: {json.dumps(data, indent=2)}")
        elif msg_type == 'hub_status':
            # Hub status update
            print(f"Hub status: {json.dumps(data, indent=2)}")
        else:
            print(f"Unknown message type: {json.dumps(data, indent=2)}")

    async def store_tempest_observation(self, data):
        """Store Tempest observation in Supabase"""
        try:
            obs = data.get('obs', [[]])[0]  # Get first observation
            device_id = data.get('device_id')
            serial_number = data.get('serial_number')

            if not obs:
                return

            # Tempest observation format:
            # [0] Epoch time, [1] Wind Lull, [2] Wind Avg, [3] Wind Gust,
            # [4] Wind Direction, [5] Wind Sample Interval, [6] Station Pressure,
            # [7] Air Temperature, [8] Relative Humidity, [9] Illuminance,
            # [10] UV, [11] Solar Radiation, [12] Rain accumulated,
            # [13] Precipitation Type, [14] Lightning Strike Avg Distance,
            # [15] Lightning Strike Count, [16] Battery, [17] Report Interval

            record = {
                'timestamp': datetime.fromtimestamp(obs[0]).isoformat(),
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

            # Store in Supabase using your existing table name
            result = self.supabase.table('observations_tempest').insert(record).execute()
            print(f"Stored observation: Temp={obs[7]}C, Humidity={obs[8]}%, Wind={obs[2]}m/s")
            self.data_received = True

        except Exception as e:
            print(f"Error storing Tempest observation: {e}")
            print(f"Data: {json.dumps(data, indent=2)}")

    async def store_rapid_wind(self, data):
        """Store rapid wind data - generates data every 3 seconds"""
        try:
            obs = data.get('ob', [])
            device_id = data.get('device_id')

            if not obs:
                return

            # Rapid wind format: [epoch, wind_speed, wind_direction]
            # Note: This generates a LOT of data (every 3 seconds)

            record = {
                'timestamp': datetime.fromtimestamp(obs[0]).isoformat(),
                'device_id': device_id,
                'wind_speed': obs[1],
                'wind_direction': obs[2]
            }

            result = self.supabase.table('rapid_wind').insert(record).execute()
            print(f"Rapid wind: Speed={obs[1]}m/s, Direction={obs[2]}deg")

        except Exception as e:
            print(f"Error storing rapid wind: {e}")
            print(f"Data: {json.dumps(data, indent=2)}")

    async def store_precipitation_event(self, data):
        """Store precipitation event"""
        try:
            record = {
                'timestamp': datetime.fromtimestamp(data.get('evt', [0])[0]).isoformat(),
                'device_id': data.get('device_id'),
                'serial_number': data.get('serial_number')
            }

            result = self.supabase.table('precipitation_events').insert(record).execute()
            print(f"Precipitation event recorded")

        except Exception as e:
            print(f"Error storing precipitation event: {e}")

    async def store_lightning_strike(self, data):
        """Store lightning strike event"""
        try:
            evt = data.get('evt', [])

            record = {
                'timestamp': datetime.fromtimestamp(evt[0]).isoformat(),
                'device_id': data.get('device_id'),
                'serial_number': data.get('serial_number'),
                'distance': evt[1],
                'energy': evt[2]
            }

            result = self.supabase.table('lightning_strikes').insert(record).execute()
            print(f"Lightning strike: Distance={evt[1]}km, Energy={evt[2]}")

        except Exception as e:
            print(f"Error storing lightning strike: {e}")

    async def store_air_observation(self, data):
        """Store AIR observation (for legacy WeatherFlow devices)"""
        try:
            obs = data.get('obs', [[]])[0]

            # AIR format: [epoch, station_pressure, air_temperature,
            #              relative_humidity, lightning_strike_count,
            #              lightning_avg_distance, battery, report_interval]

            record = {
                'timestamp': datetime.fromtimestamp(obs[0]).isoformat(),
                'device_id': data.get('device_id'),
                'serial_number': data.get('serial_number'),
                'station_pressure': obs[1],
                'air_temperature': obs[2],
                'relative_humidity': obs[3],
                'lightning_strike_count': obs[4],
                'lightning_avg_distance': obs[5],
                'battery': obs[6],
                'report_interval': obs[7]
            }

            result = self.supabase.table('air_observations').insert(record).execute()
            print(f"Stored AIR observation")

        except Exception as e:
            print(f"Error storing AIR observation: {e}")

    async def store_sky_observation(self, data):
        """Store SKY observation (for legacy WeatherFlow devices)"""
        try:
            obs = data.get('obs', [[]])[0]

            # SKY format: [epoch, illuminance, uv, rain_accumulated,
            #              wind_lull, wind_avg, wind_gust, wind_direction,
            #              battery, report_interval, solar_radiation,
            #              local_day_rain_accumulation, precipitation_type,
            #              wind_sample_interval]

            record = {
                'timestamp': datetime.fromtimestamp(obs[0]).isoformat(),
                'device_id': data.get('device_id'),
                'serial_number': data.get('serial_number'),
                'illuminance': obs[1],
                'uv': obs[2],
                'rain_accumulated': obs[3],
                'wind_lull': obs[4],
                'wind_avg': obs[5],
                'wind_gust': obs[6],
                'wind_direction': obs[7],
                'battery': obs[8],
                'report_interval': obs[9],
                'solar_radiation': obs[10],
                'local_day_rain_accumulation': obs[11],
                'precipitation_type': obs[12],
                'wind_sample_interval': obs[13]
            }

            result = self.supabase.table('sky_observations').insert(record).execute()
            print(f"Stored SKY observation")

        except Exception as e:
            print(f"Error storing SKY observation: {e}")


async def main():
    """Main entry point"""
    import sys

    # Validate environment variables
    if not TEMPEST_TOKEN:
        print("ERROR: TEMPEST_TOKEN not found in .env file")
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env file")
        return

    # Check if --once flag is passed
    run_once = '--once' in sys.argv

    print("=" * 60)
    print("Tempest Weather Station WebSocket Client")
    print("=" * 60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Token: {TEMPEST_TOKEN[:10]}...")
    print(f"Mode: {'Single collection' if run_once else 'Continuous monitoring'}")
    print("=" * 60)

    client = TempestWeatherClient(run_once=run_once)

    if run_once:
        # Single run mode - collect data and exit
        try:
            await asyncio.wait_for(client.connect_and_listen(), timeout=120)
        except asyncio.TimeoutError:
            print("Timeout waiting for data. Exiting.")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        # Run with automatic reconnection
        while True:
            try:
                await client.connect_and_listen()
            except Exception as e:
                print(f"Error: {e}")
                print("Reconnecting in 10 seconds...")
                await asyncio.sleep(10)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nShutting down...")
