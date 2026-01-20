const pkg = require('yahoo-finance2');

console.log('Package keys:', Object.keys(pkg));
console.log('Default keys:', pkg.default ? Object.keys(pkg.default) : 'No default');

async function test() {
    try {
        const yahooFinance = pkg.default || pkg;
        const symbol = 'RELIANCE.NS';
        console.log('Testing historical fetch...');

        try {
            const result = await yahooFinance.historical(symbol, {
                period1: '2025-01-01',
                period2: '2025-01-05',
                interval: '1d'
            });
            console.log('Success (default)! Result len:', result.length);
        } catch (e) {
            console.error('Error with default:', e.message);
        }
    } catch (err) {
        console.error('Fatal:', err);
    }
}

test();
