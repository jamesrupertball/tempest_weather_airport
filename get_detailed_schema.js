const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quplbkikhpcumjvzumkz.supabase.co';
const supabaseKey = 'sb_secret_AqHfQg3APZu_Q_9QUbYybg_k8E5BVA0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getDetailedSchema(tableName) {
  try {
    // Query information_schema to get column details
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.error(`RPC error for ${tableName}:`, error.message);

      // Try alternative method using direct SQL query
      console.log(`Trying alternative method for ${tableName}...`);

      const query = `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `;

      // This won't work without RPC, so let's just describe what we know
      console.log(`\n=== Table: ${tableName} ===`);
      console.log('Cannot query schema details without RPC function.');
      console.log('The table exists but we need direct database access to see its structure.');

      return null;
    }

    console.log(`\n=== Table: ${tableName} ===`);
    console.log('\nColumns:');

    if (data && data.length > 0) {
      data.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';

        console.log(`  ${col.column_name}: ${col.data_type}${maxLength} ${nullable}${defaultVal}`);
      });
    }

    return data;
  } catch (err) {
    console.error(`Error for ${tableName}:`, err.message);
    return null;
  }
}

async function listAllTables() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

    if (error) {
      console.log('Cannot list tables via RPC.');
      return ['devices', 'stations'];
    }

    console.log('Available tables:');
    data.forEach(row => console.log(`  - ${row.table_name}`));
    console.log('');

    return data.map(row => row.table_name);
  } catch (err) {
    return ['devices', 'stations'];
  }
}

async function main() {
  console.log('Fetching detailed schema information...\n');

  const tables = await listAllTables();

  for (const table of ['devices', 'stations']) {
    await getDetailedSchema(table);
  }
}

main();
