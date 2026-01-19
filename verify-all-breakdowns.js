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
    console.log('\n=== Verifying All Breakdown Stocks ===\n');

    // Fetch all breakdown stocks
    const { data: breakdownStocks, error: breakdownError } = await supabase
        .from('breakdown_stocks')
        .select('*')
        .order('breakdown_percent', { ascending: false });

    if (breakdownError) {
        console.log('❌ Error fetching breakdown stocks:', breakdownError.message);
        return;
    }

    if (!breakdownStocks || breakdownStocks.length === 0) {
        console.log('✅ No breakdown stocks found in the database.');
        return;
    }

    console.log(`Found ${breakdownStocks.length} breakdown stock(s). Verifying each...\n`);
    console.log('='.repeat(80));

    let correctCount = 0;
    let incorrectCount = 0;
    const incorrectStocks = [];

    for (const breakdown of breakdownStocks) {
        console.log(`\n📊 ${breakdown.symbol}`);
        console.log(`   Breakdown Detection Data:`);
        console.log(`   - LTP: ₹${breakdown.ltp}`);
        console.log(`   - Yesterday Low (used): ₹${breakdown.yesterday_low}`);
        console.log(`   - Breakdown %: ${breakdown.breakdown_percent?.toFixed(2)}%`);

        // Fetch actual data from daily_high_low
        const { data: dailyData, error: dailyError } = await supabase
            .from('daily_high_low')
            .select('today_high, today_low, today_open, today_close')
            .eq('symbol', breakdown.symbol)
            .single();

        if (dailyError || !dailyData) {
            console.log(`   ⚠️  No data in daily_high_low table`);
            continue;
        }

        console.log(`   Daily High/Low Table Data:`);
        console.log(`   - High: ₹${dailyData.today_high}`);
        console.log(`   - Low: ₹${dailyData.today_low}`);
        console.log(`   - Open: ₹${dailyData.today_open}`);
        console.log(`   - Close: ₹${dailyData.today_close}`);

        // Verify the breakdown logic
        const isActualBreakdown = breakdown.ltp < dailyData.today_low;
        const dataMatches = breakdown.yesterday_low === dailyData.today_low;

        console.log(`\n   Verification:`);

        if (!dataMatches) {
            console.log(`   ❌ DATA MISMATCH!`);
            console.log(`      Breakdown used: ₹${breakdown.yesterday_low}`);
            console.log(`      Actual low: ₹${dailyData.today_low}`);
            console.log(`      Difference: ₹${Math.abs(breakdown.yesterday_low - dailyData.today_low).toFixed(2)}`);
        } else {
            console.log(`   ✅ Data matches`);
        }

        if (isActualBreakdown) {
            console.log(`   ✅ Valid breakdown: ${breakdown.ltp} < ${dailyData.today_low}`);
            const actualPercent = ((dailyData.today_low - breakdown.ltp) / dailyData.today_low) * 100;
            console.log(`      Actual breakdown %: ${actualPercent.toFixed(2)}%`);
            correctCount++;
        } else {
            console.log(`   ❌ INVALID breakdown: ${breakdown.ltp} >= ${dailyData.today_low}`);
            console.log(`      This stock should NOT be in breakdown list!`);
            incorrectCount++;
            incorrectStocks.push({
                symbol: breakdown.symbol,
                ltp: breakdown.ltp,
                usedLow: breakdown.yesterday_low,
                actualLow: dailyData.today_low,
                reason: `LTP (₹${breakdown.ltp}) is above actual low (₹${dailyData.today_low})`
            });
        }

        console.log('   ' + '-'.repeat(76));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📈 SUMMARY:');
    console.log(`   Total breakdown stocks: ${breakdownStocks.length}`);
    console.log(`   ✅ Valid breakdowns: ${correctCount}`);
    console.log(`   ❌ Invalid breakdowns: ${incorrectCount}`);

    if (incorrectStocks.length > 0) {
        console.log('\n⚠️  STOCKS TO REMOVE FROM BREAKDOWN LIST:');
        incorrectStocks.forEach((stock, index) => {
            console.log(`   ${index + 1}. ${stock.symbol}`);
            console.log(`      ${stock.reason}`);
            console.log(`      Used low: ₹${stock.usedLow}, Actual low: ₹${stock.actualLow}`);
        });
    }

    console.log('\n');
})();
