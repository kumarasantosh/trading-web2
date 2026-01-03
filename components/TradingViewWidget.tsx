'use client';

import { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
    symbol: string;
    exchange?: string;
    interval?: string;
    theme?: 'light' | 'dark';
    height?: number;
}

export default function TradingViewWidget({
    symbol,
    exchange = 'NSE',
    interval = 'D',
    theme = 'light',
    height = 600,
}: TradingViewWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Create widget container
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        containerRef.current.appendChild(widgetDiv);

        // Create and append script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: `${exchange}:${symbol}`,
            interval: interval,
            timezone: 'Asia/Kolkata',
            theme: theme,
            style: '1',
            locale: 'en',
            enable_publishing: false,
            allow_symbol_change: true,
            calendar: false,
            support_host: 'https://www.tradingview.com'
        });

        containerRef.current.appendChild(script);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbol, exchange, interval, theme]);

    return (
        <div
            className="tradingview-widget-container"
            style={{ height: `${height}px`, width: '100%' }}
            ref={containerRef}
        />
    );
}
