// Node 18+ has built-in fetch

async function testNseIndices() {
    try {
        console.log('Fetching NSE indices...');
        const response = await fetch('http://localhost:3000/api/nse/indices');
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }
        const data = await response.json();
        const allIndices = data.data || [];

        console.log(`Found ${allIndices.length} indices.`);

        const targetIndices = [
            'NIFTY 50',
            'NIFTY BANK',
            'NIFTY FIN SERVICE',
            'INDIA VIX'
        ];

        targetIndices.forEach(name => {
            const index = allIndices.find(i => i.index === name || i.indexSymbol === name);
            if (index) {
                console.log(`✅ Found ${name}: Last=${index.last}, PrevClose=${index.previousClose}, Open=${index.open}`);
            } else {
                console.log(`❌ Could not find ${name}`);
            }
        });

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testNseIndices();
