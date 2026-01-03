/**
 * Script to check Supabase data at different times
 * Run with: node scripts/check-supabase-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSectorSnapshots() {
  console.log('\n=== Checking Sector Snapshots ===\n');
  
  try {
    // Get all unique captured_at times
    const { data: times, error: timesError } = await supabase
      .from('sector_snapshots')
      .select('captured_at')
      .order('captured_at', { ascending: false });

    if (timesError) {
      console.error('Error fetching times:', timesError);
      return;
    }

    // Get unique timestamps
    const uniqueTimes = [...new Set(times.map(t => t.captured_at))].slice(0, 10);
    
    console.log(`Found ${uniqueTimes.length} unique timestamps (showing first 10):\n`);
    
    for (const timestamp of uniqueTimes) {
      const { data: snapshots, error } = await supabase
        .from('sector_snapshots')
        .select('*')
        .eq('captured_at', timestamp)
        .order('sector_name', { ascending: true });

      if (error) {
        console.error(`Error fetching data for ${timestamp}:`, error);
        continue;
      }

      console.log(`\n📅 Time: ${timestamp}`);
      console.log(`   Sectors: ${snapshots.length}`);
      console.log(`   Sample sectors:`);
      snapshots.slice(0, 5).forEach(snap => {
        console.log(`     - ${snap.sector_name}: Last=${snap.last_price}, Change=${snap.change_percent.toFixed(2)}%`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function checkOptionChainSnapshots() {
  console.log('\n\n=== Checking Option Chain Snapshots ===\n');
  
  try {
    const { data: snapshots, error } = await supabase
      .from('option_chain_snapshots')
      .select('symbol, expiry_date, captured_at, nifty_spot')
      .order('captured_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`Found ${snapshots.length} option chain snapshots:\n`);
    snapshots.forEach(snap => {
      console.log(`📅 ${snap.captured_at} | Symbol: ${snap.symbol} | Expiry: ${snap.expiry_date} | Nifty Spot: ${snap.nifty_spot}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testAPICall(timestamp) {
  console.log(`\n\n=== Testing API Call for ${timestamp} ===\n`);
  
  // Calculate ±5 minute window
  const time = new Date(timestamp);
  const start = new Date(time);
  start.setMinutes(start.getMinutes() - 5);
  const end = new Date(time);
  end.setMinutes(end.getMinutes() + 5);

  const url = `http://localhost:3000/api/snapshots?type=sector&start=${start.toISOString()}&end=${end.toISOString()}`;
  console.log(`API URL: ${url}\n`);

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.snapshots) {
      console.log(`Returned ${data.snapshots.length} sectors:`);
      data.snapshots.slice(0, 5).forEach(snap => {
        console.log(`  - ${snap.sector_name}: Last=${snap.last_price}, Change=${snap.change_percent?.toFixed(2)}%`);
      });
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('API Error:', error.message);
    console.log('Note: Make sure the Next.js dev server is running (npm run dev)');
  }
}

async function main() {
  await checkSectorSnapshots();
  await checkOptionChainSnapshots();
  
  // Test API call with the most recent timestamp
  const { data: recent } = await supabase
    .from('sector_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recent) {
    await testAPICall(recent.captured_at);
  }
}

main().catch(console.error);

