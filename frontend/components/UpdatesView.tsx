"use client"
import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
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
  const { data: session } = useSession()
  const [updates, setUpdates] = useState<Update[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (session?.user?.email) {
      setIsLoading(true)
      fetch(`http://127.0.0.1:8000/api/updates/${session.user.email}`)
        .then((res) => res.json())
        .then((data) => {
          setUpdates(data)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    }
  }, [session])

  const handleScanNow = async () => {
    if (!session?.user?.email) return
    setIsScanning(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/api/updates/scan_now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: session.user.email }),
      })
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
      {/* FIXED: Removed fixed height, added doodle styles */}
      <header className="flex items-center ml-6 justify-between border-b-2 border-black bg-white p-4 flex-wrap">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Important Updates
        </h1>
        <Button
          onClick={handleScanNow}
          disabled={isScanning}
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

          {/* ADDED: New title for the updates list */}
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
                // STYLED: Update cards now use the doodle theme
                 <Card key={update.id} className="border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] bg-white">
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
              // STYLED: Empty state card now uses the doodle theme
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