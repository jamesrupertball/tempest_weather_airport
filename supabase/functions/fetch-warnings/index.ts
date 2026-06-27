// Supabase Edge Function to fetch SIGMET and G-AIRMET warning data
// Proxies requests to Aviation Weather API to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AWC_BASE = 'https://aviationweather.gov/api/data'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchJson(url: string): Promise<unknown[]> {
  const res = await fetch(url)
  if (res.status === 204) return []
  if (!res.ok) throw new Error(`AWC API error ${res.status} for ${url}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Fetching SIGMET and G-AIRMET data from AWC...')

    const [airsigmets, gSierra, gTango, gZulu] = await Promise.all([
      fetchJson(`${AWC_BASE}/airsigmet?format=json`),
      fetchJson(`${AWC_BASE}/gairmet?format=json&product=sierra`),
      fetchJson(`${AWC_BASE}/gairmet?format=json&product=tango`),
      fetchJson(`${AWC_BASE}/gairmet?format=json&product=zulu`),
    ])

    const gairmets = [...gSierra, ...gTango, ...gZulu]

    console.log(`Fetched ${airsigmets.length} SIGMETs, ${gairmets.length} G-AIRMETs`)

    return new Response(
      JSON.stringify({ airsigmets, gairmets }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error) {
    console.error('Error fetching warnings:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        message: 'Failed to fetch warnings data',
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
