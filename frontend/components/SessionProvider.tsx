// In frontend/components/SessionProvider.tsx

"use client" // This must be a client component

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { Session } from "next-auth" // Import the Session type

interface SessionProviderProps {
  children: React.ReactNode
  session: Session | null // <-- This is the new prop
}

// Pass the props (including session) down to the real provider
export default function ClientSessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}