const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quplbkikhpcumjvzumkz.supabase.co';
const supabaseKey = 'sb_secret_AqHfQg3APZu_Q_9QUbYybg_k8E5BVA0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTableSchema(tableName) {
  try {
    // Get columns information for the specified table
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    if (error) {
      console.error(`Error accessing ${tableName}:`, error.message);
      return null;
    }

    // Also try to get one row to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    console.log(`\n=== Table: ${tableName} ===`);

    if (sampleData && sampleData.length > 0) {
      console.log('\nColumns:');
      Object.keys(sampleData[0]).forEach(column => {
        const value = sampleData[0][column];
        const type = value === null ? 'null' : typeof value;
        console.log(`  - ${column}: ${type}`);
      });

      console.log('\nSample data:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    } else {
      console.log('Table is empty - cannot infer column types from data');
    }

    return data;
  } catch (err) {
    console.error(`Error getting schema for ${tableName}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('Fetching schema for devices and stations tables...\n');

  await getTableSchema('devices');
  await getTableSchema('stations');
}

main();
