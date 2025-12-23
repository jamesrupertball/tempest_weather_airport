#!/usr/bin/env python3
"""Check devices in Supabase"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Query devices table
result = supabase.table('devices').select('*').execute()

print("Devices in Supabase:")
print("=" * 60)
for device in result.data:
    print(f"Device ID: {device.get('device_id')}")
    print(f"Serial Number: {device.get('serial_number')}")
    print(f"Type: {device.get('device_type')}")
    print(f"Name: {device.get('name')}")
    print("-" * 60)
