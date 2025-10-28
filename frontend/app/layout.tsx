import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import ClientSessionProvider from "@/components/SessionProvider" // Renamed to avoid confusion
import { AuthProvider } from "@/context/AuthContext" // 1. Import AuthProvider
import { authOptions } from "./api/auth/[...nextauth]/route" // 2. Import authOptions
import { getServerSession } from "next-auth/next" // 3. Import getServerSession

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AI University Navigator",
  description: "Your personal campus assistant",
}

// 4. Make the component async
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 5. Get the session on the server
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 6. Pass the server session to the provider */}
        <ClientSessionProvider session={session}>
          {/* 7. Wrap the children with AuthProvider *inside* the SessionProvider */}
          <AuthProvider>{children}</AuthProvider>
        </ClientSessionProvider>
      </body>
    </html>
  )
}
