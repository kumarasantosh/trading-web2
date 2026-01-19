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
    console.log('\n=== Timeline Investigation ===\n');

    // Check captured_at in daily_high_low
    const { data: dailyHighLow } = await supabase
        .from('daily_high_low')
        .select('symbol, captured_at, captured_date, today_low')
        .eq('symbol', 'DMART')
        .single();

    if (dailyHighLow) {
        console.log('📊 daily_high_low for DMART:');
        console.log(`   Captured At: ${dailyHighLow.captured_at}`);
        console.log(`   Captured Date: ${dailyHighLow.captured_date}`);
        console.log(`   Today Low: ₹${dailyHighLow.today_low}`);
    }

    // Check when breakdown was detected
    const { data: breakdown } = await supabase
        .from('breakout_snapshots')
        .select('symbol, updated_at, prev_day_low')
        .eq('symbol', 'DMART')
        .single();

    if (breakdown) {
        console.log(`\n📅 Breakdown Detection for DMART:`);
        console.log(`   Detected At: ${breakdown.updated_at}`);
        console.log(`   Prev Day Low Used: ₹${breakdown.prev_day_low}`);
    }

    if (dailyHighLow && breakdown) {
        const captureTime = new Date(dailyHighLow.captured_at);
        const detectionTime = new Date(breakdown.updated_at);

        console.log(`\n⏰ TIMELINE:`);
        console.log(`   1. Breakdown detected: ${detectionTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        console.log(`      → Used prev_day_low: ₹${breakdown.prev_day_low}`);
        console.log(`   2. daily_high_low updated: ${captureTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        console.log(`      → New today_low: ₹${dailyHighLow.today_low}`);

        if (detectionTime < captureTime) {
            console.log(`\n✅ CONFIRMED: Breakdown check ran BEFORE daily_high_low was updated`);
            console.log(`   Time difference: ${Math.round((captureTime - detectionTime) / 1000 / 60)} minutes`);
        } else {
            console.log(`\n⚠️  Breakdown check ran AFTER daily_high_low update (unusual)`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 THE PROBLEM:\n');
    console.log('The daily_high_low table has a "captured_at" field, but it represents');
    console.log('when the data was CAPTURED, not which TRADING DAY it belongs to.\n');

    console.log('Example:');
    console.log('  • Friday 3:30 PM: EOD capture saves Friday\'s high/low');
    console.log('  • Saturday/Sunday: No market, no updates');
    console.log('  • Monday 10:00 AM: Breakdown check runs');
    console.log('    → Reads daily_high_low (still has Friday\'s data) ✅ CORRECT');
    console.log('  • Monday 3:30 PM: EOD capture OVERWRITES with Monday\'s data');
    console.log('    → Now daily_high_low has Monday\'s data');
    console.log('    → But breakdown records still reference Friday\'s values ❌ STALE\n');

    console.log('The breakdown check at 10:00 AM used the CORRECT previous day data,');
    console.log('but when we check NOW (after 3:30 PM), the daily_high_low table has');
    console.log('been updated with TODAY\'s data, making the breakdown records appear wrong.\n');

    console.log('='.repeat(80));
    console.log('\n');
})();
