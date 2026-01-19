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
        const url = `/api/yahoo?symbol=${encodeURIComponent(yahooSymbol)}&interval=1d&range=10d`;

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

        // Helper function to check if a candle is valid (has actual trading data)
        const isValidTradingDay = (index: number): boolean => {
            if (index < 0 || index >= timestamps.length) return false;

            const open = quote.open[index];
            const high = quote.high[index];
            const low = quote.low[index];
            const close = quote.close[index];
            const volume = quote.volume[index];

            // Check for null values
            if (open === null || high === null || low === null || close === null) {
                return false;
            }

            // Check for placeholder data (all OHLC same - indicates no trading)
            if (open === high && high === low && low === close) {
                return false;
            }

            // Check for zero or very low volume (likely a holiday/non-trading day)
            if (volume === null || volume === 0) {
                return false;
            }

            return true;
        };

        // Find the last valid trading day
        let lastValidIndex = timestamps.length - 1;
        while (lastValidIndex >= 0 && !isValidTradingDay(lastValidIndex)) {
            lastValidIndex--;
        }

        if (lastValidIndex < 0) {
            console.warn(`No valid trading data found for ${symbol}`);
            return null;
        }

        // Check if the last valid trading day is today
        const lastValidTimestamp = timestamps[lastValidIndex];
        const lastValidDate = new Date(lastValidTimestamp * 1000);
        const today = new Date();

        // Set time to midnight for accurate date comparison
        today.setHours(0, 0, 0, 0);
        lastValidDate.setHours(0, 0, 0, 0);

        const isToday = lastValidDate.getTime() === today.getTime();

        // If the last valid day is today, we want the previous trading day
        let targetIndex = lastValidIndex;
        if (isToday) {
            targetIndex = lastValidIndex - 1;
            // Find the previous valid trading day
            while (targetIndex >= 0 && !isValidTradingDay(targetIndex)) {
                targetIndex--;
            }
        }

        if (targetIndex < 0) {
            console.warn(`No previous trading day data found for ${symbol}`);
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
