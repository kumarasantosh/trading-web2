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
    console.log('Checking breakout_snapshots table...');

    const { data, error } = await supabase
        .from('breakout_snapshots')
        .select('symbol, updated_at, is_breakout, is_breakdown');

    if (error) {
        console.error('Error querying snapshots:', error);
        return;
    }

    console.log(`Found ${data.length} total snapshots.`);

    const now = new Date();
    const timestamps = data.map(d => new Date(d.updated_at));
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));

    console.log(`Current Time (JS): ${now.toISOString()}`);
    console.log(`Min updated_at: ${minTime.toISOString()}`);
    console.log(`Max updated_at: ${maxTime.toISOString()}`);

    const freshCount = data.filter(d => (now - new Date(d.updated_at)) < 15 * 60 * 1000).length;
    console.log(`Fresher than 15 mins: ${freshCount}`);

    const breakdowns = data.filter(s => s.is_breakdown);
    console.log(`Total Breakdowns: ${breakdowns.length}`);

    const freshBreakdowns = breakdowns.filter(d => (now - new Date(d.updated_at)) < 15 * 60 * 1000);
    console.log(`Fresh Breakdowns (last 15m): ${freshBreakdowns.length}`);
}

checkSnapshots();
