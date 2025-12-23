const supabaseUrl = 'https://quplbkikhpcumjvzumkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cGxia2lraHBjdW1qdnp1bWt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE4MTg4OCwiZXhwIjoyMDgxNzU3ODg4fQ.cECAUG1gDB87DNk6ctfOlxT5AGEZCbRbJFVp5eWiLtk';

async function getTableSchema() {
  const tables = ['observations_tempest', 'stations', 'devices', 'precipitation_events', 'lightning_strikes'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          console.log('Columns:', Object.keys(data[0]).join(', '));
          console.log('Sample data:', JSON.stringify(data[0], null, 2));
        } else {
          console.log('Table exists but is empty');

          // Try to get schema from OpenAPI
          const schemaResp = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });

          if (schemaResp.ok) {
            const schema = await schemaResp.json();
            if (schema.definitions && schema.definitions[table]) {
              console.log('Schema properties:', Object.keys(schema.definitions[table].properties).join(', '));
            }
          }
        }
      } else {
        console.log('Error:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

getTableSchema();
