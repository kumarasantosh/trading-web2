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
    console.log('\n=== Investigating Data Mismatch ===\n');

    // Check ALL records for DIXON in daily_high_low
    const { data: allRecords, error } = await supabase
        .from('daily_high_low')
        .select('*')
        .eq('symbol', 'DIXON');

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    console.log(`Found ${allRecords?.length || 0} record(s) for DIXON in daily_high_low:\n`);

    allRecords?.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  High: ₹${record.today_high}`);
        console.log(`  Low: ₹${record.today_low}`);
        console.log(`  Open: ₹${record.today_open}`);
        console.log(`  Close: ₹${record.today_close}`);
        console.log(`  Sector: ${record.sector || 'N/A'}`);
        console.log('');
    });

    // Check what's in breakdown_stocks
    const { data: breakdownRecord } = await supabase
        .from('breakdown_stocks')
        .select('*')
        .eq('symbol', 'DIXON')
        .single();

    if (breakdownRecord) {
        console.log('=== Breakdown Record ===');
        console.log(`  LTP when detected: ₹${breakdownRecord.ltp}`);
        console.log(`  Yesterday Low used: ₹${breakdownRecord.yesterday_low}`);
        console.log(`  Yesterday Open: ₹${breakdownRecord.yesterday_open}`);
        console.log(`  Yesterday Close: ₹${breakdownRecord.yesterday_close}`);
        console.log(`  Breakdown Date: ${breakdownRecord.breakdown_date}`);
        console.log('');
    }

    // Compare
    if (allRecords && allRecords.length > 0 && breakdownRecord) {
        const dailyData = allRecords[0];
        console.log('=== COMPARISON ===');
        console.log(`Daily High/Low Table Low: ₹${dailyData.today_low}`);
        console.log(`Breakdown Detection Used: ₹${breakdownRecord.yesterday_low}`);

        if (dailyData.today_low !== breakdownRecord.yesterday_low) {
            console.log('\n❌ MISMATCH DETECTED!');
            console.log(`The breakdown check used ₹${breakdownRecord.yesterday_low} as "yesterday's low"`);
            console.log(`But the daily_high_low table shows ₹${dailyData.today_low}`);
            console.log('\nPossible causes:');
            console.log('1. The daily_high_low table was updated AFTER the breakdown check ran');
            console.log('2. The breakdown check is reading from a different/cached data source');
            console.log('3. There was a data update between the two operations');
        } else {
            console.log('\n✅ Data matches - no mismatch');
        }
    }

    console.log('\n');
})();
