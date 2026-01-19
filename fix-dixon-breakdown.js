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
    console.log('\n=== Fixing DIXON Breakdown Entry ===\n');

    // Delete from breakdown_stocks
    const { error: deleteBreakdown } = await supabase
        .from('breakdown_stocks')
        .delete()
        .eq('symbol', 'DIXON');

    if (deleteBreakdown) {
        console.log('❌ Error deleting from breakdown_stocks:', deleteBreakdown.message);
    } else {
        console.log('✅ Removed DIXON from breakdown_stocks');
    }

    // Delete from breakout_snapshots
    const { error: deleteSnapshot } = await supabase
        .from('breakout_snapshots')
        .delete()
        .eq('symbol', 'DIXON');

    if (deleteSnapshot) {
        console.log('❌ Error deleting from breakout_snapshots:', deleteSnapshot.message);
    } else {
        console.log('✅ Removed DIXON from breakout_snapshots');
    }

    console.log('\n✅ DIXON has been removed from breakdown listings');
    console.log('The next breakout check (during market hours) will re-evaluate with correct data.\n');
})();
