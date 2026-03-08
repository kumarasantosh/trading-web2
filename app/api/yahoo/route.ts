import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1d';
    const range = searchParams.get('range') || '10d';

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const cacheKey = `${symbol}-${interval}-${range}`;
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const cache = (global as any).__yahooCache = (global as any).__yahooCache || { data: {} as Record<string, { v: any; t: number }> };
    const cached = cache.data[cacheKey];
    if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
        return NextResponse.json(cached.v);
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
        let lastStatus = 0;
        for (let attempt = 0; attempt < 3; attempt++) {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://finance.yahoo.com/'
                },
                cache: 'no-store'
            });
            lastStatus = response.status;
            if (response.ok) {
                const data = await response.json();
                cache.data[cacheKey] = { v: data, t: Date.now() };
                return NextResponse.json(data);
            }
            if (response.status === 429 && attempt < 2) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            console.error(`Yahoo Finance Error for ${symbol}: ${response.status} ${response.statusText}`);
            return NextResponse.json(
                { error: `Yahoo Finance Error: ${response.statusText}` },
                { status: response.status }
            );
        }
        return NextResponse.json(
            { error: `Yahoo Finance Error: ${lastStatus}` },
            { status: lastStatus }
        );

    } catch (error: any) {
        console.error('Yahoo Proxy Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch data' },
            { status: 500 }
        );
    }
}
