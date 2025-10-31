"use client"
import React, { useState, useEffect } from "react"
// --- 1. Import useAuth using the correct path alias ---
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, MailCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Update {
  id: number
  title: string
  summary: string
  discovered_at: string
}

export default function UpdatesView() {
  // --- 2. Use the useAuth hook ---
  const { session, isFullyAuthenticated, requestProtectedAccess } = useAuth()
  const [updates, setUpdates] = useState<Update[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    // --- 3. Check for full auth and the access token ---
    if (isFullyAuthenticated && session && session.accessToken) {
      setIsLoading(true)
      // --- 4. Call the new, protected endpoint ---
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      fetch(`${apiUrl}/api/updates`, {
        headers: {
          // --- 5. Add the Authorization header ---
          "Authorization": `Bearer ${session.accessToken}`
        }
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json()
        })
        .then((data) => {
          setUpdates(data)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error("Failed to fetch updates:", err)
          setIsLoading(false)
        })
    }
  // --- 6. Add accessToken to the dependency array ---
  }, [session, isFullyAuthenticated])

  const handleScanNow = async () => {
    // --- 7. Check for auth first ---
    if (!isFullyAuthenticated || !session || !session.accessToken) {
      requestProtectedAccess()
      return
    }

    setIsScanning(true)
    try {

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/updates/scan_now`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // --- 8. Add the Authorization header ---
          "Authorization": `Bearer ${session.accessToken}`
        },
        // --- 9. Remove the body (backend gets user from token) ---
      })
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json()
      setUpdates(data)
    } catch (error) {
      console.error("Failed to scan emails:", error)
      alert("An error occurred during the scan.")
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white text-black">
      <header className="flex items-center ml-6 justify-between border-b-2 border-black bg-white p-4 flex-wrap">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Important Updates
        </h1>
        <Button
          onClick={handleScanNow}
          // --- 10. Disable if scanning OR not authenticated ---
          disabled={isScanning || !isFullyAuthenticated}
          style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }}
          className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600 mt-2 sm:mt-0"
        >
          {isScanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            "Scan Emails Now"
          )}
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-gray-800 mb-4 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
            A curated list of important updates from your agent's scheduled email scans.
          </p>

          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            Your Mail Updates
          </h2>

          <div className="space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-center p-8 border-4 border-dashed border-gray-300 rounded-2xl">
                   <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
                   <p className="text-xl font-bold" style={{fontFamily: "'Baloo 2', cursive"}}>Loading updates...</p>
              </div>
            ) : updates.length > 0 ? (
              updates.map((update) => (
                   <Card key={update.id} className="border-2 border-black rounded-2xl shadow-[2px 2px 0px #000] bg-white">
                   <CardHeader>
                     <CardTitle className="text-xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
                       {update.title}
                     </CardTitle>
                     <CardDescription className="text-sm text-gray-600" style={{ fontFamily: "'Baloo 2', cursive" }}>
                       Found {formatDistanceToNow(new Date(update.discovered_at), { addSuffix: true })}
                     </CardDescription>
                   </CardHeader>
                   <CardContent>
                     <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
                       {update.summary}
                     </p>
                   </CardContent>
                 </Card>
              ))
            ) : (
              <Card className="text-center p-8 border-4 border-dashed border-gray-300 rounded-2xl">
                <CardHeader className="flex flex-col items-center">
                    <MailCheck className="h-12 w-12 text-orange-500 mb-4" />
                  <CardTitle className="text-2xl" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                    All Clear for Now!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    No important updates were found. Click "Scan Emails Now" to check again.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

