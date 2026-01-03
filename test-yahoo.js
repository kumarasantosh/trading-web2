// Standalone test script to verify Yahoo Finance API
async function testYahoo() {
    const symbol = 'RELIANCE';
    const exchange = 'NSE';
    const suffix = exchange === 'NSE' ? '.NS' : '.BO';
    const yahooSymbol = `${symbol}${suffix}`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=10d`;

    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Fetch failed:', response.status, response.statusText);
            const text = await response.text();
            console.log('Response body:', text);
            return;
        }
        const data = await response.json();
        console.log('Success!');
        console.log('Data found:', !!data.chart?.result?.[0]);
        if (data.chart?.result?.[0]) {
            console.log('Symbol:', data.chart.result[0].meta.symbol);
            console.log('Last Price:', data.chart.result[0].meta.regularMarketPrice);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testYahoo();
