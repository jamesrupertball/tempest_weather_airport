// METAR Weather Display
// Fetches and displays METAR data for KFFM and KADC airports

const STATIONS = ['KFFM', 'KADC'];
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
const CACHE_KEY = 'metar_cache';

let refreshTimer = null;
let countdownTimer = null;
let nextRefreshTime = null;
let supabaseClient = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase client
    const { createClient } = supabase;
    supabaseClient = createClient(config.supabase.url, config.supabase.anonKey);

    // Try to load from cache first
    const cached = loadFromCache();
    if (cached) {
        console.log('Using cached METAR data');
        displayCachedData(cached.data);
        updateLastFetched(cached.timestamp);

        // Start auto-refresh with remaining time until next fetch
        const timeUntilRefresh = Math.max(0, (cached.timestamp + REFRESH_INTERVAL) - Date.now());
        startAutoRefresh(timeUntilRefresh);

        // If cache is stale, fetch fresh data in background
        if (timeUntilRefresh === 0) {
            fetchMetarData();
        }
    } else {
        console.log('No valid cache, fetching fresh data');
        fetchMetarData();
        startAutoRefresh();
    }

    // Manual refresh button
    document.getElementById('manualRefresh').addEventListener('click', () => {
        fetchMetarData();
        resetAutoRefresh();
    });
});

/**
 * Load METAR data from cache
 */
function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        // Only use cache if it's less than REFRESH_INTERVAL old
        if (age < REFRESH_INTERVAL) {
            return { data, timestamp };
        }

        // Cache is stale, remove it
        localStorage.removeItem(CACHE_KEY);
        return null;
    } catch (error) {
        console.error('Error loading cache:', error);
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
}

/**
 * Save METAR data to cache
 */
function saveToCache(data) {
    try {
        const cacheObject = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
        console.log('METAR data cached successfully');
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
}

/**
 * Display cached METAR data
 */
function displayCachedData(data) {
    if (Array.isArray(data) && data.length > 0) {
        data.forEach(metar => {
            displayMetar(metar);
        });
    }
}

/**
 * Fetch METAR data via Supabase Edge Function
 */
async function fetchMetarData() {
    try {
        const stationIds = STATIONS.join(',');
        console.log('Fetching METAR data for stations:', stationIds);

        // Call Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('fetch-metar', {
            body: { ids: stationIds }
        });

        if (error) {
            throw new Error(`Supabase function error: ${error.message}`);
        }

        console.log('METAR data received:', data);

        // Update display for each station
        if (Array.isArray(data) && data.length > 0) {
            // Save to cache
            saveToCache(data);

            data.forEach(metar => {
                displayMetar(metar);
            });
        } else {
            console.warn('No METAR data returned');
            displayError('No METAR data available');
        }

        // Update last fetched time
        updateLastFetched();

    } catch (error) {
        console.error('Error fetching METAR data:', error);
        displayError(error.message);
    }
}

/**
 * Display METAR data for a station
 */
function displayMetar(metar) {
    const stationId = metar.icaoId || metar.stationId;
    if (!stationId) {
        console.error('No station ID found in METAR data:', metar);
        return;
    }

    console.log('Displaying METAR for:', stationId, metar);

    const station = stationId.toLowerCase();

    // Raw METAR
    document.getElementById(`${station}-raw`).textContent = metar.rawOb || metar.rawText || 'No data';

    // Observation time
    const obsTime = formatObservationTime(metar.obsTime || metar.observationTime);
    document.getElementById(`${station}-obs-time`).innerHTML = obsTime;

    // Wind
    const wind = formatWind(metar);
    document.getElementById(`${station}-wind`).textContent = wind;

    // Visibility
    const visibility = formatVisibility(metar.visib || metar.visibility);
    document.getElementById(`${station}-visibility`).textContent = visibility;

    // Weather phenomena
    const wxString = metar.wxString || metar.presentWeather;
    const weather = decodeWeatherPhenomena(wxString);
    document.getElementById(`${station}-weather`).innerHTML = weather;

    // Clouds
    const clouds = formatClouds(metar.clouds || metar.skyConditions);
    document.getElementById(`${station}-clouds`).innerHTML = clouds;

    // Temperature
    const temp = formatTemperature(metar.temp || metar.temperature);
    document.getElementById(`${station}-temp`).textContent = temp;

    // Dewpoint
    const dewpoint = formatTemperature(metar.dewp || metar.dewpoint);
    document.getElementById(`${station}-dewpoint`).textContent = dewpoint;

    // Altimeter
    const altimeter = formatAltimeter(metar.altim || metar.altimeter);
    document.getElementById(`${station}-altimeter`).textContent = altimeter;

    // Flight category
    const flightCategory = calculateFlightCategory(metar);
    updateFlightCategoryBadge(station, flightCategory);
}

/**
 * Format observation time to UTC and Local
 */
function formatObservationTime(obsTime) {
    if (!obsTime) return '--';

    let date;
    if (typeof obsTime === 'number') {
        // Unix timestamp
        date = new Date(obsTime * 1000);
    } else {
        // ISO string
        date = new Date(obsTime);
    }

    if (isNaN(date.getTime())) return '--';

    const utc = date.toISOString().replace('T', ' ').substring(0, 16) + 'Z';
    const local = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    return `<div><strong>UTC:</strong> ${utc}</div><div><strong>Local:</strong> ${local}</div>`;
}

/**
 * Format wind information
 */
function formatWind(metar) {
    const wdir = metar.wdir || metar.windDir;
    const wspd = metar.wspd || metar.windSpeed;
    const wgst = metar.wgst || metar.windGust;

    if (!wdir && !wspd) return 'Calm';

    if (wspd === 0 || wdir === 0) return 'Calm';

    let windText = '';

    if (wdir === 'VRB' || wdir === 'VARIABLE') {
        windText = 'Variable';
    } else {
        const compass = windDirectionToCompass(wdir);
        windText = `${wdir}° (${compass})`;
    }

    windText += ` at ${wspd} kt`;

    if (wgst && wgst > wspd) {
        windText += ` gusting to ${wgst} kt`;
    }

    return windText;
}

/**
 * Convert wind direction in degrees to compass direction
 */
function windDirectionToCompass(degrees) {
    if (typeof degrees !== 'number') return '';

    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) / 22.5)) % 16;
    return directions[index];
}

/**
 * Format visibility
 */
function formatVisibility(visib) {
    if (visib === null || visib === undefined) return 'Not reported';

    if (typeof visib === 'string') {
        if (visib.includes('+') || visib === '10+') {
            return '10+ statute miles';
        }
        return `${visib} statute miles`;
    }

    if (visib >= 10) {
        return '10+ statute miles';
    }

    return `${visib} statute miles`;
}

/**
 * Decode weather phenomena codes
 */
function decodeWeatherPhenomena(wxString) {
    if (!wxString) return 'None reported';

    // Weather phenomenon decoders
    const intensityMap = {
        '-': 'Light',
        '+': 'Heavy',
        'VC': 'in Vicinity'
    };

    const descriptorMap = {
        'MI': 'Shallow',
        'PR': 'Partial',
        'BC': 'Patches of',
        'DR': 'Low Drifting',
        'BL': 'Blowing',
        'SH': 'Showers of',
        'TS': 'Thunderstorm with',
        'FZ': 'Freezing'
    };

    const precipitationMap = {
        'DZ': 'Drizzle',
        'RA': 'Rain',
        'SN': 'Snow',
        'SG': 'Snow Grains',
        'IC': 'Ice Crystals',
        'PL': 'Ice Pellets',
        'GR': 'Hail',
        'GS': 'Snow Pellets',
        'UP': 'Unknown Precipitation'
    };

    const obscurationMap = {
        'BR': 'Mist',
        'FG': 'Fog',
        'FU': 'Smoke',
        'VA': 'Volcanic Ash',
        'DU': 'Widespread Dust',
        'SA': 'Sand',
        'HZ': 'Haze',
        'PY': 'Spray'
    };

    const otherMap = {
        'PO': 'Dust/Sand Whirls',
        'SQ': 'Squalls',
        'FC': 'Funnel Cloud',
        'SS': 'Sandstorm',
        'DS': 'Dust Storm'
    };

    // Combine all phenomena types
    const allPhenomena = {
        ...precipitationMap,
        ...obscurationMap,
        ...otherMap
    };

    // Split multiple weather groups (space-separated)
    const weatherGroups = wxString.trim().split(/\s+/);
    const decoded = [];

    weatherGroups.forEach(group => {
        let description = [];
        let remaining = group;

        // Check for intensity
        if (remaining.startsWith('-')) {
            description.push(intensityMap['-']);
            remaining = remaining.substring(1);
        } else if (remaining.startsWith('+')) {
            description.push(intensityMap['+']);
            remaining = remaining.substring(1);
        } else if (remaining.startsWith('VC')) {
            description.push(intensityMap['VC']);
            remaining = remaining.substring(2);
        }

        // Check for descriptor (2 characters)
        const descriptor = remaining.substring(0, 2);
        if (descriptorMap[descriptor]) {
            description.push(descriptorMap[descriptor]);
            remaining = remaining.substring(2);
        }

        // Parse remaining phenomena (can be multiple 2-char codes)
        while (remaining.length >= 2) {
            const phenomenon = remaining.substring(0, 2);
            if (allPhenomena[phenomenon]) {
                description.push(allPhenomena[phenomenon]);
                remaining = remaining.substring(2);
            } else {
                // Unknown code, include as-is
                description.push(remaining);
                break;
            }
        }

        // If there's anything left over, add it
        if (remaining.length > 0 && description.length === 0) {
            description.push(remaining);
        }

        decoded.push(description.join(' '));
    });

    const decodedText = decoded.join(', ');

    // Return both code and decoded text
    return `<strong>${wxString}</strong> - ${decodedText}`;
}

/**
 * Format cloud layers
 */
function formatClouds(clouds) {
    if (!clouds || clouds.length === 0) return 'Clear';

    const coverageMap = {
        'CLR': 'Clear',
        'SKC': 'Sky Clear',
        'FEW': 'Few',
        'SCT': 'Scattered',
        'BKN': 'Broken',
        'OVC': 'Overcast',
        'VV': 'Vertical Visibility'
    };

    const cloudLayers = clouds.map(layer => {
        const coverage = coverageMap[layer.cover] || layer.cover;
        const base = layer.base;

        if (base !== null && base !== undefined) {
            return `${coverage} at ${base.toLocaleString()} ft`;
        }
        return coverage;
    });

    return cloudLayers.join('<br>');
}

/**
 * Format temperature (convert Celsius to Fahrenheit)
 */
function formatTemperature(tempC) {
    if (tempC === null || tempC === undefined) return 'Not reported';

    // Normalize -0 to 0 (JavaScript has both +0 and -0)
    // M00 in METAR means 0°C, not "minus zero"
    if (Object.is(tempC, -0)) {
        tempC = 0;
    }

    const tempF = (tempC * 9/5) + 32;
    return `${tempC.toFixed(1)}°C (${tempF.toFixed(1)}°F)`;
}

/**
 * Format altimeter setting
 */
function formatAltimeter(altim) {
    if (altim === null || altim === undefined) return 'Not reported';

    // Convert from hPa to inHg if needed
    let inHg = altim;
    if (altim > 100) {
        // Likely in hPa, convert to inHg
        inHg = altim * 0.02953;
    }

    return `${inHg.toFixed(2)} inHg`;
}

/**
 * Calculate flight category based on ceiling and visibility
 */
function calculateFlightCategory(metar) {
    const visibility = parseFloat(metar.visib || metar.visibility);
    const clouds = metar.clouds || metar.skyConditions || [];

    // Find lowest ceiling (BKN or OVC)
    let ceiling = null;
    for (const layer of clouds) {
        const cover = layer.cover;
        if (cover === 'BKN' || cover === 'OVC' || cover === 'VV') {
            const base = layer.base;
            if (base !== null && base !== undefined) {
                if (ceiling === null || base < ceiling) {
                    ceiling = base;
                }
            }
        }
    }

    // Determine category
    // LIFR: ceiling < 500 OR visibility < 1
    if ((ceiling !== null && ceiling < 500) || visibility < 1) {
        return 'LIFR';
    }

    // IFR: ceiling 500-999 OR visibility 1-2.9
    if ((ceiling !== null && ceiling >= 500 && ceiling < 1000) ||
        (visibility >= 1 && visibility < 3)) {
        return 'IFR';
    }

    // MVFR: ceiling 1000-3000 OR visibility 3-5
    if ((ceiling !== null && ceiling >= 1000 && ceiling <= 3000) ||
        (visibility >= 3 && visibility <= 5)) {
        return 'MVFR';
    }

    // VFR: ceiling > 3000 AND visibility > 5
    return 'VFR';
}

/**
 * Update flight category badge with appropriate color
 */
function updateFlightCategoryBadge(station, category) {
    const badge = document.getElementById(`${station}-flight-category`);
    if (!badge) return;

    // Remove all category classes
    badge.classList.remove('vfr', 'mvfr', 'ifr', 'lifr');

    // Add appropriate class
    badge.classList.add(category.toLowerCase());

    // Update text
    badge.querySelector('.category-text').textContent = category;
}

/**
 * Update last fetched timestamp
 */
function updateLastFetched(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastFetched').textContent = timeString;
}

/**
 * Display error message
 */
function displayError(message) {
    console.error('METAR Error:', message);

    // Display error in both station cards
    STATIONS.forEach(station => {
        const stationId = station.toLowerCase();
        const rawElement = document.getElementById(`${stationId}-raw`);
        if (rawElement) {
            rawElement.textContent = `Error loading METAR: ${message}`;
            rawElement.style.color = '#ff0000';
        }
    });
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh(initialDelay = REFRESH_INTERVAL) {
    nextRefreshTime = Date.now() + initialDelay;

    // Main refresh timer - use setTimeout for first refresh if delay is custom
    if (initialDelay !== REFRESH_INTERVAL) {
        // Schedule first refresh at custom time
        refreshTimer = setTimeout(() => {
            fetchMetarData();
            nextRefreshTime = Date.now() + REFRESH_INTERVAL;

            // Then switch to regular interval
            refreshTimer = setInterval(() => {
                fetchMetarData();
                nextRefreshTime = Date.now() + REFRESH_INTERVAL;
            }, REFRESH_INTERVAL);
        }, initialDelay);
    } else {
        // Normal interval from the start
        refreshTimer = setInterval(() => {
            fetchMetarData();
            nextRefreshTime = Date.now() + REFRESH_INTERVAL;
        }, REFRESH_INTERVAL);
    }

    // Countdown timer
    startCountdown();
}

/**
 * Reset auto-refresh timer (after manual refresh)
 */
function resetAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);

    startAutoRefresh();
}

/**
 * Start countdown display
 */
function startCountdown() {
    updateCountdownDisplay();

    countdownTimer = setInterval(() => {
        updateCountdownDisplay();
    }, 1000);
}

/**
 * Update countdown display
 */
function updateCountdownDisplay() {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((nextRefreshTime - now) / 1000));

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('refreshCountdown').textContent = display;
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);
});
