/**
 * 00MN Weather Dashboard
 * Mobile-first pilot weather display with runway wind components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configuration is now loaded from config.js
// This keeps sensitive credentials out of the main application code
// See config.example.js for setup instructions

// Verify config is loaded
if (typeof window.config === 'undefined') {
    console.error('FATAL ERROR: config.js did not load properly. Check that config.js exists and is accessible.');
    alert('Configuration Error: config.js failed to load. Please check the browser console for details.');
    throw new Error('config.js not loaded');
}

// Use window.config to ensure we're reading from global scope
const config = window.config;

// Extract configuration values
const SUPABASE_URL = config.supabase.url;
const SUPABASE_ANON_KEY = config.supabase.anonKey;
const RUNWAYS = config.runways;
const REFRESH_INTERVAL = config.refreshInterval;
const FIELD_ELEVATION = config.fieldElevation;

// NWS API configuration
const NWS_USER_AGENT = config.nws.userAgent;
const NWS_LAT = config.nws.location.lat;
const NWS_LON = config.nws.location.lon;
const NWS_GRID_OFFICE = config.nws.grid.office;
const NWS_GRID_X = config.nws.grid.x;
const NWS_GRID_Y = config.nws.grid.y;

// ============================================================================
// INITIALIZATION
// ============================================================================

let supabaseClient;
let refreshTimer;
let countdownTimer;
let warningsRefreshTimer;

const WARNINGS_REFRESH_INTERVAL = 600000; // 10 minutes

// NWS forecast state
let currentMode = 'live'; // 'live' or 'forecast'
let selectedForecastHours = 0; // 0, 3, 6, or 9
let liveData = null;
let forecastData = null;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    initializeApp();
    console.log('Setting up view toggle...');
    setupViewToggle();
    console.log('Setting up data source toggle...');
    setupDataSourceToggle();
    console.log('Setting up forecast tabs...');
    setupForecastTabs();
    console.log('Initialization complete');
});

// ============================================================================
// COMPASS UTILITIES
// ============================================================================

function compassDirectionName(deg) {
    const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return names[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function initCompass() {
    const ticksGroup = document.getElementById('compassTicks');
    if (!ticksGroup) return;
    const cx = 50, cy = 50, R = 50;
    let html = '';
    for (let d = 0; d < 360; d += 5) {
        const isMajor = d % 10 === 0;
        const isLabel = d % 30 === 0;
        const a = (d - 90) * Math.PI / 180;
        const rOuter = R - 2;
        const rInner = isMajor ? R - 5.5 : R - 3.5;
        const x1 = (cx + rOuter * Math.cos(a)).toFixed(2);
        const y1 = (cy + rOuter * Math.sin(a)).toFixed(2);
        const x2 = (cx + rInner * Math.cos(a)).toFixed(2);
        const y2 = (cy + rInner * Math.sin(a)).toFixed(2);
        html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.85)" stroke-width="${isMajor ? 0.45 : 0.22}" stroke-linecap="round"/>`;
        if (isLabel) {
            const rText = R - 9;
            const lx = (cx + rText * Math.cos(a)).toFixed(2);
            const ly = (cy + rText * Math.sin(a)).toFixed(2);
            const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10).padStart(2, '0');
            const isCard = label.length === 1;
            html += `<text x="${lx}" y="${ly}" fill="rgba(255,255,255,0.92)" font-size="${isCard ? 6.5 : 3.6}" font-family="'Space Grotesk',system-ui,sans-serif" font-weight="${isCard ? 600 : 500}" text-anchor="middle" dominant-baseline="central" transform="rotate(${d} ${lx} ${ly})">${label}</text>`;
        }
    }
    ticksGroup.innerHTML = html;
    setupInfoSheets();
}

function setupInfoSheets() {
    function bindInfoSheet(btnId, sheetId, closeId, backdropId) {
        const btn = document.getElementById(btnId);
        const sheet = document.getElementById(sheetId);
        const closeBtn = document.getElementById(closeId);
        const backdrop = document.getElementById(backdropId);
        if (btn && sheet) {
            btn.addEventListener('click', () => sheet.removeAttribute('hidden'));
        }
        if (closeBtn && sheet) {
            closeBtn.addEventListener('click', () => sheet.setAttribute('hidden', ''));
        }
        if (backdrop && sheet) {
            backdrop.addEventListener('click', () => sheet.setAttribute('hidden', ''));
        }
    }
    bindInfoSheet('windInfoBtn', 'windInfoSheet', 'windInfoClose', 'windInfoBackdrop');
    bindInfoSheet('rwyInfoBtn', 'rwyInfoSheet', 'rwyInfoClose', 'rwyInfoBackdrop');
}

function initializeApp() {
    console.log('Initializing 00MN Weather Dashboard...');

    // Initialize Supabase client
    try {
        // The UMD bundle exposes the supabase object globally
        const { createClient } = window.supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        alert('Configuration Error - Check Supabase credentials');
        return;
    }

    // Initialize compass
    initCompass();

    // Fetch initial data
    fetchWeatherData();

    // Fetch forecast data
    fetchForecastData();

    // Fetch warnings data (background — shown when Warnings tab is opened)
    fetchWarningsData();

    // Set up auto-refresh
    startAutoRefresh();
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchWeatherData() {
    console.log('Fetching weather data...');

    try {
        // Query the latest observation from Supabase
        // Order by timestamp descending and get the most recent record
        const { data, error } = await supabaseClient
            .from('observations_tempest')
            .select('wind_avg, wind_gust, wind_direction, timestamp, air_temperature, pressure, relative_humidity')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('No weather data available');
        }

        // Process and display the weather data
        const observation = data[0];
        displayWeatherData(observation);
        console.log('Data updated successfully');

    } catch (error) {
        console.error('Error fetching weather data:', error);
        alert(`Error fetching weather data: ${error.message}`);
    }
}

async function fetchForecastData() {
    console.log('Fetching NWS forecast data...');

    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.add('active');

    try {
        // Fetch hourly forecast from NWS
        const forecastUrl = `https://api.weather.gov/gridpoints/${NWS_GRID_OFFICE}/${NWS_GRID_X},${NWS_GRID_Y}/forecast/hourly`;

        const response = await fetch(forecastUrl, {
            headers: {
                'User-Agent': NWS_USER_AGENT
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const periods = data.properties.periods;

        // Store forecast data in a format we can use
        forecastData = {
            periods: periods.map(period => ({
                timestamp: new Date(period.startTime),
                windSpeed: period.windSpeed,
                windDirection: period.windDirection,
                temperature: period.temperature,
                relativeHumidity: period.relativeHumidity?.value || 0,
                dewpoint: period.dewpoint?.value || 0,
                shortForecast: period.shortForecast
            }))
        };

        console.log('NWS forecast data fetched:', forecastData.periods.length, 'periods');

        // Update forecast time labels
        updateForecastTimeLabels();

    } catch (error) {
        console.error('Error fetching NWS forecast data:', error);
        // Don't alert for forecast errors - just log them
    } finally {
        if (loadingIndicator) loadingIndicator.classList.remove('active');
    }
}

// ============================================================================
// DATA SOURCE TOGGLE
// ============================================================================

function setupDataSourceToggle() {
    const toggleLive = document.getElementById('toggleLive');
    const toggleForecast = document.getElementById('toggleForecast');
    const toggleLiveWeather = document.getElementById('toggleLiveWeather');
    const toggleForecastWeather = document.getElementById('toggleForecastWeather');

    if (toggleLive) {
        toggleLive.addEventListener('click', () => setMode('live'));
    }

    if (toggleForecast) {
        toggleForecast.addEventListener('click', () => setMode('forecast'));
    }

    if (toggleLiveWeather) {
        toggleLiveWeather.addEventListener('click', () => setMode('live'));
    }

    if (toggleForecastWeather) {
        toggleForecastWeather.addEventListener('click', () => setMode('forecast'));
    }
}

function setMode(mode) {
    currentMode = mode;

    // Update button states for both wind and weather sections
    const toggleLive = document.getElementById('toggleLive');
    const toggleForecast = document.getElementById('toggleForecast');
    const toggleLiveWeather = document.getElementById('toggleLiveWeather');
    const toggleForecastWeather = document.getElementById('toggleForecastWeather');

    if (toggleLive) toggleLive.classList.toggle('active', mode === 'live');
    if (toggleForecast) toggleForecast.classList.toggle('active', mode === 'forecast');
    if (toggleLiveWeather) toggleLiveWeather.classList.toggle('active', mode === 'live');
    if (toggleForecastWeather) toggleForecastWeather.classList.toggle('active', mode === 'forecast');

    // Update indicators for both sections
    const indicator = document.getElementById('dataSourceIndicator');
    const indicatorWeather = document.getElementById('dataSourceIndicatorWeather');

    [indicator, indicatorWeather].forEach(ind => {
        if (ind) {
            if (mode === 'live') {
                ind.textContent = 'Live';
                ind.classList.remove('forecast');
            } else {
                ind.textContent = 'Forecast';
                ind.classList.add('forecast');
            }
        }
    });

    // Show/hide forecast selectors for both sections
    const forecastSelector = document.getElementById('forecastSelector');
    const forecastTimeDisplay = document.getElementById('forecastTimeDisplay');
    const forecastSelectorWeather = document.getElementById('forecastSelectorWeather');
    const forecastTimeDisplayWeather = document.getElementById('forecastTimeDisplayWeather');

    if (forecastSelector) forecastSelector.classList.toggle('active', mode === 'forecast');
    if (forecastTimeDisplay) forecastTimeDisplay.classList.toggle('active', mode === 'forecast');
    if (forecastSelectorWeather) forecastSelectorWeather.classList.toggle('active', mode === 'forecast');
    if (forecastTimeDisplayWeather) forecastTimeDisplayWeather.classList.toggle('active', mode === 'forecast');

    // Update display
    updateWindDisplay();
}

function setupForecastTabs() {
    const tabs = document.querySelectorAll('.forecast-tab');
    const tabsWeather = document.querySelectorAll('.forecast-tab-weather');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const hours = parseInt(tab.dataset.hours);
            selectForecastTime(hours);
        });
    });

    tabsWeather.forEach(tab => {
        tab.addEventListener('click', () => {
            const hours = parseInt(tab.dataset.hours);
            selectForecastTime(hours);
        });
    });
}

function selectForecastTime(hours) {
    selectedForecastHours = hours;

    // Update tab states for both sections
    const tabs = document.querySelectorAll('.forecast-tab');
    const tabsWeather = document.querySelectorAll('.forecast-tab-weather');

    tabs.forEach(tab => {
        const tabHours = parseInt(tab.dataset.hours);
        tab.classList.toggle('active', tabHours === hours);
    });

    tabsWeather.forEach(tab => {
        const tabHours = parseInt(tab.dataset.hours);
        tab.classList.toggle('active', tabHours === hours);
    });

    // Update display
    updateWindDisplay();
}

function updateForecastTimeLabels() {
    if (!forecastData || !forecastData.periods) return;

    const now = new Date();

    // Find forecast indices for 0, 3, 6, 9 hours from now
    [0, 3, 6, 9].forEach(hours => {
        const targetTime = new Date(now.getTime() + hours * 3600000);
        const index = findClosestForecastIndex(targetTime);

        if (index !== -1) {
            const forecastTime = forecastData.periods[index].timestamp;
            const timeStr = forecastTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            // Update both wind and weather section labels
            const label = document.getElementById(`time${hours}`);
            const labelWeather = document.getElementById(`timeWeather${hours}`);

            if (label) label.textContent = timeStr;
            if (labelWeather) labelWeather.textContent = timeStr;
        }
    });
}

function findClosestForecastIndex(targetTime) {
    if (!forecastData || !forecastData.periods) return -1;

    let closestIndex = 0;
    let smallestDiff = Math.abs(forecastData.periods[0].timestamp - targetTime);

    for (let i = 1; i < forecastData.periods.length; i++) {
        const diff = Math.abs(forecastData.periods[i].timestamp - targetTime);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestIndex = i;
        }
    }

    return closestIndex;
}

function updateWindDisplay() {
    if (currentMode === 'live') {
        // Use live Tempest data - fetchWeatherData already handles this
        // Just re-fetch to ensure latest
        fetchWeatherData();
    } else {
        // Use NWS forecast data
        if (forecastData && forecastData.periods) {
            const now = new Date();
            const targetTime = new Date(now.getTime() + selectedForecastHours * 3600000);
            const index = findClosestForecastIndex(targetTime);

            if (index !== -1) {
                const period = forecastData.periods[index];

                // Parse NWS wind data
                const windSpeedMph = parseNWSWindSpeed(period.windSpeed);
                const windDirection = compassTodegrees(period.windDirection);

                // NWS doesn't provide gust data in hourly forecast
                // Just show sustained wind for both values
                const windSpeedKt = mphToKnots(windSpeedMph);

                const data = {
                    wind_avg: windSpeedKt,
                    wind_gust: windSpeedKt,  // Same as sustained since no gust data available
                    wind_direction: windDirection,
                    timestamp: period.timestamp
                };

                // Display forecast wind data
                displayForecastWindData(data);

                // Display forecast weather observations
                displayForecastWeatherObservations(period);

                // Update forecast time display for both sections
                const forecastTimeStr = data.timestamp.toLocaleString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                const timeDisplay = document.getElementById('selectedForecastTime');
                const timeDisplayWeather = document.getElementById('selectedForecastTimeWeather');

                if (timeDisplay) timeDisplay.textContent = forecastTimeStr;
                if (timeDisplayWeather) timeDisplayWeather.textContent = forecastTimeStr;
            }
        }
    }
}

function displayForecastWindData(observation) {
    // Extract wind data (already converted to knots from NWS mph)
    const windSpeedKt = observation.wind_avg;
    const windGustKt = observation.wind_gust;
    const windDirection = observation.wind_direction;
    const timestamp = observation.timestamp;

    // Update wind display
    const windDirDegF = Math.round(windDirection);
    document.getElementById('windDirection').textContent = `${String(windDirDegF).padStart(3, '0')}°`;
    document.getElementById('windSpeed').textContent = `${Math.round(windSpeedKt)} kt`;
    document.getElementById('windGust').textContent = `${Math.round(windGustKt)} kt`;

    // Update compass card header
    const windDirHeaderF = document.getElementById('windDirHeader');
    const windSummaryF = document.getElementById('windSummary');
    if (windDirHeaderF) windDirHeaderF.textContent = `${String(windDirDegF).padStart(3, '0')}°`;
    if (windSummaryF) windSummaryF.textContent = `${Math.round(windSpeedKt)} kt`;

    const windDirNameF = document.getElementById('windDirName');
    if (windDirNameF) windDirNameF.textContent = compassDirectionName(windDirDegF);

    // Update timestamp
    updateTimestamp(timestamp);

    // Rotate wind arrow
    rotateWindArrow(windDirection);

    // Calculate and display runway components
    calculateAndDisplayRunwayComponents(windDirection, windSpeedKt);
}

function displayForecastWeatherObservations(period) {
    // Extract weather data from NWS forecast
    const tempF = period.temperature;  // Already in Fahrenheit
    const humidity = period.relativeHumidity;

    // Update weather observation displays
    document.getElementById('temperature').textContent = `${Math.round(tempF)}°F`;
    document.getElementById('humidity').textContent = `${Math.round(humidity)}%`;

    // Note: NWS hourly forecast doesn't include pressure data
    // Pressure will only update in live mode
    // We could show "N/A" or leave the last live value, keeping last live value for now

    // Calculate and display density altitude using forecast temp
    // We'll use the last known pressure value for this calculation
    const pressureElement = document.getElementById('pressure');
    const currentPressureText = pressureElement.textContent;

    // Parse current pressure (e.g., "29.92 inHg")
    const pressureMatch = currentPressureText.match(/([\d.]+)/);
    if (pressureMatch) {
        const pressureInHg = parseFloat(pressureMatch[1]);
        const densityAlt = calculateDensityAltitude(FIELD_ELEVATION, tempF, pressureInHg);
        const densityAltDelta = densityAlt - FIELD_ELEVATION;

        document.getElementById('densityAltitude').textContent = `${Math.round(densityAlt).toLocaleString()} ft`;

        // Display delta with color coding
        const deltaElement = document.getElementById('densityAltitudeDelta');
        if (densityAltDelta > 0) {
            deltaElement.textContent = `+${Math.round(densityAltDelta).toLocaleString()} ft`;
            deltaElement.className = 'delta-value negative';
        } else if (densityAltDelta < 0) {
            deltaElement.textContent = `${Math.round(densityAltDelta).toLocaleString()} ft`;
            deltaElement.className = 'delta-value positive';
        } else {
            deltaElement.textContent = `${Math.round(densityAltDelta)} ft`;
            deltaElement.className = 'delta-value neutral';
        }
    }
}

// ============================================================================
// WIND CALCULATIONS
// ============================================================================

/**
 * Calculate headwind and crosswind components for a runway
 *
 * TRIGONOMETRY EXPLANATION:
 *
 * IMPORTANT: Wind direction is ALWAYS reported as the direction wind is coming FROM.
 * - 270° = wind from the west (blowing east)
 * - 090° = wind from the east (blowing west)
 *
 * Runway heading is the direction you're traveling when landing.
 *
 * The angle difference determines how much wind is:
 * - Headwind/Tailwind (parallel to runway): cos(angle) × wind_speed
 * - Crosswind (perpendicular to runway): sin(angle) × wind_speed
 *
 * Example: Landing runway 24 (heading 240°) with wind from 270° at 10kt:
 * - Angle difference: 270° - 240° = 30°
 * - Headwind: cos(30°) × 10kt = 8.7kt (positive = headwind)
 * - Crosswind: sin(30°) × 10kt = 5.0kt (positive = right crosswind)
 *
 * @param {number} windDirection - Wind direction in degrees (where wind originates FROM, not TO)
 * @param {number} windSpeed - Wind speed in knots
 * @param {number} runwayHeading - Runway magnetic heading
 * @returns {Object} - { headwind, crosswind, crosswindDirection }
 */
function calculateWindComponents(windDirection, windSpeed, runwayHeading) {
    // Calculate the angle between wind direction and runway heading
    let angleDiff = windDirection - runwayHeading;

    // Normalize angle to -180 to +180 range
    // This handles cases where the difference crosses 0°/360°
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    // Convert to radians for trigonometric functions
    const angleRad = (angleDiff * Math.PI) / 180;

    // Calculate components using trigonometry
    // cos(angle) gives the headwind component (parallel to runway)
    // sin(angle) gives the crosswind component (perpendicular to runway)
    const headwindComponent = Math.cos(angleRad) * windSpeed;
    const crosswindComponent = Math.abs(Math.sin(angleRad) * windSpeed);

    // Determine crosswind direction (left or right)
    // Positive angleDiff means wind from the right, negative means from the left
    const crosswindDirection = angleDiff > 0 ? 'R' : 'L';

    return {
        headwind: headwindComponent,      // Positive = headwind, Negative = tailwind
        crosswind: crosswindComponent,    // Always positive (magnitude)
        crosswindDirection: crosswindDirection  // 'L' or 'R'
    };
}

/**
 * Parse NWS wind speed string to numeric mph value
 * NWS formats: "25 mph" or "5 to 10 mph"
 * For range, we take the higher value (conservative for flight planning)
 */
function parseNWSWindSpeed(windSpeedStr) {
    if (!windSpeedStr) return 0;

    // Match pattern like "5 to 10 mph" - take the higher value
    const rangeMatch = windSpeedStr.match(/(\d+)\s+to\s+(\d+)/);
    if (rangeMatch) {
        return parseInt(rangeMatch[2]);
    }

    // Match simple pattern like "25 mph"
    const simpleMatch = windSpeedStr.match(/(\d+)/);
    if (simpleMatch) {
        return parseInt(simpleMatch[1]);
    }

    return 0;
}

/**
 * Convert NWS compass direction to degrees
 * NWS uses: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
 */
function compassTodegrees(direction) {
    const compassPoints = {
        'N': 0,
        'NNE': 22.5,
        'NE': 45,
        'ENE': 67.5,
        'E': 90,
        'ESE': 112.5,
        'SE': 135,
        'SSE': 157.5,
        'S': 180,
        'SSW': 202.5,
        'SW': 225,
        'WSW': 247.5,
        'W': 270,
        'WNW': 292.5,
        'NW': 315,
        'NNW': 337.5
    };

    return compassPoints[direction] || 0;
}

/**
 * Convert miles per hour to knots
 * NWS reports in mph, pilots use knots
 * 1 mph = 0.868976 knots
 */
function mphToKnots(mph) {
    return mph * 0.868976;
}

/**
 * Convert meters per second to knots
 * The Tempest station reports in m/s, but pilots use knots
 * 1 m/s = 1.94384 knots
 */
function msToKnots(metersPerSecond) {
    return metersPerSecond * 1.94384;
}

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

/**
 * Convert millibars (hPa) to inches of mercury (inHg)
 * 1 mb = 0.02953 inHg
 */
function mbToInHg(millibars) {
    return millibars * 0.02953;
}

/**
 * Convert station pressure (mb) to altimeter setting (inHg).
 * The Tempest stores absolute station pressure at elevation; the PA/DA
 * formula requires sea-level-equivalent pressure (altimeter setting).
 * Uses the FAA standard hypsometric correction.
 */
function stationPressureToAltimeterInHg(stationPressureMb, elevationFt) {
    const stationPressureInHg = stationPressureMb * 0.02953;
    return stationPressureInHg * Math.pow(1 + 6.8755856e-6 * elevationFt, 5.2558797);
}

/**
 * Calculate density altitude
 *
 * Density altitude is the altitude relative to standard atmospheric conditions
 * at which the air density would be equal to the indicated air density at the
 * place of observation. Higher density altitude means reduced aircraft performance.
 *
 * Formula uses:
 * - ISA standard: 15°C at sea level, -2°C per 1000ft
 * - Standard pressure: 29.92 inHg
 * - Pressure altitude adjustment: (29.92 - current pressure) * 1000
 * - Temperature correction: 120 * (actual temp - ISA temp)
 *
 * @param {number} fieldElevation - Field elevation in feet MSL
 * @param {number} tempF - Temperature in Fahrenheit
 * @param {number} pressureInHg - Barometric pressure in inHg
 * @returns {number} Density altitude in feet
 */
function calculateDensityAltitude(fieldElevation, tempF, pressureInHg) {
    // Calculate pressure altitude
    const pressureAltitude = fieldElevation + ((29.92 - pressureInHg) * 1000);

    // Convert temperature to Celsius
    const tempC = (tempF - 32) / 1.8;

    // Calculate ISA temperature at pressure altitude
    // ISA: 15°C at sea level, decreases 2°C per 1000ft
    const isaTemp = 15 - (2 * (pressureAltitude / 1000));

    // Temperature deviation from ISA
    const tempDeviation = tempC - isaTemp;

    // Density altitude calculation
    // 120 ft per degree C deviation from ISA
    const densityAltitude = pressureAltitude + (120 * tempDeviation);

    return densityAltitude;
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function displayWeatherData(observation) {
    // Extract wind data (Tempest reports in m/s, convert to knots)
    const windSpeedMs = observation.wind_avg;
    const windGustMs = observation.wind_gust;
    const windDirection = observation.wind_direction;
    const timestamp = new Date(observation.timestamp);

    // Convert speeds to knots
    const windSpeedKt = msToKnots(windSpeedMs);
    const windGustKt = msToKnots(windGustMs);

    // Update wind display
    const windDirDeg = Math.round(windDirection);
    document.getElementById('windDirection').textContent = `${String(windDirDeg).padStart(3, '0')}°`;
    document.getElementById('windSpeed').textContent = `${Math.round(windSpeedKt)} kt`;
    document.getElementById('windGust').textContent = `${Math.round(windGustKt)} kt`;

    // Update compass card header
    const windDirHeader = document.getElementById('windDirHeader');
    const windSummary = document.getElementById('windSummary');
    if (windDirHeader) windDirHeader.textContent = `${String(windDirDeg).padStart(3, '0')}°`;
    if (windSummary) windSummary.textContent = `${Math.round(windSpeedKt)}G${Math.round(windGustKt)} kt`;

    // Direction name and gust delta
    const windDirName = document.getElementById('windDirName');
    if (windDirName) windDirName.textContent = compassDirectionName(windDirDeg);
    const windGustDelta = document.getElementById('windGustDelta');
    if (windGustDelta) windGustDelta.textContent = `Δ ${Math.round(windGustKt - windSpeedKt)} kt`;

    // Update last updated timestamp
    updateTimestamp(timestamp);

    // Rotate wind arrow to show wind direction
    rotateWindArrow(windDirection);

    // Calculate and display runway wind components
    calculateAndDisplayRunwayComponents(windDirection, windSpeedKt);

    // Display weather observations data
    displayWeatherObservations(observation);
}

function displayWeatherObservations(observation) {
    // Extract weather data
    const tempC = observation.air_temperature;
    const pressureMb = observation.pressure;
    const humidity = observation.relative_humidity;

    // Convert to display units
    const tempF = celsiusToFahrenheit(tempC);
    // Tempest stores station pressure; convert to altimeter setting for PA/DA formula
    const pressureInHg = stationPressureToAltimeterInHg(pressureMb, FIELD_ELEVATION);

    // Update weather observation displays
    document.getElementById('temperature').textContent = `${Math.round(tempF)}°F`;
    document.getElementById('pressure').textContent = `${pressureInHg.toFixed(2)} inHg`;
    document.getElementById('humidity').textContent = `${Math.round(humidity)}%`;

    // Calculate and display density altitude
    const densityAlt = calculateDensityAltitude(FIELD_ELEVATION, tempF, pressureInHg);
    const densityAltDelta = densityAlt - FIELD_ELEVATION;

    document.getElementById('densityAltitude').textContent = `${Math.round(densityAlt).toLocaleString()} ft`;

    // Display delta with color coding
    const deltaElement = document.getElementById('densityAltitudeDelta');
    if (densityAltDelta > 0) {
        deltaElement.textContent = `+${Math.round(densityAltDelta).toLocaleString()} ft`;
        deltaElement.className = 'stat-sub density-warn';
    } else if (densityAltDelta < 0) {
        deltaElement.textContent = `${Math.round(densityAltDelta).toLocaleString()} ft`;
        deltaElement.className = 'stat-sub';
    } else {
        deltaElement.textContent = `± 0 ft`;
        deltaElement.className = 'stat-sub';
    }

    // Pressure sub-label
    const pressureSub = document.getElementById('pressureSub');
    if (pressureSub) pressureSub.textContent = pressureInHg > 29.92 ? 'High pressure' : 'Low pressure';

}

function rotateWindArrow(windDirection) {
    const windArrow = document.getElementById('windArrow');
    if (!windArrow) return;
    windArrow.setAttribute('transform', `rotate(${windDirection + 180} 50 50)`);
}

function calculateAndDisplayRunwayComponents(windDirection, windSpeedKt) {
    // Runway 24 (heading 240°)
    const rwy24Components = calculateWindComponents(
        windDirection,
        windSpeedKt,
        RUNWAYS.runway24.heading
    );

    // Runway 06 (heading 060°)
    const rwy06Components = calculateWindComponents(
        windDirection,
        windSpeedKt,
        RUNWAYS.runway06.heading
    );

    // Display Runway 24 components
    const rwy24Headwind = document.getElementById('rwy24Headwind');
    const rwy24HeadwindLabel = document.getElementById('rwy24HeadwindLabel');

    // Round down to whole numbers for display
    if (rwy24Components.headwind >= 0) {
        rwy24HeadwindLabel.textContent = 'Headwind';
        rwy24Headwind.textContent = `${Math.floor(rwy24Components.headwind)} kt`;
        rwy24Headwind.className = 'rwy-comp-value headwind';
    } else {
        rwy24HeadwindLabel.textContent = 'Tailwind';
        rwy24Headwind.textContent = `${Math.floor(Math.abs(rwy24Components.headwind))} kt`;
        rwy24Headwind.className = 'rwy-comp-value tailwind';
    }

    const cw24 = Math.floor(rwy24Components.crosswind);
    const cw24El = document.getElementById('rwy24Crosswind');
    cw24El.textContent = `${cw24} kt`;
    cw24El.className = cw24 >= 15 ? 'rwy-comp-value xwind-danger' : cw24 >= 10 ? 'rwy-comp-value xwind-warn' : 'rwy-comp-value xwind-ok';
    document.getElementById('rwy24CrosswindDir').textContent = rwy24Components.crosswindDirection;

    // Display Runway 06 components
    const rwy06Headwind = document.getElementById('rwy06Headwind');
    const rwy06HeadwindLabel = document.getElementById('rwy06HeadwindLabel');

    // Round down to whole numbers for display
    if (rwy06Components.headwind >= 0) {
        rwy06HeadwindLabel.textContent = 'Headwind';
        rwy06Headwind.textContent = `${Math.floor(rwy06Components.headwind)} kt`;
        rwy06Headwind.className = 'rwy-comp-value headwind';
    } else {
        rwy06HeadwindLabel.textContent = 'Tailwind';
        rwy06Headwind.textContent = `${Math.floor(Math.abs(rwy06Components.headwind))} kt`;
        rwy06Headwind.className = 'rwy-comp-value tailwind';
    }

    const cw06 = Math.floor(rwy06Components.crosswind);
    const cw06El = document.getElementById('rwy06Crosswind');
    cw06El.textContent = `${cw06} kt`;
    cw06El.className = cw06 >= 15 ? 'rwy-comp-value xwind-danger' : cw06 >= 10 ? 'rwy-comp-value xwind-warn' : 'rwy-comp-value xwind-ok';
    document.getElementById('rwy06CrosswindDir').textContent = rwy06Components.crosswindDirection;
}

function updateTimestamp(timestamp) {
    const now = new Date();
    const diffSeconds = Math.floor((now - timestamp) / 1000);

    // Helper function to format date/time
    function formatDateTime(date, isUTC = false) {
        const month = String((isUTC ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
        const day = String(isUTC ? date.getUTCDate() : date.getDate()).padStart(2, '0');
        const year = isUTC ? date.getUTCFullYear() : date.getFullYear();

        let hours = isUTC ? date.getUTCHours() : date.getHours();
        const minutes = String(isUTC ? date.getUTCMinutes() : date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12

        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
    }

    // Format Zulu time as "17:42Z"
    const zuluH = String(timestamp.getUTCHours()).padStart(2, '0');
    const zuluM = String(timestamp.getUTCMinutes()).padStart(2, '0');
    document.getElementById('timestampZulu').textContent = `${zuluH}:${zuluM}Z`;

    // Format local time as "12:42 PM"
    const localTimeStr = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('timestampLocal').textContent = localTimeStr;

    // Update relative time display
    let ageStr;
    if (diffSeconds < 60) {
        ageStr = `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
        ageStr = `${Math.floor(diffSeconds / 60)}m ago`;
    } else {
        ageStr = `${Math.floor(diffSeconds / 3600)}h ago`;
    }
    document.getElementById('lastUpdated').textContent = ageStr;
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

function startAutoRefresh() {
    // Clear any existing timers
    if (refreshTimer) clearInterval(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    if (warningsRefreshTimer) clearInterval(warningsRefreshTimer);

    // Set up refresh timer
    refreshTimer = setInterval(() => {
        fetchWeatherData();
        resetCountdown();
    }, REFRESH_INTERVAL);

    // Set up warnings refresh timer (10 minutes)
    warningsRefreshTimer = setInterval(() => {
        fetchWarningsData();
    }, WARNINGS_REFRESH_INTERVAL);

    // Set up countdown timer
    startCountdown();
}

function startCountdown() {
    let seconds = REFRESH_INTERVAL / 1000;

    countdownTimer = setInterval(() => {
        seconds--;
        document.getElementById('refreshCountdown').textContent = seconds;

        if (seconds <= 0) {
            seconds = REFRESH_INTERVAL / 1000;
        }
    }, 1000);
}

function resetCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    startCountdown();
}

// ============================================================================
// VIEW TOGGLE FUNCTIONALITY
// ============================================================================

function setupViewToggle() {
    const toggleWind = document.getElementById('toggleWind');
    const toggleWeather = document.getElementById('toggleWeather');
    const toggleWarnings = document.getElementById('toggleWarnings');

    const windCardContainer = document.getElementById('windCardContainer');
    const weatherView = document.getElementById('weatherView');
    const warningsView = document.getElementById('warningsView');
    const sourceTabs = document.querySelector('.source-tabs');
    const forecastSelector = document.getElementById('forecastSelector');

    if (!toggleWind || !toggleWeather || !toggleWarnings || !windCardContainer || !weatherView || !warningsView) {
        console.error('View toggle setup failed - missing elements');
        return;
    }

    function showSection(section) {
        const isWind = section === 'wind';
        const isWeather = section === 'weather';
        const isWarnings = section === 'warnings';

        windCardContainer.style.display = isWind ? '' : 'none';
        weatherView.style.display = isWeather ? '' : 'none';
        warningsView.style.display = isWarnings ? '' : 'none';

        // Hide source tabs and forecast selector on Warnings (irrelevant there)
        if (sourceTabs) sourceTabs.style.display = isWarnings ? 'none' : '';
        if (forecastSelector && isWarnings) forecastSelector.classList.remove('active');

        toggleWind.classList.toggle('active', isWind);
        toggleWeather.classList.toggle('active', isWeather);
        toggleWarnings.classList.toggle('active', isWarnings);
    }

    toggleWind.addEventListener('click', () => showSection('wind'));
    toggleWeather.addEventListener('click', () => showSection('weather'));
    toggleWarnings.addEventListener('click', () => {
        showSection('warnings');
        fetchWarningsData();
    });
}

// ============================================================================
// VISIBILITY CHANGE HANDLING
// ============================================================================

// Pause updates when page is not visible, resume when visible
// This saves battery and data on mobile devices
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden - pausing updates');
        if (refreshTimer) clearInterval(refreshTimer);
        if (countdownTimer) clearInterval(countdownTimer);
        if (warningsRefreshTimer) clearInterval(warningsRefreshTimer);
    } else {
        console.log('Page visible - resuming updates');
        fetchWeatherData();
        startAutoRefresh();
    }
});

// ============================================================================
// WARNINGS (SIGMET / G-AIRMET)
// ============================================================================

// Ray-casting point-in-polygon. coords may be [[lat,lon],...] or [{lat,lon},...]
function pointInPolygon(lat, lon, coords) {
    if (!Array.isArray(coords) || coords.length < 3) return false;

    let inside = false;
    const n = coords.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        let xi, yi, xj, yj;

        if (Array.isArray(coords[i])) {
            xi = +coords[i][0]; yi = +coords[i][1];
            xj = +coords[j][0]; yj = +coords[j][1];
        } else {
            xi = +coords[i].lat; yi = +coords[i].lon;
            xj = +coords[j].lat; yj = +coords[j].lon;
        }

        const intersect = ((yi > lon) !== (yj > lon)) &&
            (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

async function fetchWarningsData() {
    console.log('Fetching warnings data...');

    const warningsLoading = document.getElementById('warningsLoading');
    const warningsClear = document.getElementById('warningsClear');
    const warningsError = document.getElementById('warningsError');
    const warningsList = document.getElementById('warningsList');

    // Only show loading spinner if the warnings tab is currently visible
    const warningsView = document.getElementById('warningsView');
    const isVisible = warningsView && warningsView.style.display !== 'none';

    if (isVisible) {
        if (warningsLoading) warningsLoading.style.display = '';
        if (warningsClear) warningsClear.style.display = 'none';
        if (warningsError) warningsError.style.display = 'none';
        if (warningsList) warningsList.innerHTML = '';
    }

    try {
        const { data, error } = await supabaseClient.functions.invoke('fetch-warnings');

        if (error) throw error;

        const airportLat = NWS_LAT;
        const airportLon = NWS_LON;

        const airsigmets = (data.airsigmets || []).filter(s =>
            pointInPolygon(airportLat, airportLon, s.coords)
        );
        const gairmets = (data.gairmets || []).filter(g =>
            pointInPolygon(airportLat, airportLon, g.coords)
        );

        console.log(`Warnings affecting location: ${airsigmets.length} SIGMETs, ${gairmets.length} G-AIRMETs`);

        displayWarnings(airsigmets, gairmets);

    } catch (error) {
        console.error('Error fetching warnings:', error);
        if (isVisible) {
            if (warningsLoading) warningsLoading.style.display = 'none';
            if (warningsError) warningsError.style.display = '';
        }
    }
}

function formatValidTimeUntil(unixTs) {
    if (unixTs == null) return '';
    const d = new Date(unixTs * 1000);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `Until ${h}:${m}Z`;
}

function formatGairmetValidTime(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        const h = String(d.getUTCHours()).padStart(2, '0');
        const m = String(d.getUTCMinutes()).padStart(2, '0');
        return `Valid ${h}:${m}Z`;
    } catch {
        return isoStr;
    }
}

const HAZARD_LABELS = {
    // SIGMET hazards (uppercase)
    'CONVECTIVE': 'Convective',
    'TURB': 'Turbulence',
    'ICE': 'Icing',
    'IFR': 'IFR',
    // G-AIRMET hazards (uppercase, as returned by API)
    'TURB-HI': 'Turbulence Hi Alt',
    'TURB-LO': 'Turbulence Lo Alt',
    'LLWS': 'Low-Level Wind Shear',
    'SFC_WIND': 'Strong Sfc Winds',
    'MT_OBSC': 'Mtn Obscuration',
    'FZLVL': 'Freezing Level',
};

const SIGMET_CARD_CLASS = {
    'CONVECTIVE': 'warning-card--conv',
    'TURB': 'warning-card--turb',
    'ICE': 'warning-card--ice',
    'IFR': 'warning-card--ifr',
};

const GAIRMET_CARD_CLASS = {
    'TURB-HI': 'warning-card--turb',
    'TURB-LO': 'warning-card--turb',
    'LLWS': 'warning-card--llws',
    'SFC_WIND': 'warning-card--sfc-wind',
    'IFR': 'warning-card--ifr',
    'MT_OBSC': 'warning-card--mtn-obs',
    'ICE': 'warning-card--ice',
    'FZLVL': 'warning-card--fzlvl',
};

const GAIRMET_BADGE_CLASS = {
    'sierra': 'warning-badge--sierra',
    'tango': 'warning-badge--tango',
    'zulu': 'warning-badge--zulu',
};

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildSigmetCard(sigmet) {
    const cardClass = SIGMET_CARD_CLASS[sigmet.hazard] || 'warning-card--conv';
    const validStr = formatValidTimeUntil(sigmet.validTimeTo);
    const hazardStr = HAZARD_LABELS[sigmet.hazard] || sigmet.hazard || '';

    // Altitude: values are in feet; format as FLxxx if above 180, else as ft
    function fmtAlt(ft) {
        if (ft == null) return null;
        return ft >= 18000 ? `FL${Math.round(ft / 100)}` : `${ft.toLocaleString()} ft`;
    }

    const altLo = fmtAlt(sigmet.altitudeLow1);
    const altHi = fmtAlt(sigmet.altitudeHi1);
    const altStr = altLo && altHi ? `${altLo} – ${altHi}` : (altHi || altLo || '');

    const rawText = sigmet.rawAirSigmet || '';
    const rawEscaped = escapeHtml(rawText);

    return `<div class="warning-card ${cardClass}">
  <div class="warning-card-header">
    <span class="warning-badge warning-badge--sigmet">SIGMET · ${escapeHtml(hazardStr)}</span>
    ${validStr ? `<span class="warning-valid">${escapeHtml(validStr)}</span>` : ''}
  </div>
  <div class="warning-detail">
    ${altStr ? `<span class="warning-detail-item"><strong>Alt:</strong> ${escapeHtml(altStr)}</span>` : ''}
    ${sigmet.movementDir != null ? `<span class="warning-detail-item"><strong>Moving:</strong> ${sigmet.movementDir}° at ${sigmet.movementSpd} kt</span>` : ''}
    ${sigmet.severity ? `<span class="warning-detail-item"><strong>Severity:</strong> ${sigmet.severity}</span>` : ''}
  </div>
  ${rawText ? `<button class="warning-raw-toggle" data-show="Show raw text" data-hide="Hide raw text">Show raw text</button>
  <div class="warning-raw" hidden><pre>${rawEscaped}</pre></div>` : ''}
</div>`;
}

function buildGairmetCard(gairmet) {
    const product = (gairmet.product || '').toLowerCase();
    const cardClass = GAIRMET_CARD_CLASS[gairmet.hazard] || 'warning-card--turb';
    const badgeClass = GAIRMET_BADGE_CLASS[product] || 'warning-badge--tango';
    const validStr = formatGairmetValidTime(gairmet.validTime);
    const hazardStr = HAZARD_LABELS[gairmet.hazard] || gairmet.hazard || '';

    // Format a G-AIRMET altitude value (hundreds-of-feet FL notation or keyword like FZL/SFC)
    function fmtGAlt(val) {
        if (val == null || val === '') return null;
        if (isNaN(val)) return String(val); // FZL, SFC, etc.
        return `FL${val}`;
    }

    const altBase = fmtGAlt(gairmet.base);
    const altTop  = fmtGAlt(gairmet.top);
    const fzlBase = fmtGAlt(gairmet.fzlbase);
    const fzlTop  = fmtGAlt(gairmet.fzltop);
    const fzlLvl  = fmtGAlt(gairmet.level);

    const altStr = (altBase && altTop) ? `${altBase}–${altTop}` : (altTop || altBase || '');
    const fzlStr = (fzlBase && fzlTop) ? `${fzlBase}–${fzlTop}` : (fzlLvl || '');

    // Format a timestamp as "HH:MMZ (h:MM AM/PM local)"
    function fmtTimestamp(isoStr) {
        if (!isoStr) return null;
        try {
            const d = new Date(isoStr);
            const hz = String(d.getUTCHours()).padStart(2, '0');
            const mz = String(d.getUTCMinutes()).padStart(2, '0');
            const local = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return `${hz}:${mz}Z (${local} local)`;
        } catch { return isoStr; }
    }

    // Format unix epoch seconds as timestamp
    function fmtEpoch(secs) {
        if (secs == null) return null;
        return fmtTimestamp(new Date(secs * 1000).toISOString());
    }

    const validTimeStr  = fmtTimestamp(gairmet.validTime);
    const issuedTimeStr = fmtEpoch(gairmet.issueTime);

    // Synthesize a formatted text block (G-AIRMETs have no raw bulletin text)
    const rawLines = [];
    rawLines.push(`G-AIRMET ${(gairmet.product || '').toUpperCase()} ${gairmet.tag || ''} ${gairmet.status || ''}`.trim());
    if (validTimeStr)  rawLines.push(`Valid:   ${validTimeStr}`);
    if (issuedTimeStr) rawLines.push(`Issued:  ${issuedTimeStr}`);
    if (gairmet.severity) rawLines.push(`Severity: ${gairmet.severity}`);
    if (altStr) rawLines.push(`Altitudes: ${altStr}`);
    if (fzlStr) rawLines.push(`FZLVL: ${fzlStr}`);
    if (gairmet.due_to) rawLines.push(`Due to: ${gairmet.due_to}`);
    if (gairmet.forecastHour != null) rawLines.push(`Forecast hour: +${gairmet.forecastHour}h`);
    const rawText = rawLines.join('\n');

    // Inline detail chips
    const chips = [];
    if (gairmet.severity) chips.push(`<span class="warning-detail-item"><strong>${escapeHtml(gairmet.severity)}</strong></span>`);
    if (altStr) chips.push(`<span class="warning-detail-item"><strong>Alt:</strong> ${escapeHtml(altStr)}</span>`);
    if (fzlStr) chips.push(`<span class="warning-detail-item"><strong>FZLVL:</strong> ${escapeHtml(fzlStr)}</span>`);
    if (gairmet.due_to) chips.push(`<span class="warning-detail-item">${escapeHtml(gairmet.due_to)}</span>`);
    if (gairmet.forecastHour != null) chips.push(`<span class="warning-detail-item"><strong>Fcst:</strong> +${gairmet.forecastHour}h</span>`);

    return `<div class="warning-card ${cardClass}">
  <div class="warning-card-header">
    <span class="warning-badge ${badgeClass}">G-AIRMET · ${escapeHtml(product.toUpperCase())}</span>
    ${validStr ? `<span class="warning-valid">${escapeHtml(validStr)}</span>` : ''}
  </div>
  <div class="warning-detail">
    <span class="warning-detail-item"><strong>${escapeHtml(hazardStr)}</strong></span>
    ${chips.join('')}
  </div>
  <button class="warning-raw-toggle" data-show="Show raw text" data-hide="Hide raw text">Show raw text</button>
  <div class="warning-raw" hidden><pre>${escapeHtml(rawText)}</pre></div>
</div>`;
}

function displayWarnings(airsigmets, gairmets) {
    const warningsLoading = document.getElementById('warningsLoading');
    const warningsClear = document.getElementById('warningsClear');
    const warningsError = document.getElementById('warningsError');
    const warningsList = document.getElementById('warningsList');
    const warningsUpdated = document.getElementById('warningsUpdated');

    if (warningsLoading) warningsLoading.style.display = 'none';
    if (warningsError) warningsError.style.display = 'none';

    const total = airsigmets.length + gairmets.length;

    if (total === 0) {
        if (warningsClear) warningsClear.style.display = '';
        if (warningsList) warningsList.innerHTML = '';
    } else {
        if (warningsClear) warningsClear.style.display = 'none';

        let html = '';

        if (airsigmets.length > 0) {
            html += `<div class="warning-group-header">SIGMETs (${airsigmets.length})</div>`;
            airsigmets.forEach(s => { html += buildSigmetCard(s); });
        }

        if (gairmets.length > 0) {
            html += `<div class="warning-group-header">G-AIRMETs (${gairmets.length})</div>`;
            gairmets.forEach(g => { html += buildGairmetCard(g); });
        }

        if (warningsList) {
            warningsList.innerHTML = html;

            // Wire up expand/collapse toggles
            warningsList.querySelectorAll('.warning-raw-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const rawDiv = btn.nextElementSibling;
                    const isHidden = rawDiv.hasAttribute('hidden');
                    rawDiv.toggleAttribute('hidden');
                    btn.textContent = isHidden ? btn.dataset.hide : btn.dataset.show;
                });
            });
        }
    }

    if (warningsUpdated) {
        const now = new Date();
        const h = String(now.getUTCHours()).padStart(2, '0');
        const m = String(now.getUTCMinutes()).padStart(2, '0');
        warningsUpdated.textContent = `Updated ${h}:${m}Z`;
    }
}
