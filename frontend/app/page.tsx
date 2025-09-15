"use client"

import type React from "react"

import { useState, type FormEvent, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { createParser, type EventSourceMessage } from "eventsource-parser"
import { formatDistanceToNow } from "date-fns"

import AuthButtons from "@/components/AuthButtons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Send, Bot, User, LinkIcon, Mail, MessageSquare, Paperclip, Loader2, Zap, CheckCircle2 } from "lucide-react"

// --- Type Definitions ---
interface Message {
  text: string
  sender: "user" | "ai"
}
interface Update {
  id: number
  title: string
  summary: string
  discovered_at: string
}
interface PlanStep {
  type: string
  content: string
}
type View = "chat" | "updates" | "advisor"

interface RoadmapStep {
  title: string
  tasks: string[]
}

interface Roadmap {
  goal: string
  steps: RoadmapStep[]
  error?: string
}

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("chat")

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r bg-card p-4">
        <h2 className="text-2xl font-bold">Navigator</h2>
        <Separator className="my-4" />
        <nav className="flex flex-col space-y-2">
          <Button
            variant={currentView === "chat" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("chat")}
            className="justify-start"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Agent Chat
          </Button>
          <Button
            variant={currentView === "updates" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("updates")}
            className="justify-start"
          >
            <Mail className="mr-2 h-4 w-4" />
            Important Updates
          </Button>
          <Button
            variant={currentView === "advisor" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("advisor")}
            className="justify-start"
          >
            <Zap className="mr-2 h-4 w-4" />
            Advisor Agent
          </Button>
        </nav>
        <div className="mt-auto">
          <AuthButtons />
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        {currentView === "chat" && <ChatView />}
        {currentView === "updates" && <UpdatesView />}
        {currentView === "advisor" && <AdvisorView />}
      </main>
    </div>
  )
}

// --- Chat View Component ---
const ChatView = () => {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, planSteps])

  const handleConnectGoogle = async () => {
    if (!session?.user?.email) return alert("Please sign in first.")
    alert(
      "This will trigger a browser pop-up for Google authentication. Please check your browser and complete the sign-in flow.",
    )
    try {
      const response = await fetch("http://127.0.0.1:8000/api/users/connect_google_account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: session.user.email }),
      })
      const data = await response.json()
      alert(data.message)
    } catch (error) {
      console.error("Failed to connect Google Account:", error)
      alert("Failed to connect Google Account. Check the console for details.")
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const response = await fetch("http://127.0.0.1:8000/api/files/upload", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        setUploadedFilePath(data.file_path)
        alert(`File "${file.name}" uploaded successfully! You can now ask questions about it.`)
      } else {
        throw new Error(data.detail || "File upload failed")
      }
    } catch (error) {
      console.error("File upload error:", error)
      alert((error as Error).message)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    let currentInput = input
    if (!currentInput.trim() || !session?.user?.email) return

    if (uploadedFilePath) {
      currentInput = `(Regarding the uploaded file at path: ${uploadedFilePath}) ${currentInput}`
      setUploadedFilePath(null)
    }

    const userMessage: Message = { text: input, sender: "user" }
    setMessages((prev) => [...prev, userMessage])
    setPlanSteps([])
    setIsLoading(true)
    setInput("")

    const response = await fetch("http://127.0.0.1:8000/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: currentInput, user_email: session.user.email }),
    })

    if (!response.ok || !response.body) {
      setIsLoading(false)
      const errorMessage: Message = { text: "Sorry, I ran into an error connecting to the agent.", sender: "ai" }
      setMessages((prev) => [...prev, errorMessage])
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    const parser = createParser({
      onEvent(event: EventSourceMessage) {
        try {
          if (event.event === "start") return
          const data = JSON.parse(event.data)
          if (event.event === "tool_start") {
            setPlanSteps((prev) => [
              ...prev,
              {
                type: "Tool Call",
                content: `${data.tool}(${JSON.stringify(data.tool_input)})`,
              },
            ])
          } else if (event.event === "tool_end") {
            setPlanSteps((prev) => [
              ...prev,
              {
                type: "Tool Output",
                content: `Result: ${data.output.substring(0, 100)}...`,
              },
            ])
          } else if (event.event === "final_chunk") {
            setMessages((prev) => [...prev, { text: data.output, sender: "ai" }])
            setPlanSteps((prev) => [...prev, { type: "Finished", content: "Agent has finished." }])
          }
        } catch (e) {
          console.error("Streaming parse error:", e)
        }
      },
      onRetry(retryInterval: number) {
        // Optionally handle server-requested retry intervals
      },
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      parser.feed(chunk)
    }
    setIsLoading(false)
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background p-4">
        <h1 className="text-xl font-semibold">AI Agent Chat</h1>
        {session && (
          <Button onClick={handleConnectGoogle} variant="outline">
            <LinkIcon className="mr-2 h-4 w-4" />
            Connect Google Account
          </Button>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex-1 overflow-y-auto space-y-4 pr-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 ${msg.sender === "user" ? "justify-end" : ""}`}>
                {msg.sender === "ai" && <Bot className="h-6 w-6 text-primary" />}
                <div
                  className={`rounded-lg px-4 py-2 max-w-lg ${msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                {msg.sender === "user" && <User className="h-6 w-6" />}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
            <Input
              placeholder={
                uploadedFilePath
                  ? `File "${uploadedFilePath.split(/[/\\]/).pop()}" attached. Ask a question...`
                  : "Ask your agent..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!session || isLoading}
              className="pr-12"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              disabled={!session || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
        <aside className="w-80 border-l p-4 bg-muted/50 hidden lg:block">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Agent Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && planSteps.length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agent is thinking...
                </p>
              )}
              {planSteps.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">The agent's real-time plan will appear here.</p>
              )}
              <ul className="space-y-3">
                {planSteps.map((step, index) => (
                  <li key={index} className="text-sm break-words">
                    <span
                      className={`font-semibold ${step.type === "Tool Call" ? "text-primary" : step.type === "Tool Output" ? "text-muted-foreground" : "text-green-600"}`}
                    >
                      {step.type}:
                    </span>
                    <p className="text-xs text-muted-foreground pl-2">{step.content}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  )
}

// --- Updates View Component ---
const UpdatesView = () => {
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
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background p-4">
        <h1 className="text-xl font-semibold">Important Updates</h1>
        <Button onClick={handleScanNow} disabled={isScanning}>
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
          <p className="text-muted-foreground mb-6">
            A curated list of important updates from your agent's scheduled email scans.
          </p>
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading updates...</p>
            ) : updates.length > 0 ? (
              updates.map((update) => (
                <Card key={update.id}>
                  <CardHeader>
                    <CardTitle>{update.title}</CardTitle>
                    <CardDescription>
                      Found {formatDistanceToNow(new Date(update.discovered_at), { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{update.summary}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="text-center p-8">
                <CardHeader>
                  <CardTitle>No important updates found yet.</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Click "Scan Emails Now" to get started!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const AdvisorView = () => {
  const { data: session } = useSession()
  const [goal, setGoal] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)

  const parseRoadmapResponse = (response: string): Roadmap | null => {
    try {
      console.log("[v0] Raw response:", response) // Added debug logging
      let parsedData
      try {
        parsedData = JSON.parse(response)
      } catch {
        // Remove markdown code fences and clean the response
        const cleanedResponse = response.replace(/```json\s*/g, "").replace(/```\s*$/g, "")

        // Find JSON object using regex
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON object found in response")
        }

        parsedData = JSON.parse(jsonMatch[0])
      }

      console.log("[v0] Parsed data:", parsedData) // Added debug logging

      let roadmapData: Roadmap

      if (parsedData.title && parsedData.timeline) {
        // Transform the timeline structure to our expected format
        const steps: RoadmapStep[] = Object.values(parsedData.timeline).map((phase: any) => ({
          title: phase.name,
          tasks: phase.tasks,
        }))

        roadmapData = {
          goal: parsedData.title,
          steps: steps,
        }
      } else if (parsedData.goal && parsedData.steps) {
        // Handle the expected format if it comes in that way
        roadmapData = parsedData as Roadmap
      } else {
        throw new Error("Invalid roadmap structure - missing required fields")
      }

      // Validate the final structure
      if (!roadmapData.goal || !roadmapData.steps || !Array.isArray(roadmapData.steps)) {
        throw new Error("Invalid roadmap structure after transformation")
      }

      console.log("[v0] Final roadmap data:", roadmapData) // Added debug logging
      return roadmapData
    } catch (error) {
      console.error("Error parsing roadmap response:", error)
      console.error("Raw response:", response) // Added debug logging
      return {
        goal: goal,
        steps: [
          {
            title: "Parsing Error",
            tasks: ["Sorry, I couldn't parse the roadmap. Please try again."],
          },
        ],
        error: "Failed to parse response",
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || !session?.user?.email) return

    setIsLoading(true)
    setRoadmap(null)

    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Create a roadmap for: ${goal}`,
          user_email: session.user.email,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const parsedRoadmap = parseRoadmapResponse(data.response)

      if (parsedRoadmap) {
        setRoadmap(parsedRoadmap)
      } else {
        throw new Error("Failed to parse roadmap response")
      }
    } catch (error) {
      console.error("Advisor API error:", error)
      setRoadmap({
        goal: goal,
        steps: [
          {
            title: "Connection Error",
            tasks: [
              "Sorry, I couldn't generate a roadmap right now.",
              "Please check your connection and try again.",
              "If the problem persists, contact support.",
            ],
          },
        ],
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center border-b bg-background p-4">
        <h1 className="text-xl font-semibold">Advisor Agent</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-muted-foreground mb-6">
            Ask for a plan to achieve a goal, and the agent will generate a step-by-step roadmap for you.
          </p>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-8">
            <Input
              placeholder="e.g., 'learn React for web development'"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !goal.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Plan"
              )}
            </Button>
          </form>

          {roadmap && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {roadmap.goal}
                </h2>
                {roadmap.error && <p className="text-sm text-destructive mb-4">Note: {roadmap.error}</p>}
                <p className="text-muted-foreground">Your personalized roadmap with {roadmap.steps.length} key steps</p>
              </div>

              <div className="grid gap-4">
                {roadmap.steps.map((step, stepIndex) => (
                  <Card key={stepIndex} className="relative overflow-hidden border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md">
                          {stepIndex + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{step.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{step.tasks.length} tasks to complete</p>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid gap-3">
                        {step.tasks.map((task, taskIndex) => (
                          <div
                            key={taskIndex}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                          >
                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-sm leading-relaxed">{task}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
                <p className="text-sm text-muted-foreground text-center">
                  💡 Tip: Break each step into smaller daily goals to track your progress effectively
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
