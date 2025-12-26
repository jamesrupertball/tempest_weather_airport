// Supabase Edge Function to fetch METAR data
// Proxies requests to Aviation Weather API to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AVIATION_WEATHER_API = 'https://aviationweather.gov/api/data/metar'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get station IDs from query parameter or request body
    const url = new URL(req.url)
    let stations = url.searchParams.get('ids')

    // If not in query params, try request body
    if (!stations) {
      try {
        const body = await req.json()
        stations = body.ids || 'KFFM,KADC'
      } catch {
        stations = 'KFFM,KADC'
      }
    }

    console.log('Fetching METAR for stations:', stations)

    // Fetch from Aviation Weather API
    const aviationWeatherUrl = `${AVIATION_WEATHER_API}?ids=${stations}&format=json`
    const response = await fetch(aviationWeatherUrl)

    if (!response.ok) {
      throw new Error(`Aviation Weather API error: ${response.status}`)
    }

    const data = await response.json()

    console.log(`Successfully fetched METAR data for ${stations}`)

    // Return the data with CORS headers
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error) {
    console.error('Error fetching METAR:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        message: 'Failed to fetch METAR data'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
