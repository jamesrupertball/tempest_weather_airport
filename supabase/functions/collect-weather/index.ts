// Supabase Edge Function to collect Tempest weather data
// This function is triggered by pg_cron every 1 minutes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TEMPEST_API_BASE = "https://swd.weatherflow.com/swd/rest"
const DEVICE_ID = 469455
const LOOKBACK_MINUTES = 15

interface TempestObservation {
  timestamp: string
  device_id: number
  wind_lull: number
  wind_avg: number
  wind_gust: number
  wind_direction: number
  wind_sample_interval: number
  pressure: number
  air_temperature: number
  relative_humidity: number
  illuminance: number
  uv_index: number
  solar_radiation: number
  rain_accumulation: number
  precipitation_type: number
  lightning_avg_distance: number
  lightning_strike_count: number
  battery: number
  report_interval: number
}

serve(async (req) => {
  try {
    // Get environment variables
    const tempestToken = Deno.env.get('TEMPEST_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!tempestToken || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables')
    }

    // Calculate time range
    const endTime = Math.floor(Date.now() / 1000)
    const startTime = endTime - (LOOKBACK_MINUTES * 60)

    console.log(`Fetching observations from ${new Date(startTime * 1000)} to ${new Date(endTime * 1000)}`)

    // Fetch data from Tempest API
    const tempestUrl = `${TEMPEST_API_BASE}/observations/device/${DEVICE_ID}?time_start=${startTime}&time_end=${endTime}`
    const tempestResponse = await fetch(tempestUrl, {
      headers: {
        'Authorization': `Bearer ${tempestToken}`
      }
    })

    if (!tempestResponse.ok) {
      throw new Error(`Tempest API error: ${tempestResponse.status} ${tempestResponse.statusText}`)
    }

    const tempestData = await tempestResponse.json()

    if (!tempestData.obs || tempestData.obs.length === 0) {
      console.log('No observations found in time range')
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No new observations',
          stored: 0,
          skipped: 0
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    let storedCount = 0
    let skippedCount = 0
    const deviceId = tempestData.device_id

    // Process each observation
    for (const obs of tempestData.obs) {
      // Tempest observation format (array indices):
      // [0] Epoch time, [1] Wind Lull, [2] Wind Avg, [3] Wind Gust,
      // [4] Wind Direction, [5] Wind Sample Interval, [6] Station Pressure,
      // [7] Air Temperature, [8] Relative Humidity, [9] Illuminance,
      // [10] UV, [11] Solar Radiation, [12] Rain accumulated,
      // [13] Precipitation Type, [14] Lightning Strike Avg Distance,
      // [15] Lightning Strike Count, [16] Battery, [17] Report Interval

      const record: TempestObservation = {
        timestamp: new Date(obs[0] * 1000).toISOString(),
        device_id: deviceId,
        wind_lull: obs[1],
        wind_avg: obs[2],
        wind_gust: obs[3],
        wind_direction: obs[4],
        wind_sample_interval: obs[5],
        pressure: obs[6],
        air_temperature: obs[7],
        relative_humidity: obs[8],
        illuminance: obs[9],
        uv_index: obs[10],
        solar_radiation: obs[11],
        rain_accumulation: obs[12],
        precipitation_type: obs[13],
        lightning_avg_distance: obs[14],
        lightning_strike_count: obs[15],
        battery: obs[16],
        report_interval: obs[17]
      }

      // Insert into Supabase (will skip duplicates due to UNIQUE constraint)
      const { error } = await supabase
        .from('observations_tempest')
        .insert(record)

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
          skippedCount++
        } else {
          console.error(`Error inserting observation at ${record.timestamp}:`, error.message)
          skippedCount++
        }
      } else {
        storedCount++
      }
    }

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      total_observations: tempestData.obs.length,
      stored: storedCount,
      skipped: skippedCount,
      time_range_minutes: LOOKBACK_MINUTES
    }

    console.log(`Completed: stored ${storedCount}, skipped ${skippedCount}`)

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in collect-weather function:', error)

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
