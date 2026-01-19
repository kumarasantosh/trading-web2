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
    console.log('\n=== Checking DIXON in Breakdown Tables ===\n');

    // Check breakdown_stocks table
    const { data: breakdownData, error: breakdownError } = await supabase
        .from('breakdown_stocks')
        .select('*')
        .eq('symbol', 'DIXON');

    if (breakdownError) {
        console.log('❌ Error fetching breakdown_stocks:', breakdownError.message);
    } else if (breakdownData && breakdownData.length > 0) {
        console.log('📋 Found in breakdown_stocks table:');
        breakdownData.forEach(record => {
            console.log(`   Symbol: ${record.symbol}`);
            console.log(`   LTP: ₹${record.ltp}`);
            console.log(`   Yesterday Low: ₹${record.yesterday_low}`);
            console.log(`   Breakdown %: ${record.breakdown_percent?.toFixed(2)}%`);
            console.log(`   Date: ${record.breakdown_date}`);
            console.log('');
        });
    } else {
        console.log('✅ DIXON not found in breakdown_stocks table');
    }

    // Check breakout_snapshots table
    const { data: snapshotData, error: snapshotError } = await supabase
        .from('breakout_snapshots')
        .select('*')
        .eq('symbol', 'DIXON');

    if (snapshotError) {
        console.log('❌ Error fetching breakout_snapshots:', snapshotError.message);
    } else if (snapshotData && snapshotData.length > 0) {
        console.log('📋 Found in breakout_snapshots table:');
        snapshotData.forEach(record => {
            console.log(`   Symbol: ${record.symbol}`);
            console.log(`   Current Price: ₹${record.current_price}`);
            console.log(`   Prev Day High: ₹${record.prev_day_high}`);
            console.log(`   Prev Day Low: ₹${record.prev_day_low}`);
            console.log(`   Is Breakout: ${record.is_breakout}`);
            console.log(`   Is Breakdown: ${record.is_breakdown}`);
            console.log(`   Breakout %: ${record.breakout_percentage?.toFixed(2)}%`);
            console.log(`   Breakdown %: ${record.breakdown_percentage?.toFixed(2)}%`);
            console.log(`   Updated At: ${record.updated_at}`);
            console.log('');
        });
    } else {
        console.log('✅ DIXON not found in breakout_snapshots table');
    }

    // Check daily_high_low for reference
    const { data: dailyData } = await supabase
        .from('daily_high_low')
        .select('*')
        .eq('symbol', 'DIXON')
        .single();

    if (dailyData) {
        console.log('📊 Reference - daily_high_low table:');
        console.log(`   High: ₹${dailyData.today_high}`);
        console.log(`   Low: ₹${dailyData.today_low}`);
        console.log(`   Open: ₹${dailyData.today_open}`);
        console.log(`   Close: ₹${dailyData.today_close}`);
    }

    console.log('\n');
})();
