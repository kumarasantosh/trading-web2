import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define public routes (accessible without authentication)
const isPublicRoute = createRouteMatcher([
    '/', // Homepage only
    '/sign-in(.*)', // Sign-in pages (automatically public)
    '/sign-up(.*)', // Sign-up pages (automatically public)
    '/api(.*)', // All API routes (for cron jobs, webhooks, etc.)
])

export default clerkMiddleware(async (auth, req) => {
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
