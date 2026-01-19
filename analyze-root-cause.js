const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local file
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(
    envVars.NEXT_PUBLIC_SUPABASE_URL,
    envVars.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
    console.log('\n=== Root Cause Analysis ===\n');

    // Check when breakdown_stocks were last updated
    const { data: breakdownSample } = await supabase
        .from('breakdown_stocks')
        .select('symbol, breakdown_date, yesterday_low')
        .limit(1)
        .single();

    if (breakdownSample) {
        console.log('📅 Breakdown Detection Info:');
        console.log(`   Breakdown Date: ${breakdownSample.breakdown_date}`);
        console.log(`   Sample Stock: ${breakdownSample.symbol}`);
        console.log(`   Yesterday Low Used: ₹${breakdownSample.yesterday_low}`);
    }

    // Check the actual data in daily_high_low for the same stock
    if (breakdownSample) {
        const { data: dailyData } = await supabase
            .from('daily_high_low')
            .select('symbol, today_low, today_high, today_close')
            .eq('symbol', breakdownSample.symbol)
            .single();

        if (dailyData) {
            console.log(`\n📊 Current daily_high_low Data for ${breakdownSample.symbol}:`);
            console.log(`   Today Low: ₹${dailyData.today_low}`);
            console.log(`   Today High: ₹${dailyData.today_high}`);
            console.log(`   Today Close: ₹${dailyData.today_close}`);

            console.log(`\n❌ MISMATCH:`);
            console.log(`   Breakdown used: ₹${breakdownSample.yesterday_low}`);
            console.log(`   Actual in DB: ₹${dailyData.today_low}`);
            console.log(`   Difference: ₹${Math.abs(breakdownSample.yesterday_low - dailyData.today_low).toFixed(2)}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 INVESTIGATING THE TIMELINE:\n');

    // Check if there's a schema for tracking when data was updated
    console.log('1️⃣ Checking daily_high_low table structure...');
    const { data: sampleRow } = await supabase
        .from('daily_high_low')
        .select('*')
        .limit(1)
        .single();

    if (sampleRow) {
        console.log('   Columns in daily_high_low:');
        Object.keys(sampleRow).forEach(key => {
            console.log(`   - ${key}`);
        });
    }

    console.log('\n2️⃣ Checking breakout_snapshots for timestamp info...');
    const { data: snapshotSample } = await supabase
        .from('breakout_snapshots')
        .select('symbol, updated_at, prev_day_low, current_price')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    if (snapshotSample) {
        console.log(`   Last Update: ${snapshotSample.updated_at}`);
        console.log(`   Sample: ${snapshotSample.symbol}`);
        console.log(`   Prev Day Low Used: ₹${snapshotSample.prev_day_low}`);
        console.log(`   Current Price: ₹${snapshotSample.current_price}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 ROOT CAUSE ANALYSIS:\n');

    console.log('The issue occurs because of a TIMING PROBLEM:\n');

    console.log('Expected Flow:');
    console.log('  1. 3:30 PM - Market closes');
    console.log('  2. 3:30 PM - EOD capture runs → Updates daily_high_low with TODAY\'s data');
    console.log('  3. Next day 9:15 AM onwards - Breakout check uses YESTERDAY\'s data\n');

    console.log('What\'s Actually Happening:');
    console.log('  ❌ The daily_high_low table contains data labeled as "today_high/today_low"');
    console.log('  ❌ But it should represent PREVIOUS DAY\'s data for breakdown checks');
    console.log('  ❌ The data is being OVERWRITTEN instead of being preserved as "previous day"\n');

    console.log('Specific Problem:');
    console.log('  • Breakdown check ran at some point (e.g., 10:00 AM today)');
    console.log('  • It read daily_high_low which had OLD previous day values');
    console.log('  • LATER, the daily_high_low table was updated with NEW values');
    console.log('  • Now the breakdown records show stale "yesterday_low" values\n');

    console.log('Solutions:');
    console.log('  1. Add a DATE column to daily_high_low to track which trading day the data is for');
    console.log('  2. Ensure EOD capture runs BEFORE market opens next day');
    console.log('  3. Add a separate "previous_day_high_low" table that doesn\'t get overwritten');
    console.log('  4. Clear breakdown/breakout tables at market open to force fresh detection\n');

    console.log('='.repeat(80));
    console.log('\n');
})();
