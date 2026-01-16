const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSnapshots() {
    console.log('Checking option_chain_snapshots table...');

    // Get counts for today
    const today = new Date().toISOString().split('T')[0];

    const { data, error, count } = await supabase
        .from('option_chain_snapshots')
        .select('*', { count: 'exact', head: true })
        .gte('captured_at', today);

    if (error) {
        console.error('Error querying snapshots:', error);
        return;
    }

    console.log(`Found ${count} snapshots for today (${today}).`);

    // Get recent entries
    const { data: recent, error: recentError } = await supabase
        .from('option_chain_snapshots')
        .select('symbol, expiry_date, captured_at')
        .order('captured_at', { ascending: false })
        .limit(5);

    if (recentError) {
        console.log('Error fetching recent:', recentError);
    } else {
        console.log('Most recent snapshots:');
        console.table(recent);
    }
}

checkSnapshots();
