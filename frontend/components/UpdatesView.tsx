"use client"
import React, { useState, useEffect, useMemo } from "react"
import { useAuth } from "../context/AuthContext" 
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, MailCheck, ThumbsUp, ThumbsDown, AlertTriangle, Briefcase, Calendar } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Update {
  id: number
  title: string
  summary: string
  discovered_at: string
  is_important: boolean
}

const parseUpdate = (update: Update): { label: string, title: string, isError: boolean } => {
  const match = update.title.match(/^\[(.*?)\]\s+(.*)/);
  if (match) {
    const label = match[1];
    const title = match[2];
    const isError = label === "JSON Parsing Error" || label === "Generation Error";
    return { label, title, isError };
  }
  return { label: "GENERAL", title: update.title, isError: false };
}

const UpdateCard = ({ 
  update, 
  onFeedback,
  isProcessing 
}: { 
  update: Update, 
  onFeedback: (id: number, isCorrect: boolean) => void,
  isProcessing: boolean
}) => {
  const { label, title, isError } = parseUpdate(update);
  
  const getLabelInfo = () => {
    switch (label) {
      case "DEADLINE":
        return { icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-50" };
      case "CAREER":
        return { icon: Briefcase, color: "text-blue-500", bgColor: "bg-blue-50" };
      case "EVENT":
        return { icon: Calendar, color: "text-green-500", bgColor: "bg-green-50" };
      default:
        return { icon: MailCheck, color: "text-gray-500", bgColor: "bg-gray-50" };
    }
  }
  
  const { icon: Icon, color, bgColor } = getLabelInfo();

  if (isError) {
    return (
      <Card className="border-2 border-red-300 rounded-2xl bg-red-50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-red-600" style={{ fontFamily: "'Baloo 2', cursive" }}>
            <AlertTriangle className="inline-block w-5 h-5 mr-2" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {title}
          </p>
          <p className="text-xs text-gray-500 mt-4" style={{ fontFamily: "'Baloo 2', cursive" }}>
            Found {formatDistanceToNow(new Date(update.discovered_at), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] bg-white transition-opacity duration-200" style={{ opacity: isProcessing ? 0.5 : 1 }}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardDescription className={`text-sm font-bold flex items-center ${color} ${bgColor} rounded-full px-3 py-1 w-fit`} style={{ fontFamily: "'Baloo 2', cursive" }}>
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </CardDescription>
            <CardTitle className="text-xl font-bold mt-2 pr-4" style={{ fontFamily: "'Baloo 2', cursive" }}>
              {title}
            </CardTitle>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => onFeedback(update.id, true)} 
              disabled={isProcessing}
              className={`border-2 text-gray-400 hover:text-green-500 hover:bg-green-100 hover:border-green-500 transition-colors`}
              title="This classification is correct"
            >
              <ThumbsUp className="w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => onFeedback(update.id, false)} 
              disabled={isProcessing}
              className={`border-2 text-gray-400 hover:text-red-500 hover:bg-red-100 hover:border-red-500 transition-colors`}
              title="This classification is wrong"
            >
              <ThumbsDown className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
          {update.summary}
        </p>
        <p className="text-xs text-gray-400 mt-4" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Found {formatDistanceToNow(new Date(update.discovered_at), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  )
}

const TriageColumn = ({ 
  title, 
  updates, 
  onFeedback,
  processingIds 
}: { 
  title: string, 
  updates: Update[], 
  onFeedback: (id: number, isCorrect: boolean) => void,
  processingIds: Set<number>
}) => {
  if (updates.length === 0) {
    return null; 
  }
  
  return (
    <div className="flex-1 min-w-[300px]">
      <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
        {title}
      </h3>
      <div className="space-y-4">
        {updates.map(update => (
          <UpdateCard 
            key={update.id} 
            update={update} 
            onFeedback={onFeedback}
            isProcessing={processingIds.has(update.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function UpdatesView() {
  const { session, isFullyAuthenticated, requestProtectedAccess } = useAuth()
  const [updates, setUpdates] = useState<Update[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const fetchUpdates = async () => {
    if (!isFullyAuthenticated || !session?.accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/updates`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setUpdates(data);
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [session, isFullyAuthenticated, apiUrl]);

  // --- START: UPDATED FUNCTION ---
  const handleScanNow = async () => {
    if (!isFullyAuthenticated || !session?.accessToken) {
      requestProtectedAccess();
      return;
    }
    setIsScanning(true);
    try {
      // 1. Tell the server to start the scan (fire and forget)
      const res = await fetch(`${apiUrl}/api/updates/scan_now`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      // 2. Server said "OK, I've started."
      // Now, wait 5 seconds before refreshing the updates list
      setTimeout(() => {
        console.log("Scan started, fetching updates...");
        fetchUpdates(); // 3. Re-fetch the updates
      }, 5000); // 5-second delay

    } catch (error) {
      console.error("Failed to trigger scan:", error);
      // If the trigger itself fails, stop the loading spinner
      setIsScanning(false);
    } finally {
      // Set scanning to false after the 5-second delay
      // fetchUpdates() will set its own loading spinner
      setTimeout(() => setIsScanning(false), 5000);
    }
  };
  // --- END: UPDATED FUNCTION ---
  
  const sendFeedback = async (updateId: number, isCorrect: boolean) => {
    if (!isFullyAuthenticated || !session?.accessToken) return;
    
    // Mark as processing
    setProcessingIds(prev => new Set(prev).add(updateId));

    try {
      const res = await fetch(`${apiUrl}/api/updates/feedback`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}` 
        },
        body: JSON.stringify({ 
          update_id: updateId, 
          is_correct: isCorrect
        }),
      });

      if (res.ok) {
        // Remove from UI on success
        setUpdates(prev => prev.filter(u => u.id !== updateId));
      } else {
        console.error("Feedback API failed:", res.status);
      }
    } catch (error) {
      console.error("Failed to send feedback:", error);
    } finally {
      // Remove from processing set
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
        return newSet;
      });
    }
  };

  const { deadlineUpdates, careerUpdates, eventUpdates } = useMemo(() => {
    const deadlines: Update[] = [];
    const careers: Update[] = [];
    const events: Update[] = [];

    updates.forEach(update => {
      if (update.title.startsWith("[DEADLINE]")) {
        deadlines.push(update);
      } else if (update.title.startsWith("[CAREER]")) {
        careers.push(update);
      } else if (update.title.startsWith("[EVENT]")) {
        events.push(update);
      }
    });
    
    return { 
      deadlineUpdates: deadlines, 
      careerUpdates: careers, 
      eventUpdates: events 
    };
  }, [updates]);

  const PrimaryButton = ({ children, ...props }: React.ComponentProps<typeof Button>) => (
    <Button 
      {...props} 
      style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }} 
      className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600 disabled:opacity-50"
    >
      {children}
    </Button>
  )

  return (
    <div className="flex flex-col h-full bg-white text-black">
      <header className="flex items-center ml-6 justify-between border-b-2 border-black bg-white p-4 flex-wrap gap-4">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Mail Triage Assistant
        </h1>
        <PrimaryButton onClick={handleScanNow} disabled={isScanning || !isFullyAuthenticated}>
          {isScanning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</> : "Scan Emails Now"}
        </PrimaryButton>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <p className="text-gray-800 mb-8 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
            Your ML model has triaged your inbox. Mark items as correct (👍) or incorrect (👎) to improve your model over time.
          </p>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center text-center p-8 border-4 border-dashed border-gray-300 rounded-2xl">
              <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
              <p className="text-xl font-bold" style={{fontFamily: "'Baloo 2', cursive"}}>Loading updates...</p>
            </div>
          ) : (updates.length > 0) ? (
            <div className="flex flex-col md:flex-row gap-6">
              <TriageColumn 
                title="🚀 Deadlines & Opportunities" 
                updates={[...deadlineUpdates, ...careerUpdates]} 
                onFeedback={sendFeedback}
                processingIds={processingIds}
              />
              <TriageColumn 
                title="📅 Events & Meetings" 
                updates={eventUpdates} 
                onFeedback={sendFeedback}
                processingIds={processingIds}
              />
            </div>
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
                  No important updates were found. Click &quot;Scan Emails Now&quot; to check again.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}