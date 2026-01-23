import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes (accessible without authentication)
const isPublicRoute = createRouteMatcher([
    '/', // Homepage
    '/contact-us(.*)', // Contact page
    '/about-us(.*)', // About Us page
    '/faq(.*)', // FAQ page
    '/disclaimers(.*)', // Disclaimer page
    '/risk-disclosure(.*)', // Risk Disclosure page
    '/terms-conditions(.*)', // Terms & Conditions page
    '/privacy-policy(.*)', // Privacy Policy page
    '/sign-in(.*)', // Sign-in pages (automatically public)
    '/sign-up(.*)', // Sign-up pages (automatically public)
    '/api(.*)', // All API routes (for cron jobs, webhooks, etc.)
])

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth()
    const url = req.nextUrl

    // Redirect logged-in users from landing page to momentum
    if (userId && url.pathname === '/') {
        return NextResponse.redirect(new URL('/momentum', req.url))
    }

    // Protect all routes except public ones
    if (!isPublicRoute(req)) {
        await auth.protect()
    }
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
