const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)$/);
    if (match) {
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        env[match[1]] = value;
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log('Querying pcr_data for NIFTY on 2026-01-12...');

    // Query last 20 records
    const { data, error } = await supabase
        .from('pcr_data')
        .select('*')
        .eq('index_name', 'NIFTY')
        .order('captured_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} records for NIFTY.`);
    data.forEach(r => {
        console.log(`ID: ${r.id}, Captured: ${r.captured_at}, PCR: ${r.pcr_value}, Spot: ${r.spot_price}`);
    });

    // Check if the specific ID exists
    const targetId = '4ae4b1a2-ef0d-4858-ba92-409b20c6b96e';
    const { data: specific, error: sError } = await supabase
        .from('pcr_data')
        .select('*')
        .eq('id', targetId)
        .single();

    if (sError) {
        console.log(`Record ${targetId} not found by ID.`);
    } else {
        console.log('\nTarget Record Found:');
        console.log(JSON.stringify(specific, null, 2));
    }
}

debugData();
