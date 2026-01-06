export interface YahooStockData {
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    prevClose?: number;
}

export const fetchYahooStockData = async (symbol: string, exchange: 'NSE' | 'BSE' = 'NSE'): Promise<YahooStockData | null> => {
    try {
        // Format symbol for Yahoo Finance
        // Don't add suffix for index symbols (starting with ^)
        let yahooSymbol: string;
        if (symbol.startsWith('^')) {
            // Index symbol - use as is
            yahooSymbol = symbol.toUpperCase();
        } else {
            // Stock symbol - add exchange suffix
            const suffix = exchange === 'NSE' ? '.NS' : '.BO';
            yahooSymbol = symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO')
                ? symbol.toUpperCase()
                : `${symbol.toUpperCase()}${suffix}`;
        }

        // Use our local proxy to avoid CORS issues
        const url = `/api/yahoo?symbol=${yahooSymbol}&interval=1d&range=10d`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Yahoo Finance fetch failed for ${symbol}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (!data.chart?.result?.[0]) {
            console.warn(`No data found for ${symbol}`);
            return null;
        }

        const result = data.chart.result[0];
        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // Find the last valid trading day
        let lastIndex = timestamps.length - 1;

        // Skip incomplete data (sometimes current day data is partial or null if market is open/just opened)
        // logic: if close is null, it's not a complete candle. 
        // Yahoo often returns nulls for future placeholders or incomplete days.
        while (lastIndex >= 0 && (quote.open[lastIndex] === null || quote.close[lastIndex] === null || quote.high[lastIndex] === null || quote.low[lastIndex] === null)) {
            lastIndex--;
        }

        // If we want "Previous Day" specifically, we might need to check the date.
        // But usually "Previous Data" implies the last completed candle available.
        // If market is OPEN, the last candle might be "Today".
        // The user wants "Previous Day" details. 
        // If today is Monday trading session, "Previous Day" is Friday.
        // If we are mid-day, the last index is "Current/Today". The index before that is "Previous Day".

        // Let's determine if the last candle is "Today" (incomplete or complete).
        // Since we are client side, we can check date.
        const lastTimestamp = timestamps[lastIndex];
        const lastDate = new Date(lastTimestamp * 1000);
        const today = new Date();

        // Simple check: is last candle same date as today?
        const isToday = lastDate.getDate() === today.getDate() &&
            lastDate.getMonth() === today.getMonth() &&
            lastDate.getFullYear() === today.getFullYear();

        let targetIndex = lastIndex;

        // If the last candle is today, we technically want the *previous* day for "Previous Day High/Low" context 
        // to compare against current LTP (which is Today's price).
        // However, if the user just wants "Last available full data", that's different.
        // The prompt says: "on hover... details of previous day high and low".
        // Use case: Breakout detection. Breakout is usually checking if Current LTP > Previous Day High.
        // So we definitely need the *completed* previous day, not the current running day.

        if (isToday) {
            targetIndex = lastIndex - 1;
        }

        // Search backwards again for valid data if we stepped back
        while (targetIndex >= 0 && (quote.open[targetIndex] === null || quote.close[targetIndex] === null)) {
            targetIndex--;
        }

        if (targetIndex < 0) {
            return null;
        }

        const targetTimestamp = timestamps[targetIndex];
        const targetDate = new Date(targetTimestamp * 1000);

        return {
            symbol: yahooSymbol,
            date: targetDate.toISOString().split('T')[0],
            open: quote.open[targetIndex],
            high: quote.high[targetIndex],
            low: quote.low[targetIndex],
            close: quote.close[targetIndex],
            volume: quote.volume[targetIndex]
        };

    } catch (err: any) {
        console.error(`Error fetching Yahoo data for ${symbol}:`, err);
        return null;
    }
};
