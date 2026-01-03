import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { moverType = 'TOP_GAINERS' } = req.query

        // Validate moverType
        if (!['TOP_GAINERS', 'TOP_LOSERS'].includes(moverType as string)) {
            return res.status(400).json({
                error: 'Invalid moverType. Must be TOP_GAINERS or TOP_LOSERS',
            })
        }

        const url = `https://groww.in/bff/web/stocks/explore/web-pages/top_movers?indice=GIDXNIFTY100&moverType=${moverType}&pageSize=100`

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Groww API returned ${response.status}`)
        }

        const data = await response.json()

        // Extract top 10 stocks and fetch their open prices
        const topStocks = data?.data?.stocks?.slice(0, 10) || []

        // Fetch open prices for each stock
        const stocksWithOpen = await Promise.all(
            topStocks.map(async (stock: any) => {
                try {
                    // Fetch live price data which includes open
                    const symbol = stock.nseScriptCode || stock.searchId
                    const priceUrl = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${symbol}/latest`

                    const priceResponse = await fetch(priceUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json',
                        },
                    })

                    let open = stock.close // Fallback to close if API fails

                    if (priceResponse.ok) {
                        const priceData = await priceResponse.json()
                        open = priceData?.open || priceData?.dayOpen || stock.close
                    }

                    // Calculate change based on open: ltp - open
                    const dayChange = stock.ltp - open
                    const dayChangePerc = open !== 0 ? (dayChange / open) * 100 : 0

                    return {
                        symbol: stock.nseScriptCode || stock.searchId,
                        name: stock.companyShortName || stock.companyName,
                        ltp: stock.ltp,
                        close: stock.close,
                        open: open,
                        dayChange: dayChange,
                        dayChangePerc: dayChangePerc,
                    }
                } catch (error) {
                    console.error(`Error fetching open for ${stock.nseScriptCode}:`, error)
                    // Fallback calculation using close
                    const dayChange = stock.ltp - stock.close
                    const dayChangePerc = stock.close !== 0 ? (dayChange / stock.close) * 100 : 0

                    return {
                        symbol: stock.nseScriptCode || stock.searchId,
                        name: stock.companyShortName || stock.companyName,
                        ltp: stock.ltp,
                        close: stock.close,
                        open: stock.close,
                        dayChange: dayChange,
                        dayChangePerc: dayChangePerc,
                    }
                }
            })
        )

        return res.status(200).json({
            success: true,
            moverType,
            stocks: stocksWithOpen,
        })
    } catch (error) {
        console.error('Top movers API error:', error)
        return res.status(500).json({
            error: 'Failed to fetch top movers data',
        })
    }
}
