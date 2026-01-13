import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const response = await fetch('https://www.nseindia.com/api/allIndices', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            next: { revalidate: 0 } // Disable caching
        })

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching NSE indices:', error)
        return NextResponse.json(
            { error: 'Failed to fetch from NSE' },
            { status: 500 }
        )
    }
}
