// Quick test to see what NSE indices are available
fetch('https://www.nseindia.com/api/allIndices', {
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
})
    .then(res => res.json())
    .then(data => {
        console.log('\n=== Available NSE Indices ===\n');
        if (Array.isArray(data.data)) {
            data.data.forEach(item => {
                console.log(`- ${item.index || item.indexSymbol}`);
            });
        }
        console.log(`\nTotal: ${data.data?.length || 0} indices\n`);
    })
    .catch(err => console.error('Error:', err.message));
