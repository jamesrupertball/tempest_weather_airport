# Deployment Guide

## Local Development Setup

1. **Copy the configuration template:**
   ```bash
   cp config.example.js config.js
   ```

2. **Edit `config.js` and add your Supabase credentials:**
   - Get your Supabase URL and anon key from [https://app.supabase.com](https://app.supabase.com)
   - Update the values in `config.js`

3. **Run a local web server:**
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using Node.js
   npx serve
   ```

4. **Open in browser:**
   Navigate to `http://localhost:8000`

## Deploying to Vercel

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

   When prompted:
   - Set up and deploy: `Y`
   - Which scope: Choose your account
   - Link to existing project: `N` (for first deployment)
   - Project name: `00mn-weather` (or your preferred name)
   - In which directory: `.` (current directory)
   - Override settings: `N`

4. **Add environment variables in Vercel Dashboard:**
   - Go to your project in Vercel Dashboard
   - Navigate to Settings → Environment Variables
   - Add the following variables:
     - `SUPABASE_URL`: Your Supabase URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon key

   **Important:** After adding environment variables, you need to redeploy for them to take effect.

5. **Create a build script to inject environment variables:**

   Since this is a static site, we need to replace the placeholder values in config.js during build.

   Create a `build.js` file (already set up in this repo) that replaces the values.

6. **Deploy to production:**
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Git Integration (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git add .gitignore config.example.js vercel.json app.js index.html
   git commit -m "Secure Supabase credentials and prepare for deployment"
   git push origin master
   ```

2. **Import project in Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure the project:
     - Framework Preset: Other
     - Build Command: `node build.js` (if using build script)
     - Output Directory: `.` (current directory)

3. **Add environment variables:**
   - In the import wizard, or later in Settings → Environment Variables
   - Add:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`

4. **Deploy!**
   Vercel will automatically deploy your site and redeploy on every push to master.

## Build Script for Environment Variable Injection

The `build.js` script replaces placeholders in `config.example.js` with actual environment variables from Vercel and creates `config.js` at build time.

This ensures:
- ✅ No credentials in Git repository
- ✅ Same codebase works locally and in production
- ✅ Easy to update credentials without code changes

## Security Notes

- `config.js` is in `.gitignore` and should NEVER be committed
- Only `config.example.js` (with placeholders) should be in version control
- The Supabase anon key is safe to expose in client-side code (it's designed for that)
- Use Row Level Security (RLS) in Supabase to protect your data
- Never commit the service role key to any repository

## Troubleshooting

**Issue: "config is not defined" error**
- Make sure `config.js` exists (copy from `config.example.js`)
- Ensure config.js is loaded before app.js in index.html

**Issue: No data loading**
- Check browser console for errors
- Verify Supabase credentials are correct
- Ensure your Supabase table has public read access or appropriate RLS policies

**Issue: Works locally but not on Vercel**
- Check that environment variables are set in Vercel Dashboard
- Verify build script ran successfully
- Check Vercel deployment logs for errors
