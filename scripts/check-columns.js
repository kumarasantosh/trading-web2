const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) { console.log('Missing env'); process.exit(1); }

const supabase = createClient(url, key);

async function check() {
    console.log('Checking NULLs...');
    // Check count of nulls
    const { count, error } = await supabase.from('breakout_snapshots')
        .select('*', { count: 'exact', head: true })
        .is('prev_day_close', null);

    if (error) console.log('Error counting nulls:', error.message);
    else console.log(`Rows with prev_day_close = NULL: ${count}`);

    // Fetch samples
    const { data: samples } = await supabase.from('breakout_snapshots')
        .select('symbol, prev_day_close, prev_day_high, prev_day_low')
        .limit(5);

    console.log('Samples:', samples);
}

check();
