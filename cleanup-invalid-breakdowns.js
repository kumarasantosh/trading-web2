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

// List of invalid stocks identified in verification
const invalidStocks = [
    'CIPLA',
    'PATANJALI',
    'KAYNES',
    'APOLLOHOSP',
    'DMART',
    'ABB',
    'ADANIENSOL',
    'MAZDOCK',
    'SUNPHARMA',
    'SAMMAANCAP',
    'SBICARD',
    'HDFCLIFE',
    'BDL',
    'NYKAA',
    'ZYDUSLIFE',
    'ONGC',
    'ITC',
    'GAIL',
    'POWERINDIA'
];

(async () => {
    console.log('\n=== Cleaning Up Invalid Breakdown Stocks ===\n');
    console.log(`Removing ${invalidStocks.length} invalid stocks from breakdown tables...\n`);

    let removedFromBreakdown = 0;
    let removedFromSnapshot = 0;

    // Remove from breakdown_stocks
    for (const symbol of invalidStocks) {
        const { error } = await supabase
            .from('breakdown_stocks')
            .delete()
            .eq('symbol', symbol);

        if (!error) {
            removedFromBreakdown++;
            console.log(`✅ Removed ${symbol} from breakdown_stocks`);
        } else {
            console.log(`⚠️  Failed to remove ${symbol} from breakdown_stocks:`, error.message);
        }
    }

    console.log('');

    // Remove from breakout_snapshots
    for (const symbol of invalidStocks) {
        const { error } = await supabase
            .from('breakout_snapshots')
            .delete()
            .eq('symbol', symbol);

        if (!error) {
            removedFromSnapshot++;
            console.log(`✅ Removed ${symbol} from breakout_snapshots`);
        } else {
            console.log(`⚠️  Failed to remove ${symbol} from breakout_snapshots:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   Removed from breakdown_stocks: ${removedFromBreakdown}/${invalidStocks.length}`);
    console.log(`   Removed from breakout_snapshots: ${removedFromSnapshot}/${invalidStocks.length}`);
    console.log('\n✅ Cleanup complete! Invalid breakdown stocks have been removed.');
    console.log('\n💡 Note: Tomorrow at 9:15 AM, all tables will be cleared automatically');
    console.log('   and fresh breakdown detection will start with correct data.\n');
})();
