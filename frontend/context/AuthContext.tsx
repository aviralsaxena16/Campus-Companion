"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, X } from "lucide-react"
// --- 1. Swapped imports from shadcn/ui back to framer-motion ---
import { motion, AnimatePresence } from "framer-motion"

// Define the scopes your app needs again for the sign-in function
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
  "profile"
]

interface AuthContextType {
  session: ReturnType<typeof useSession>["data"]
  status: ReturnType<typeof useSession>["status"]
  /**
   * 'true' if user is signed in AND has granted all required permissions.
   */
  isFullyAuthenticated: boolean
  /**
   * This function is called by protected buttons.
   * It checks auth and shows the modal if permissions are missing.
   * @returns 'true' if access is granted, 'false' if modal was shown.
   */
  requestProtectedAccess: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  const isFullyAuthenticated = 
    status === "authenticated" && 
    !session?.error

  useEffect(() => {
    // This handles the "renewal" requirement.
    if (status === "authenticated" && session?.error && !showAuthModal) {
      setShowAuthModal(true)
    }
  }, [status, session, showAuthModal])

  const requestProtectedAccess = () => {
    if (isFullyAuthenticated) {
      return true // Access granted
    }
    
    setShowAuthModal(true)
    return false // Access denied, modal is opening
  }

  const handleSignIn = () => {
    // When signing in, re-request all scopes to ensure
    // we get the refresh token and fix any permission issues.
    signIn("google", undefined, { 
      prompt: "consent", 
      access_type: "offline", 
      scope: REQUIRED_SCOPES.join(" ") 
    })
  }

  return (
    <AuthContext.Provider value={{ session, status, isFullyAuthenticated, requestProtectedAccess }}>
      {children}
      
      {/* --- 2. Replaced shadcn/ui Dialog with framer-motion --- */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative w-full max-w-md rounded-2xl border-4 border-black bg-white p-8 shadow-[8px_8px_0px_#000]"
              style={{ fontFamily: "'Baloo 2', cursive" }}
            >
              {/* --- Close Button --- */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-6 w-6" />
              </button>
              
              <h2 
                className="text-center text-3xl font-bold" 
                style={{ fontFamily: "'Luckiest Guy', cursive" }}
              >
                Connect Your Account
              </h2>
              <p className="mt-4 text-center text-lg text-gray-700">
                To use the agent features, Campus Companion needs your permission to:
              </p>
              <ul className="my-6 space-y-3">
                <li className="flex items-center text-base">
                  <CheckCircle2 className="mr-3 h-6 w-6 flex-shrink-0 text-green-600" />
                  Read your Google emails (for Mail Updates)
                </li>
                <li className="flex items-center text-base">
                  <CheckCircle2 className="mr-3 h-6 w-6 flex-shrink-0 text-green-600" />
                  Manage your Google Calendar (to schedule events)
                </li>
              </ul>
              <p className="mb-6 text-center text-sm text-gray-500">
                {session?.error ? "Your permissions may have expired. Please reconnect." : "Please sign in to continue."}
              </p>
              <Button
                onClick={handleSignIn}
                className="w-full rounded-xl border-2 border-black bg-orange-500 py-6 text-lg font-bold text-white shadow-[2px_2px_0px_#000] hover:bg-orange-600"
              >
                Sign In & Grant Permissions
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    // Correcting the TError from my previous version to a standard Error
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

