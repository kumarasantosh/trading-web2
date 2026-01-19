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

const currentPrice = 11020.00;
const symbol = 'DIXON';

(async () => {
    console.log(`\n=== Testing Breakout/Breakdown for ${symbol} ===`);
    console.log(`Current Price (LTP): ₹${currentPrice}`);
    console.log(`Change: -₹35.00 (-0.32%)\n`);

    // Fetch previous day data
    const { data, error } = await supabase
        .from('daily_high_low')
        .select('symbol, today_high, today_low, today_open, today_close')
        .eq('symbol', symbol)
        .single();

    if (error) {
        console.log('❌ Error fetching data:', error.message);
        console.log('\nNote: Previous day data might not be available in the database.');
        console.log('Run the EOD (End of Day) capture to populate this data.');
        return;
    }

    if (!data) {
        console.log(`❌ No previous day data found for ${symbol}`);
        console.log('\nNote: Run the EOD capture to populate daily_high_low table.');
        return;
    }

    console.log('📊 Previous Day Data:');
    console.log(`   High:  ₹${data.today_high}`);
    console.log(`   Low:   ₹${data.today_low}`);
    console.log(`   Open:  ₹${data.today_open}`);
    console.log(`   Close: ₹${data.today_close}\n`);

    // Check for BREAKOUT
    if (currentPrice > data.today_high) {
        const breakoutPercent = ((currentPrice - data.today_high) / data.today_high) * 100;
        console.log('🚀 BREAKOUT DETECTED!');
        console.log(`   Current Price (₹${currentPrice}) > Previous High (₹${data.today_high})`);
        console.log(`   Breakout Percentage: ${breakoutPercent.toFixed(2)}%`);
    }
    // Check for BREAKDOWN
    else if (currentPrice < data.today_low) {
        const breakdownPercent = ((data.today_low - currentPrice) / data.today_low) * 100;
        console.log('🔻 BREAKDOWN DETECTED!');
        console.log(`   Current Price (₹${currentPrice}) < Previous Low (₹${data.today_low})`);
        console.log(`   Breakdown Percentage: ${breakdownPercent.toFixed(2)}%`);
    }
    // Normal trading range
    else {
        console.log('📈 Normal Trading Range');
        console.log(`   Previous Low (₹${data.today_low}) < Current Price (₹${currentPrice}) < Previous High (₹${data.today_high})`);
        console.log('   No breakout or breakdown detected.');

        const distanceToHigh = ((data.today_high - currentPrice) / currentPrice) * 100;
        const distanceToLow = ((currentPrice - data.today_low) / currentPrice) * 100;
        console.log(`\n   Distance to Breakout: ${distanceToHigh.toFixed(2)}% (needs to rise ₹${(data.today_high - currentPrice).toFixed(2)})`);
        console.log(`   Distance to Breakdown: ${distanceToLow.toFixed(2)}% (needs to fall ₹${(currentPrice - data.today_low).toFixed(2)})`);
    }

    console.log('\n');
})();
