import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-gray-600">
                        Sign in to access India's best trading toolkit
                    </p>
                </div>
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-xl",
                            footer: "hidden", // Hide default footer with "Don't have an account?"
                        }
                    }}
                    signUpUrl="/sign-up"
                    forceRedirectUrl="/momentum"
                />
                {/* Custom Sign Up Prompt */}
                <div className="mt-6 text-center">
                    <p className="text-gray-600">
                        Don't have an account?{' '}
                        <Link
                            href="/sign-up"
                            className="font-semibold text-black hover:underline"
                        >
                            Pay and join
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
