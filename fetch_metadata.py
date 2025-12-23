#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch device and station metadata from Tempest REST API
and populate Supabase tables (one-time setup)
"""

import os
import sys
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv()

TEMPEST_TOKEN = os.getenv('TEMPEST_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Tempest REST API endpoint
TEMPEST_API_URL = "https://swd.weatherflow.com/swd/rest"


def fetch_stations():
    """Fetch all stations associated with the API token"""
    headers = {
        'Authorization': f'Bearer {TEMPEST_TOKEN}'
    }

    response = requests.get(f"{TEMPEST_API_URL}/stations", headers=headers)
    response.raise_for_status()

    return response.json()


def populate_supabase(data):
    """Populate Supabase stations and devices tables"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    stations = data.get('stations', [])

    print(f"\nFound {len(stations)} station(s)")

    for station in stations:
        station_id = station.get('station_id')

        # Prepare station record
        station_meta = station.get('station_meta', {})
        station_record = {
            'station_id': station_id,
            'name': station.get('name'),
            'latitude': station.get('latitude'),
            'longitude': station.get('longitude'),
            'timezone': station.get('timezone'),
            'public_name': station.get('public_name'),
            'elevation': station_meta.get('elevation'),
            'share_with_wf': station_meta.get('share_with_wf'),
            'share_with_wu': station_meta.get('share_with_wu'),
        }

        print(f"\n{'='*60}")
        print(f"Station: {station.get('name')} (ID: {station_id})")
        print(f"Location: {station.get('latitude')}, {station.get('longitude')}")
        print(f"Timezone: {station.get('timezone')}")
        print(f"Elevation: {station_meta.get('elevation')}m")

        # Insert or update station
        try:
            result = supabase.table('stations').upsert(station_record, on_conflict='station_id').execute()
            print(f"✓ Station record stored/updated")
        except Exception as e:
            print(f"✗ Error storing station: {e}")

        # Process devices
        devices = station.get('devices', [])
        print(f"\nFound {len(devices)} device(s) for this station:")

        for device in devices:
            device_id = device.get('device_id')
            device_type = device.get('device_type')
            serial_number = device.get('serial_number')

            # Prepare device record
            device_meta = device.get('device_meta', {})
            device_record = {
                'device_id': device_id,
                'station_id': station_id,
                'serial_number': serial_number,
                'device_type': device_type,
                'hardware_revision': device.get('hardware_revision'),
                'firmware_revision': device.get('firmware_revision'),
                'agl': device_meta.get('agl'),
                'device_name': device_meta.get('name'),
                'environment': device_meta.get('environment'),
                'wifi_network_name': device_meta.get('wifi_network_name'),
            }

            print(f"  - {device_type} (Serial: {serial_number}, ID: {device_id})")
            print(f"    Hardware: {device.get('hardware_revision')}, Firmware: {device.get('firmware_revision')}")
            if device_meta.get('name'):
                print(f"    Name: {device_meta.get('name')}")
            if device_meta.get('agl'):
                print(f"    Height AGL: {device_meta.get('agl')}m")
            if device_meta.get('environment'):
                print(f"    Environment: {device_meta.get('environment')}")

            # Insert or update device
            try:
                result = supabase.table('devices').upsert(device_record, on_conflict='device_id').execute()
                print(f"    ✓ Device record stored/updated")
            except Exception as e:
                print(f"    ✗ Error storing device: {e}")

    print(f"\n{'='*60}")
    print("Metadata sync completed!")


def main():
    """Main entry point"""
    # Validate environment variables
    if not TEMPEST_TOKEN:
        print("ERROR: TEMPEST_TOKEN not found in .env file")
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env file")
        return

    print("=" * 60)
    print("Tempest Metadata Fetcher")
    print("=" * 60)
    print("Fetching station and device information from Tempest API...")

    try:
        # Fetch data from Tempest API
        data = fetch_stations()

        # Populate Supabase
        populate_supabase(data)

    except requests.exceptions.HTTPError as e:
        print(f"\nHTTP Error: {e}")
        print(f"Response: {e.response.text}")
    except Exception as e:
        print(f"\nError: {e}")


if __name__ == "__main__":
    main()
