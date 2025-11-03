"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, X } from "lucide-react"
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
  isFullyAuthenticated: boolean
  requestProtectedAccess: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // This state prevents us from spamming the backend
  const [isTokenStored, setIsTokenStored] = useState(false)

  const isFullyAuthenticated = 
    status === "authenticated" && 
    !session?.error

  useEffect(() => {
    // This handles the "renewal" requirement.
    if (status === "authenticated" && session?.error && !showAuthModal) {
      setShowAuthModal(true)
    }
  }, [status, session, showAuthModal])

  // This automatically stores the refresh token on the backend
  useEffect(() => {
    if (isFullyAuthenticated && session.refreshToken && !isTokenStored) {
      console.log("AuthProvider: Storing refresh token...")
      setIsTokenStored(true) // Set to true immediately to prevent re-runs
      
      const storeToken = async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          const response = await fetch(`${apiUrl}/api/users/store_refresh_token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.accessToken}` 
            },
            body: JSON.stringify({
              refresh_token: session.refreshToken
            })
          })
          
          if (response.ok) {
            console.log("AuthProvider: Refresh token stored successfully.")
          } else {
            // --- THIS IS THE CHANGE ---
            // We log response.text() because response.json() will fail
            // if the server returned an HTML 500 error page.
            console.error("AuthProvider: Failed to store refresh token. Server response:", await response.text())
            setIsTokenStored(false) // Allow a retry on next render
          }
        } catch (error) {
          console.error("AuthProvider: Error storing refresh token:", error)
          setIsTokenStored(false) // Allow a retry
        }
      }
      
      storeToken()
    }
  }, [isFullyAuthenticated, session, isTokenStored])

  const requestProtectedAccess = () => {
    if (isFullyAuthenticated) {
      return true // Access granted
    }
    
    setShowAuthModal(true)
    return false // Access denied, modal is opening
  }

  const handleSignIn = () => {
    signIn("google", undefined, { 
      prompt: "consent", 
      access_type: "offline", 
      scope: REQUIRED_SCOPES.join(" ") 
    })
  }

  return (
    <AuthContext.Provider value={{ session, status, isFullyAuthenticated, requestProtectedAccess }}>
      {children}
      
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                  <CheckCircle2 className="mr-3 h-6 w-6 shrink-0 text-green-600" />
                  Read your Google emails (for Mail Updates)
                </li>
                <li className="flex items-center text-base">
                  <CheckCircle2 className="mr-3 h-6 w-6 shrink-0 text-green-600" />
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
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
