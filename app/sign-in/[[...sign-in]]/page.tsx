import { SignIn } from '@clerk/nextjs'

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
                        }
                    }}
                />
            </div>
        </div>
    )
}
