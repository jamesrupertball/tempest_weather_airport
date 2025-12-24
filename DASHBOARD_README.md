# 00MN Weather Dashboard

A mobile-first weather dashboard for pilots at Airlake Airport (00MN) in Lakeville, Minnesota. Displays real-time wind information with runway-specific headwind and crosswind calculations.

## Features

### Wind Data View
- **Current Wind Display**: Speed, direction, and gusts in knots
- **Visual Compass Rose**: Rotating wind arrow showing wind direction
- **Runway Wind Components**: Automatic headwind/crosswind calculations for runways 24 and 06

### Weather Observations View
- **Temperature**: Displayed in Fahrenheit with real-time readings
- **Barometric Pressure**: Shown in inches of mercury (inHg)
- **Relative Humidity**: Percentage humidity display
- **Density Altitude**: Calculated density altitude with delta from field elevation
  - Color-coded performance indicator (green = better, red = worse)
  - Based on field elevation of 1,391 ft MSL

### General Features
- **Dual View Toggle**: Simple button to switch between Wind and Weather Observations
- **Mobile-Optimized**: Designed for quick viewing on phones at the airport
- **Auto-Refresh**: Updates every 60 seconds with countdown timer
- **Last Updated Indicator**: Shows both Zulu and local time with relative timestamp

## Quick Start

### 1. Configure Supabase Credentials

Open [app.js](app.js) and replace the placeholder credentials (lines 15-16):

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';  // Replace with your URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';  // Replace with your key
```

**Where to find your credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" and "anon/public" key

### 2. Enable Public Access to Weather Data

Your Supabase database needs to allow anonymous reads from the `observations_tempest` table. Run this SQL in the Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER TABLE observations_tempest ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read weather data
CREATE POLICY "Allow public read access to weather data"
ON observations_tempest
FOR SELECT
TO anon
USING (true);
```

### 3. Test Locally

Open [index.html](index.html) in your web browser:

```bash
# On Windows - open with default browser
start index.html

# On Mac
open index.html

# On Linux
xdg-open index.html
```

Or use a local web server (recommended for testing):

```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server installed globally)
npx http-server

# Then open http://localhost:8000 in your browser
```

### 4. Deploy to Vercel

1. Create a [Vercel account](https://vercel.com)
2. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

3. Deploy your site:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Link to existing project or create new one
   - Use the current directory
   - Override settings: **No** (defaults are fine for static site)

5. Your dashboard will be live at: `https://your-project.vercel.app`

**Alternative: Deploy via GitHub**
1. Push your code to GitHub
2. Connect your repository to Vercel via the [Vercel dashboard](https://vercel.com/dashboard)
3. Vercel will auto-deploy on every push

## File Structure

```
00MN_weather_reporting/
├── index.html              # Main HTML structure
├── style.css               # Mobile-first CSS styling
├── app.js                  # JavaScript logic and Supabase integration
├── config.example.js       # Example configuration file
├── DASHBOARD_README.md     # This file
└── tempest_weather.py      # Data collection script (runs separately)
```

## How It Works

### Wind Calculations

The dashboard calculates headwind and crosswind components using trigonometry:

**Headwind Component (parallel to runway):**
```
headwind = cos(angle_difference) × wind_speed
```
- Positive value = headwind (good for landing)
- Negative value = tailwind (caution)

**Crosswind Component (perpendicular to runway):**
```
crosswind = sin(angle_difference) × wind_speed
```
- Always shown as positive magnitude
- Direction indicated as L (left) or R (right)

**Example:**
- Wind: 270° at 10 knots (west wind)
- Runway 24: heading 240°
- Angle difference: 270° - 240° = 30°
- Headwind: cos(30°) × 10kt = **8.7kt** ✓
- Crosswind: sin(30°) × 10kt = **5.0kt from right**

### Data Source

The dashboard queries the `observations_tempest` table in your Supabase database:
- Table: `observations_tempest`
- Columns: `wind_avg`, `wind_gust`, `wind_direction`, `timestamp`, `air_temperature`, `pressure`, `relative_humidity`
- Always fetches the most recent observation

**Unit Conversions:**
- Wind speeds: m/s → knots (1 m/s = 1.94384 knots)
- Temperature: Celsius → Fahrenheit ((C × 9/5) + 32)
- Pressure: Millibars → inches of mercury (1 mb = 0.02953 inHg)

### Density Altitude Calculation

Density altitude is calculated using the standard aviation formula:

1. **Pressure Altitude** = Field Elevation + ((29.92 - Current Pressure) × 1000)
2. **ISA Temperature** at pressure altitude = 59°F - (3.5°F × (Pressure Altitude / 1000))
3. **Temperature Deviation** = Actual Temperature - ISA Temperature
4. **Density Altitude** = Pressure Altitude + (120 × Temperature Deviation)

This calculation helps pilots understand aircraft performance:
- Higher density altitude = reduced aircraft performance (longer takeoff roll, reduced climb rate)
- Lower density altitude = improved aircraft performance

## Customization

### Change Runways

If you need different runway headings, edit [app.js](app.js) (lines 18-27):

```javascript
const RUNWAYS = {
    runway24: {
        heading: 240,  // Change to your runway heading
        name: '24'     // Change to your runway number
    },
    runway06: {
        heading: 60,   // Change to your runway heading
        name: '06'     // Change to your runway number
    }
};
```

### Adjust Refresh Rate

Change the auto-refresh interval in [app.js](app.js) (line 30):

```javascript
const REFRESH_INTERVAL = 60000; // milliseconds (60000 = 60 seconds)
```

### Modify Colors/Styling

All styling is in [style.css](style.css):
- Wind arrow color: `.arrow-shaft` and `.arrow-head` (red gradient)
- Headwind color: `.component-value.headwind` (green)
- Tailwind color: `.component-value.tailwind` (red)
- Crosswind color: `.component-value.crosswind` (orange)

## Troubleshooting

### "Configuration Error - Check credentials"
- Verify you've replaced the placeholder Supabase URL and key in [app.js](app.js)
- Check that credentials are correct (no extra spaces or quotes)

### "No weather data available"
- Ensure your data collection script ([tempest_weather.py](tempest_weather.py)) is running
- Check that the `observations_tempest` table has data
- Verify the table name matches exactly (case-sensitive)

### "Error: Failed to fetch"
- Check browser console for CORS errors
- Verify Row Level Security policy allows public SELECT access
- Ensure Supabase URL is correct and project is active

### Wind arrow not rotating
- Check browser console for JavaScript errors
- Verify wind_direction data is a valid number (0-360)

### Data not updating
- Check browser console for errors
- Verify page visibility (auto-refresh pauses when tab is hidden)
- Try manually refreshing the page

## Security Notes

- The `SUPABASE_ANON_KEY` is safe to expose publicly (it's designed for browser use)
- Row Level Security (RLS) protects your data - only enable SELECT for weather data
- Never commit real credentials to public repositories
- Consider using environment variables for sensitive data in production

## Mobile Performance

The dashboard is optimized for mobile devices:
- Minimal JavaScript and CSS
- Efficient Supabase queries (fetches only latest record)
- Auto-pause when page is hidden (saves battery)
- Responsive design works on screens down to 320px width

## Browser Compatibility

Tested and working on:
- Safari (iOS)
- Chrome (Android/iOS)
- Firefox (Android)
- Edge (mobile)

Requires modern browser with JavaScript enabled and CSS Grid support (all browsers since ~2017).

## Future Enhancements

Ideas for future development:
- [x] Add temperature and humidity display ✓
- [x] Add barometric pressure display ✓
- [x] Add density altitude calculation ✓
- [ ] Show trend arrows (improving/deteriorating conditions)
- [ ] Push notifications for significant wind changes
- [ ] Historical wind graph
- [ ] METAR/TAF integration
- [ ] Multiple airport support
- [ ] Dark mode for night operations
- [ ] Dew point calculation
- [ ] Cloud base estimation

## License

MIT License - Free to use and modify as needed.

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify data collection is working ([tempest_weather.py](tempest_weather.py))
3. Review Supabase logs in the dashboard
4. Open an issue on GitHub

## Related Files

- [tempest_weather.py](tempest_weather.py) - Python script for collecting weather data from Tempest API
- [README.md](README.md) - Main repository documentation for data collection
- [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md) - Automated data collection with Supabase

---

**Happy flying! ✈️**
