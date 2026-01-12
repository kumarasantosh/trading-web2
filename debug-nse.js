const testNSE = async (symbol) => {
    try {
        console.log(`Testing with symbol: ${symbol}`);
        const homeResponse = await fetch('https://www.nseindia.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        const cookies = homeResponse.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
        console.log(`Cookies established: ${cookies ? 'Yes' : 'No'}`);

        const url = `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Cookie': cookies,
                'Referer': 'https://www.nseindia.com/option-chain',
            },
        });

        console.log(`Response Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response Preview: ${text.substring(0, 200)}`);

        try {
            const data = JSON.parse(text);
            console.log(`Is records present: ${!!data.records}`);
            if (data.records) {
                console.log(`Underlying Value: ${data.records.underlyingValue}`);
                console.log(`Expiries: ${data.records.expiryDates.length}`);
            }
        } catch (e) {
            console.log('Response is not JSON');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

const run = async () => {
    await testNSE('NIFTY');
    console.log('---');
    await testNSE('FINNIFTY');
    console.log('---');
    await testNSE('NIFTY FIN SERVICE');
}

run();
