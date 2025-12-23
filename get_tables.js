const supabaseUrl = 'https://quplbkikhpcumjvzumkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cGxia2lraHBjdW1qdnp1bWt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE4MTg4OCwiZXhwIjoyMDgxNzU3ODg4fQ.cECAUG1gDB87DNk6ctfOlxT5AGEZCbRbJFVp5eWiLtk';

async function getTables() {
  try {
    // Use Supabase Management API to get schema
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      console.error('Error fetching schema:', response.statusText);
      return;
    }

    const text = await response.text();
    console.log('Available endpoints (tables):');

    // Parse OpenAPI spec to find tables
    try {
      const schema = JSON.parse(text);
      if (schema.definitions) {
        const tables = Object.keys(schema.definitions).filter(key => !key.startsWith('_'));
        tables.forEach(table => console.log(`  - ${table}`));
      } else {
        console.log('Raw response:', text);
      }
    } catch (e) {
      console.log('Response:', text);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

getTables();
