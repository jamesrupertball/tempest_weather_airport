#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Get Supabase database schema information
Uses environment variables for credentials (no hardcoded secrets)
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')


def get_table_info(supabase, table_name):
    """Get information about a specific table"""
    try:
        # Get one row to see the structure
        result = supabase.table(table_name).select('*').limit(1).execute()

        print(f"\n{'='*60}")
        print(f"Table: {table_name}")
        print(f"{'='*60}")

        if result.data and len(result.data) > 0:
            print("\nColumns:")
            for column, value in result.data[0].items():
                value_type = type(value).__name__ if value is not None else 'null'
                print(f"  - {column}: {value_type}")

            print(f"\nSample data:")
            for column, value in result.data[0].items():
                # Truncate long values
                display_value = str(value)[:50] + '...' if len(str(value)) > 50 else value
                print(f"  {column}: {display_value}")

            print(f"\nTotal columns: {len(result.data[0])}")
        else:
            print("  Table exists but is empty (no data to infer schema)")

        return True

    except Exception as e:
        print(f"  Error accessing table: {e}")
        return False


def list_all_tables(supabase):
    """List all accessible tables by trying common ones"""
    # Common tables in your project based on README
    common_tables = [
        'observations_tempest',
        'rapid_wind',
        'precipitation_events',
        'lightning_strikes',
        'air_observations',
        'sky_observations',
        'stations',
        'devices'
    ]

    print("\n" + "="*60)
    print("Checking for tables in Supabase...")
    print("="*60)

    found_tables = []

    for table in common_tables:
        try:
            result = supabase.table(table).select('*').limit(0).execute()
            found_tables.append(table)
            print(f"  [OK] {table}")
        except Exception as e:
            print(f"  [--] {table} - {str(e)[:50]}")

    return found_tables


def main():
    """Main entry point"""
    # Validate environment variables
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env file")
        return

    print("="*60)
    print("Supabase Schema Inspector")
    print("="*60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print("="*60)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # List all tables
    found_tables = list_all_tables(supabase)

    if not found_tables:
        print("\nNo tables found. Check your Supabase configuration.")
        return

    # Get detailed info for each found table
    print("\n" + "="*60)
    print("Detailed Table Information")
    print("="*60)

    for table in found_tables:
        get_table_info(supabase, table)

    print("\n" + "="*60)
    print(f"Summary: Found {len(found_tables)} tables")
    print("="*60)


if __name__ == "__main__":
    main()