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

// NWS forecast state
let currentMode = 'live'; // 'live' or 'forecast'
let selectedForecastHours = 0; // 0, 3, 6, or 9
let liveData = null;
let forecastData = null;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupViewToggle();
    setupDataSourceToggle();
    setupForecastTabs();
});

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

    // Fetch initial data
    fetchWeatherData();

    // Fetch forecast data
    fetchForecastData();

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
    document.getElementById('windDirection').textContent = `${Math.round(windDirection)}°`;
    document.getElementById('windSpeed').textContent = `${Math.round(windSpeedKt)} kt`;
    document.getElementById('windGust').textContent = `${Math.round(windGustKt)} kt`;

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

    // Calculate ISA temperature at pressure altitude
    // ISA: 15°C (59°F) at sea level, decreases 2°C per 1000ft (3.5°F per 1000ft)
    const isaTemp = 59 - (3.5 * (pressureAltitude / 1000));

    // Temperature deviation from ISA
    const tempDeviation = tempF - isaTemp;

    // Density altitude calculation
    // 120 ft per degree F deviation from ISA
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
    document.getElementById('windDirection').textContent = `${Math.round(windDirection)}°`;
    document.getElementById('windSpeed').textContent = `${Math.round(windSpeedKt)} kt`;
    document.getElementById('windGust').textContent = `${Math.round(windGustKt)} kt`;

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
    const pressureInHg = mbToInHg(pressureMb);

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
        deltaElement.className = 'delta-value negative';
    } else if (densityAltDelta < 0) {
        deltaElement.textContent = `${Math.round(densityAltDelta).toLocaleString()} ft`;
        deltaElement.className = 'delta-value positive';
    } else {
        deltaElement.textContent = `${Math.round(densityAltDelta)} ft`;
        deltaElement.className = 'delta-value neutral';
    }
}

function rotateWindArrow(windDirection) {
    const windArrow = document.getElementById('windArrow');
    // The arrow points up by default (0°)
    // Wind direction is where wind comes FROM, so add 180° to show where it's blowing TO
    const arrowRotation = windDirection + 180;
    windArrow.style.transform = `rotate(${arrowRotation}deg)`;
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
        rwy24Headwind.className = 'component-value headwind';
    } else {
        rwy24HeadwindLabel.textContent = 'Tailwind';
        rwy24Headwind.textContent = `${Math.floor(Math.abs(rwy24Components.headwind))} kt`;
        rwy24Headwind.className = 'component-value tailwind';
    }

    document.getElementById('rwy24Crosswind').textContent =
        `${Math.floor(rwy24Components.crosswind)} kt`;
    document.getElementById('rwy24CrosswindDir').textContent =
        `(${rwy24Components.crosswindDirection})`;

    // Display Runway 06 components
    const rwy06Headwind = document.getElementById('rwy06Headwind');
    const rwy06HeadwindLabel = document.getElementById('rwy06HeadwindLabel');

    // Round down to whole numbers for display
    if (rwy06Components.headwind >= 0) {
        rwy06HeadwindLabel.textContent = 'Headwind';
        rwy06Headwind.textContent = `${Math.floor(rwy06Components.headwind)} kt`;
        rwy06Headwind.className = 'component-value headwind';
    } else {
        rwy06HeadwindLabel.textContent = 'Tailwind';
        rwy06Headwind.textContent = `${Math.floor(Math.abs(rwy06Components.headwind))} kt`;
        rwy06Headwind.className = 'component-value tailwind';
    }

    document.getElementById('rwy06Crosswind').textContent =
        `${Math.floor(rwy06Components.crosswind)} kt`;
    document.getElementById('rwy06CrosswindDir').textContent =
        `(${rwy06Components.crosswindDirection})`;
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

    // Format Zulu time (UTC)
    const zuluTime = formatDateTime(timestamp, true);

    // Format local time
    const localTime = formatDateTime(timestamp, false);

    // Update Zulu and Local time displays
    document.getElementById('timestampZulu').textContent = zuluTime;
    document.getElementById('timestampLocal').textContent = localTime;

    // Update relative time display
    let displayText;
    if (diffSeconds < 60) {
        displayText = `Updated: ${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        displayText = `Updated: ${minutes}m ago`;
    } else {
        const hours = Math.floor(diffSeconds / 3600);
        displayText = `Updated: ${hours}h ago`;
    }

    document.getElementById('lastUpdated').textContent = displayText;
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

function startAutoRefresh() {
    // Clear any existing timers
    if (refreshTimer) clearInterval(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);

    // Set up refresh timer
    refreshTimer = setInterval(() => {
        fetchWeatherData();
        resetCountdown();
    }, REFRESH_INTERVAL);

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
    const windView = document.getElementById('windView');
    const weatherView = document.getElementById('weatherView');

    // Get all wind-related sections
    const windSections = document.querySelectorAll('.runway-section, .info-section');

    toggleWind.addEventListener('click', () => {
        // Show wind view, hide weather view
        windView.style.display = '';
        weatherView.style.display = 'none';
        windSections.forEach(section => section.style.display = '');

        // Update button states
        toggleWind.classList.add('active');
        toggleWeather.classList.remove('active');
    });

    toggleWeather.addEventListener('click', () => {
        // Show weather view, hide wind view
        windView.style.display = 'none';
        weatherView.style.display = '';
        windSections.forEach(section => section.style.display = 'none');

        // Update button states
        toggleWeather.classList.add('active');
        toggleWind.classList.remove('active');
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
    } else {
        console.log('Page visible - resuming updates');
        fetchWeatherData();
        startAutoRefresh();
    }
});
