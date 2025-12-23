const https = require('https');

const supabaseUrl = 'https://quplbkikhpcumjvzumkz.supabase.co';
const supabaseKey = 'sb_secret_AqHfQg3APZu_Q_9QUbYybg_k8E5BVA0';

// PostgREST provides an OpenAPI schema at the root
const url = `${supabaseUrl}/rest/v1/`;

const options = {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Accept': 'application/openapi+json'
  }
};

https.get(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const schema = JSON.parse(data);

      console.log('=== Available Tables ===\n');

      if (schema.definitions) {
        Object.keys(schema.definitions).forEach(tableName => {
          if (tableName === 'devices' || tableName === 'stations') {
            console.log(`\n=== Table: ${tableName} ===`);

            const tableSchema = schema.definitions[tableName];

            if (tableSchema.properties) {
              console.log('\nColumns:');
              Object.keys(tableSchema.properties).forEach(columnName => {
                const column = tableSchema.properties[columnName];
                const type = column.type || 'unknown';
                const format = column.format ? ` (${column.format})` : '';
                const description = column.description || '';

                console.log(`  ${columnName}: ${type}${format}${description ? ' - ' + description : ''}`);
              });
            }

            if (tableSchema.required) {
              console.log('\nRequired columns:');
              tableSchema.required.forEach(col => console.log(`  - ${col}`));
            }
          }
        });
      } else {
        console.log('Schema structure:', JSON.stringify(schema, null, 2));
      }
    } catch (err) {
      console.error('Error parsing response:', err.message);
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching schema:', err.message);
});
