#!/usr/bin/env node

/**
 * Build script for Vercel deployment
 *
 * This script:
 * 1. Reads config.example.js
 * 2. Replaces placeholder values with environment variables
 * 3. Writes the result to config.js
 *
 * This allows us to keep credentials out of Git while still
 * having them available at runtime in the deployed app.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Building config.js from environment variables...');

// Read the template
const templatePath = path.join(__dirname, 'config.example.js');
let configTemplate = fs.readFileSync(templatePath, 'utf8');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Missing required environment variables!');
    console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel dashboard.');
    console.error('   Current values:');
    console.error('   - SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
    console.error('   - SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'NOT SET');
    process.exit(1);
}

// Replace placeholders with actual values
const config = configTemplate
    .replace('https://your-project-id.supabase.co', supabaseUrl)
    .replace('your-anon-public-key-here', supabaseAnonKey);

// Write config.js
const outputPath = path.join(__dirname, 'config.js');
fs.writeFileSync(outputPath, config, 'utf8');

console.log('✅ config.js created successfully!');
console.log('   Supabase URL:', supabaseUrl);
console.log('   Anon Key:', supabaseAnonKey.substring(0, 20) + '...');
