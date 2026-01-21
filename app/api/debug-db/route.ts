import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
    try {
        const symbols = ['FEDERALBNK', 'ANGELONE', 'HDFC', 'RELIANCE', 'SBIN']

        const { data, error } = await supabaseAdmin
            .from('daily_high_low')
            .select('*')
            .in('symbol', symbols)

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: data
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
