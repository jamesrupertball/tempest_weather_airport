/**
 * Configuration file for 00MN Weather Dashboard
 *
 * INSTRUCTIONS:
 * 1. Copy this file to config.js
 * 2. Replace the placeholder values with your actual Supabase credentials
 *
 * IMPORTANT: Never commit config.js with real credentials to version control!
 * Add config.js to your .gitignore file.
 */

// Configuration for 00MN Weather Dashboard
// Explicitly assign to window to ensure global availability
window.config = {
    supabase: {
        url: 'https://your-project-id.supabase.co',
        anonKey: 'your-anon-public-key-here'
    },
    nws: {
        userAgent: '(00MN Weather Dashboard, your-email@example.com)',
        location: {
            lat: 46.30,  // Battle Lake Municipal Airport
            lon: -95.80
        },
        // Grid coordinates obtained from points API
        grid: {
            office: 'FGF',
            x: 132,
            y: 29
        }
    },
    refreshInterval: 60000, // 60 seconds
    fieldElevation: 1391, // Battle Lake Municipal Airport elevation in feet MSL
    runways: {
        runway24: { heading: 240, name: '24' },
        runway06: { heading: 60, name: '06' }
    }
};

// Also create a const reference for backwards compatibility
const config = window.config;
