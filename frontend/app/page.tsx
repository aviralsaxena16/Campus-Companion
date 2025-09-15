"use client"

import type React from "react"

import { useState, type FormEvent, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  Send,
  Bot,
  User,
  LinkIcon,
  Mail,
  MessageSquare,
  Paperclip,
  Loader2,
  Zap,
  CheckCircle2,
  Download,
  Edit,
  Save,
  XCircle,
} from "lucide-react"
import { createParser, type EventSourceMessage } from "eventsource-parser"
import { formatDistanceToNow } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

import AuthButtons from "@/components/AuthButtons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea" // Using Textarea for better editing

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

// --- Main Dashboard Component ---
export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("chat")
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <aside className="w-64 flex-col border-r bg-white p-4 dark:bg-gray-800 dark:border-gray-700 hidden md:flex">
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
        {currentView === "chat" ? <ChatView /> : currentView === "updates" ? <UpdatesView /> : <AdvisorView />}
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
  const [isEditing, setIsEditing] = useState(false)
  const [editedRoadmap, setEditedRoadmap] = useState<Roadmap | null>(null)
  const roadmapRef = useRef<HTMLDivElement>(null) // Ref for PDF download
  const [isDownloading, setIsDownloading] = useState(false)

  const parseRoadmapResponse = (response: string): Roadmap | null => {
    try {
      console.log("[v0] Raw response:", response)
      let parsedData

      try {
        parsedData = JSON.parse(response)
      } catch {
        const cleanedResponse = response
          .replace(/```json\s*/g, "")
          .replace(/```\s*$/g, "")
          .trim()
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON object found in response")
        }
        parsedData = JSON.parse(jsonMatch[0])
      }

      console.log("[v0] Parsed data:", parsedData)

      let roadmapData: Roadmap

      if (parsedData.title && parsedData.stages) {
        const steps: RoadmapStep[] = parsedData.stages.map((stage: any, index: number) => {
          const tasks: string[] = []

          // Add topics/tasks
          if (Array.isArray(stage.topics)) {
            tasks.push(...stage.topics)
          } else if (Array.isArray(stage.tasks)) {
            tasks.push(...stage.tasks)
          } else if (Array.isArray(stage.content)) {
            tasks.push(...stage.content)
          }

          // Add duration if available
          if (stage.duration) {
            tasks.unshift(`Duration: ${stage.duration}`)
          }

          // Add resources as tasks if available
          if (Array.isArray(stage.resources) && stage.resources.length > 0) {
            tasks.push("Resources:")
            tasks.push(...stage.resources.map((resource: string) => `• ${resource}`))
          }

          return {
            title: stage.name || stage.title || `Stage ${index + 1}`,
            tasks: tasks.length > 0 ? tasks : [`Complete ${stage.name || `Stage ${index + 1}`}`],
          }
        })

        // Add additional tips as a final step if available
        if (Array.isArray(parsedData.additional_tips) && parsedData.additional_tips.length > 0) {
          steps.push({
            title: "Additional Tips",
            tasks: parsedData.additional_tips,
          })
        }

        roadmapData = {
          goal: parsedData.title,
          steps: steps,
        }
      } else if (parsedData.title && parsedData.timeline) {
        const steps: RoadmapStep[] = Object.values(parsedData.timeline).map((phase: any) => ({
          title: phase.name || phase.title,
          tasks: phase.tasks || phase.topics || [],
        }))

        roadmapData = {
          goal: parsedData.title,
          steps: steps,
        }
      } else if (parsedData.goal && parsedData.steps) {
        roadmapData = parsedData as Roadmap
      } else {
        const goal = parsedData.title || parsedData.goal || parsedData.name || "Learning Plan"
        const steps: RoadmapStep[] = []

        const stepsData = parsedData.steps || parsedData.stages || parsedData.phases || parsedData.timeline

        if (Array.isArray(stepsData)) {
          stepsData.forEach((item: any, index: number) => {
            const tasks: string[] = []

            if (Array.isArray(item.tasks)) {
              tasks.push(...item.tasks)
            } else if (Array.isArray(item.topics)) {
              tasks.push(...item.topics)
            } else if (Array.isArray(item.content)) {
              tasks.push(...item.content)
            } else if (item.description) {
              tasks.push(item.description)
            }

            steps.push({
              title: item.title || item.name || `Step ${index + 1}`,
              tasks: tasks.length > 0 ? tasks : [`Complete ${item.title || item.name || `Step ${index + 1}`}`],
            })
          })
        } else if (typeof stepsData === "object") {
          Object.values(stepsData).forEach((item: any, index: number) => {
            const tasks: string[] = []

            if (Array.isArray(item.tasks)) {
              tasks.push(...item.tasks)
            } else if (Array.isArray(item.topics)) {
              tasks.push(...item.topics)
            } else if (Array.isArray(item.content)) {
              tasks.push(...item.content)
            } else if (item.description) {
              tasks.push(item.description)
            }

            steps.push({
              title: item.title || item.name || `Step ${index + 1}`,
              tasks: tasks.length > 0 ? tasks : [`Complete ${item.title || item.name || `Step ${index + 1}`}`],
            })
          })
        }

        if (steps.length === 0) {
          throw new Error("No valid steps found in response")
        }

        roadmapData = { goal, steps }
      }

      // Ensure all tasks are strings and not objects
      roadmapData.steps = roadmapData.steps.map((step) => ({
        ...step,
        tasks: Array.isArray(step.tasks) ? step.tasks.filter((task) => typeof task === "string") : [],
      }))

      console.log("[v0] Final roadmap data:", roadmapData)
      return roadmapData
    } catch (error) {
      console.error("Error parsing roadmap response:", error)
      console.error("Raw response:", response)
      return {
        goal: goal || "Learning Plan",
        steps: [
          {
            title: "Parsing Error",
            tasks: ["Sorry, I couldn't parse the roadmap. Please try again with a different request."],
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
    setEditedRoadmap(null)
    setIsEditing(false)
    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Create a roadmap for: ${goal}`, user_email: session.user.email }),
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      const parsedRoadmap = parseRoadmapResponse(data.response)
      setRoadmap(parsedRoadmap)
      setEditedRoadmap(JSON.parse(JSON.stringify(parsedRoadmap)))
    } catch (error) {
      console.error("Advisor API error:", error)
      setRoadmap({
        goal,
        steps: [{ title: "Connection Error", tasks: ["Sorry, I couldn't generate a roadmap right now."] }],
        error: (error as Error).message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditChange = (phaseIndex: number, taskIndex: number, value: string) => {
    if (!editedRoadmap) return
    const newRoadmap = { ...editedRoadmap }
    newRoadmap.steps[phaseIndex].tasks[taskIndex] = value
    setEditedRoadmap(newRoadmap)
  }

  const handlePhaseTitleChange = (phaseIndex: number, value: string) => {
    if (!editedRoadmap) return
    const newRoadmap = { ...editedRoadmap }
    newRoadmap.steps[phaseIndex].title = value
    setEditedRoadmap(newRoadmap)
  }

  const handleSaveChanges = () => {
    setRoadmap(editedRoadmap)
    setIsEditing(false)
  }

  const handleDownloadPdf = async () => {
    if (!roadmapRef.current) return
    setIsDownloading(true)

    try {
      const canvas = await html2canvas(roadmapRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        ignoreElements: (element) => {
          // Skip elements that might cause color issues
          return element.classList.contains("ignore-pdf")
        },
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
        const pageHeight = pdf.internal.pageSize.getHeight()
        let heightLeft = pdfHeight
        let position = 0

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
        heightLeft -= pageHeight

        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight
          pdf.addPage()
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
          heightLeft -= pageHeight
        }
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      }

      pdf.save(`${roadmap?.goal.replace(/\s+/g, "_") || "roadmap"}.pdf`)
    } catch (error) {
      console.error("PDF generation failed:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleAddTask = (stepIndex: number) => {
    if (!editedRoadmap) return
    const newRoadmap = { ...editedRoadmap }
    newRoadmap.steps[stepIndex].tasks.push("New task")
    setEditedRoadmap(newRoadmap)
  }

  const handleRemoveTask = (stepIndex: number, taskIndex: number) => {
    if (!editedRoadmap) return
    const newRoadmap = { ...editedRoadmap }
    newRoadmap.steps[stepIndex].tasks.splice(taskIndex, 1)
    setEditedRoadmap(newRoadmap)
  }

  const handleAddStep = () => {
    if (!editedRoadmap) return
    const newRoadmap = { ...editedRoadmap }
    newRoadmap.steps.push({
      title: "New Step",
      tasks: ["New task"],
    })
    setEditedRoadmap(newRoadmap)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center border-b bg-background p-4 justify-between">
        <h1 className="text-xl font-semibold">Advisor Agent</h1>
        {roadmap && !roadmap.error && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download PDF"}
            </Button>
            {isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setEditedRoadmap(roadmap)
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Plan
              </Button>
            )}
          </div>
        )}
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

          <div
            ref={roadmapRef}
            className="p-6 bg-white rounded-lg shadow-sm"
            style={{ backgroundColor: "#ffffff", color: "#1f2937" }}
          >
            {roadmap && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold" style={{ color: "#1f2937" }}>
                    {isEditing ? (
                      <Input
                        value={editedRoadmap?.goal || ""}
                        onChange={(e) => setEditedRoadmap((prev) => (prev ? { ...prev, goal: e.target.value } : null))}
                        className="text-3xl font-bold text-center border-none shadow-none bg-transparent"
                        style={{ color: "#1f2937" }}
                      />
                    ) : (
                      roadmap.goal
                    )}
                  </h2>
                </div>
                <div className="grid gap-4">
                  {(isEditing ? editedRoadmap : roadmap)?.steps.map((step, stepIndex) => (
                    <Card
                      key={stepIndex}
                      className="border-2"
                      style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}
                    >
                      <CardHeader>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={step.title}
                              onChange={(e) => handlePhaseTitleChange(stepIndex, e.target.value)}
                              className="text-lg font-semibold h-10"
                              style={{ color: "#1f2937" }}
                            />
                            <Button variant="outline" size="sm" onClick={() => handleAddTask(stepIndex)}>
                              Add Task
                            </Button>
                          </div>
                        ) : (
                          <CardTitle style={{ color: "#1f2937" }}>
                            Step {stepIndex + 1}: {step.title}
                          </CardTitle>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {step.tasks.map((task, taskIndex) => (
                            <div key={taskIndex} className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                              {isEditing ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <Textarea
                                    value={task}
                                    onChange={(e) => handleEditChange(stepIndex, taskIndex, e.target.value)}
                                    className="text-sm leading-relaxed min-h-[60px]"
                                    style={{ color: "#374151" }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveTask(stepIndex, taskIndex)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm leading-relaxed" style={{ color: "#374151" }}>
                                  {task}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {isEditing && (
                    <div className="text-center">
                      <Button onClick={handleAddStep} variant="outline">
                        Add New Step
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
