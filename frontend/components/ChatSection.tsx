"use client"
import React, { useState, useRef, useEffect, type FormEvent } from "react"
// We use the 'useAuth' hook which is the correct way
import { useAuth } from "../context/AuthContext"
import { Send, Bot, User, Link as LinkIcon, Paperclip, Loader2, X, Check, Zap, Terminal, CheckCircle2 } from "lucide-react"
import { createParser, type EventSourceMessage } from "eventsource-parser"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  text: string
  sender: "user" | "ai"
}
interface PlanStep {
  type: string
  content: string
}

export default function ChatSection() {
  // We use our 'useAuth' hook, not 'useSession'
  const { session, status, requestProtectedAccess, isFullyAuthenticated } = useAuth()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [attachedLink, setAttachedLink] = useState<string | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInputValue, setLinkInputValue] = useState("")

  const startAttachLink = () => setShowLinkInput(true)
  const confirmAttachLink = () => {
    if (linkInputValue.trim()) {
      setAttachedLink(linkInputValue.trim())
      setLinkInputValue("")
      setShowLinkInput(false)
    }
  }
  const removeAttachedLink = () => setAttachedLink(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, planSteps])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Use the session from useAuth
    if (!file || !session?.accessToken) {
      requestProtectedAccess()
      return
    }
    
    setIsLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/files/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        setUploadedFilePath(data.file_path)
        // You can add a toast notification here
      } else {
        throw new Error(data.detail || "File upload failed")
      }
    } catch (error) {
      console.error("File upload error:", error)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    let currentInput = input
    
    // Check for auth using our hook
    if (!currentInput.trim() || !session?.accessToken) {
      requestProtectedAccess()
      return
    }

    if (uploadedFilePath) {
      currentInput = `(Regarding the uploaded file at path: ${uploadedFilePath}) ${currentInput}`
      setUploadedFilePath(null)
    }
    if (attachedLink) {
        currentInput = `(Regarding the link: ${attachedLink}) ${currentInput}`
        setAttachedLink(null)
    }
    const userMessage: Message = { text: input, sender: "user" }
    setMessages((prev) => [...prev, userMessage])
    setPlanSteps([])
    setIsLoading(true)
    setInput("")

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/api/chat/stream`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        // The endpoint is protected by this HEADER token
        "Authorization": `Bearer ${session.accessToken}` 
      },
      body: JSON.stringify({ 
        message: currentInput, 
        // --- THIS IS THE NEW FIELD ---
        // We pass the access token in the BODY for the AGENT to use
        access_token: session.accessToken
      }),
    })

    if (!response.ok || !response.body) {
      setIsLoading(false)
      const errorText = await response.text()
      const errorMessage: Message = { text: `Sorry, I ran into an error: ${errorText}`, sender: "ai" }
      setMessages((prev) => [...prev, errorMessage])
      return
    }

    // ... (rest of your streaming/parser logic is unchanged)
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
                content: `Result: ${data.output.substring(0, 150)}...`,
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
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      parser.feed(chunk)
    }

    setIsLoading(false)
  }

  // ... (Your JSX remains unchanged) ...
  return (
    <div className="flex h-screen flex-col bg-white text-black">
      <header className="ml-8 flex shrink-0 items-center justify-between border-b-2 border-black p-4">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Agent Chat
        </h1>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-4 ${msg.sender === "user" ? "justify-end" : ""}`}
              >
                {msg.sender === "ai" && <Bot className="h-8 w-8 flex-shrink-0 text-orange-500" />}
                <div
                  style={{ fontFamily: "'Baloo 2', cursive" }}
                  className={`max-w-lg rounded-2xl border-2 border-black px-5 py-3 shadow-[2px_2px_0px_#000] ${
                    msg.sender === "user" ? "bg-orange-500 text-white" : "bg-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-base">{msg.text}</p>
                </div>
                {msg.sender === "user" && <User className="h-8 w-8 flex-shrink-0 text-gray-700" />}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative ml-8 flex shrink-0 items-center gap-2 border-t-2 border-black bg-white p-4"
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            
            {showLinkInput ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  placeholder="Paste link and press Enter"
                  value={linkInputValue}
                  onChange={(e) => setLinkInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); confirmAttachLink(); }
                    if (e.key === "Escape") { e.preventDefault(); setShowLinkInput(false); }
                  }}
                  autoFocus
                  className="flex-1 border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  style={{ fontFamily: "'Baloo 2', cursive" }}
                />
                <Button type="button" size="icon" onClick={confirmAttachLink} className="bg-orange-500 hover:bg-orange-600 rounded-xl border-2 border-black"><Check className="h-5 w-5"/></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setShowLinkInput(false)} className="rounded-xl hover:bg-gray-200"><X className="h-5 w-5"/></Button>
              </div>
            ) : (
              <>
                <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading || !isFullyAuthenticated} title="Attach File" className="rounded-full hover:bg-orange-100">
                  <Paperclip className="h-6 w-6" />
                </Button>
                <Button type="button" variant="ghost" onClick={startAttachLink} size="icon" title="Attach link" className="rounded-full hover:bg-orange-100" disabled={isLoading || !isFullyAuthenticated}>
                  <LinkIcon className="h-6 w-6" />
                </Button>

                {attachedLink && (
                  <div className="flex items-center gap-2 rounded-full bg-orange-100 p-2 text-sm" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    <LinkIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="max-w-[150px] truncate">{attachedLink}</span>
                    <button type="button" onClick={removeAttachedLink} className="p-1 hover:bg-orange-200 rounded-full"> <X className="h-4 w-4" /> </button>
                  </div>
                )}

                <Input
                  placeholder="Ask your agent..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!isFullyAuthenticated || isLoading}
                  style={{ fontFamily: "'Baloo 2', cursive" }}
                  className="flex-1 rounded-full border-2 border-black px-5 py-6 text-base focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 rounded-full border-2 border-black bg-orange-500 shadow-[2px_2px_0px_#000] hover:bg-orange-600"
                  disabled={!isFullyAuthenticated || isLoading || !input.trim()}
                  title="Send message"
                >
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                </Button>
              </>
            )}
          </form>
        </div>
        <aside className="hidden w-80 shrink-0 border-l-2 border-black bg-orange-50 p-4 lg:flex flex-col">
          <Card className="h-full border-4 border-black bg-white shadow-[4px_4px_0px_#000] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                Agent Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {planSteps.length === 0 && (
                <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
                  {isLoading ? "Agent is thinking..." : "The agent's real-time plan will appear here."}
                </p>
              )}
              <div className="relative space-y-4">
                {planSteps.length > 1 && <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-300"></div>}
                <AnimatePresence>
                  {planSteps.map((step, index) => {
                    const Icon = step.type === "Tool Call" ? Zap : step.type === "Tool Output" ? Terminal : CheckCircle2;
                    const color = step.type === "Tool Call" ? "text-orange-600" : step.type === "Tool Output" ? "text-gray-600" : "text-green-600";
                    return (
                      <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 flex items-start gap-4">
                        <div className={`flex-shrink-0 rounded-full border-2 border-gray-300 bg-white p-2 ${color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1" style={{ fontFamily: "'Baloo 2', cursive" }}>
                          <p className={`font-bold ${color}`}>{step.type}</p>
                          <p className="break-words text-sm text-gray-800">{step.content}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}