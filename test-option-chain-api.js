async function testApi() {
    const testCases = [
        { symbol: 'NIFTY', expiry: '13-01-2026' }, // DD-MM-YYYY format
        { symbol: 'BANKNIFTY', expiry: '27-Jan-2026' }, // DD-MMM-YYYY format
        { symbol: 'FINNIFTY', expiry: null } // Auto-detect
    ];
    const baseUrl = 'http://localhost:3000';

    for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.symbol} with expiry ${testCase.expiry}...`);
        try {
            const url = `${baseUrl}/api/option-chain?symbol=${testCase.symbol}${testCase.expiry ? `&expiryDate=${testCase.expiry}` : ''}`;
            console.log(`Fetching: ${url}`);

            const response = await fetch(url);
            console.log(`Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const error = await response.json();
                console.error('Error Response:', error);
                continue;
            }

            const data = await response.json();
            console.log('Success:', data.success);
            console.log('Symbol:', data.symbol);
            console.log('Requested Expiry:', testCase.expiry);
            console.log('Final NSE Expiry:', data.expiryDate);
            console.log('Spot Price:', data.spotPrice);

            const strikes = Object.keys(data.optionChain || {});
            console.log('Strikes count in optionChain:', strikes.length);

            const recordsData = data.records?.data || data.records?.records?.data || [];
            console.log('Records data count:', recordsData.length);

        } catch (error) {
            console.error(`Fatal error testing ${testCase.symbol}:`, error.message);
        }
    }
}

testApi();
