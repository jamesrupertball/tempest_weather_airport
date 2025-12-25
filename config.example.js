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

const config = {
    supabase: {
        url: 'https://your-project-id.supabase.co',
        anonKey: 'your-anon-public-key-here'
    },
    refreshInterval: 60000, // 60 seconds
    fieldElevation: 1391, // Battle Lake Municipal Airport elevation in feet MSL
    runways: {
        runway24: { heading: 240, name: '24' },
        runway06: { heading: 60, name: '06' }
    }
};
