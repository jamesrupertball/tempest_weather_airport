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

// ============================================================================
// INITIALIZATION
// ============================================================================

let supabaseClient;
let refreshTimer;
let countdownTimer;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupViewToggle();
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
