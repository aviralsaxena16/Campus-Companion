"use client"
import React, { useState, useRef, type FormEvent } from "react"
import { useAuth } from "@/context/AuthContext" 
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Edit, Save, XCircle, Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react"
import jsPDF from "jspdf"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createParser, type EventSourceMessage } from "eventsource-parser"


// --- FIX: Get Prop types directly from React components ---
type CustomButtonProps = React.ComponentProps<typeof Button>
type CustomInputProps = React.ComponentProps<typeof Input>
type CustomTextareaProps = React.ComponentProps<typeof Textarea>


interface RoadmapStep {
  title: string
  tasks: string[]
}
interface Roadmap {
  goal: string
  steps: RoadmapStep[]
  error?: string
}
// --- FIX: Create a type for the raw JSON data ---
type JsonData = Record<string, unknown>;


const PrimaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button
    {...props}
    style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }}
    className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600"
  >
    {children}
  </Button>
)


const SecondaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button
    {...props}
    variant="outline"
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="bg-white text-black border-2 border-black rounded-xl px-4 py-2 text-sm font-bold hover:bg-orange-100"
  >
    {children}
  </Button>
)


const DoodleInput = (props: CustomInputProps) => (
  <Input
    {...props}
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base"
  />
)


const DoodleTextarea = (props: CustomTextareaProps) => (
  <Textarea
    {...props}
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-sm"
  />
)


export default function AdvisorView() {
  const { session, isFullyAuthenticated, requestProtectedAccess } = useAuth()
  const [goal, setGoal] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedRoadmap, setEditedRoadmap] = useState<Roadmap | null>(null)
  const roadmapRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)


  const parseRoadmapResponse = (response: string): Roadmap | null => {
    try {
      console.log("[v0] Raw response:", response)
      let parsedData: JsonData;


      try {
        parsedData = JSON.parse(response) as JsonData
      } catch {
        const cleanedResponse = response
          .replace(/```\s*$/g, "")
          .trim()
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON object found in response")
        }
        parsedData = JSON.parse(jsonMatch[0]) as JsonData
      }


      console.log("[v0] Parsed data:", parsedData)


      const roadmapJson: JsonData = (parsedData.advisor_tool_response && typeof parsedData.advisor_tool_response === 'object')
                            ? parsedData.advisor_tool_response as JsonData
                            : parsedData;


      let roadmapData: Roadmap


      if (typeof roadmapJson.goal === 'string' && Array.isArray(roadmapJson.steps)) {
        roadmapData = {
          goal: roadmapJson.goal,
          steps: roadmapJson.steps as RoadmapStep[]
        }
      } else if (typeof roadmapJson.title === 'string' && Array.isArray(roadmapJson.stages)) {
        const steps: RoadmapStep[] = roadmapJson.stages.map((stage: unknown, index: number) => {
          const stageData = stage as JsonData;
          const tasks: string[] = []
          if (Array.isArray(stageData.topics)) { tasks.push(...stageData.topics) }
          if (Array.isArray(stageData.tasks)) { tasks.push(...stageData.tasks) }
          if (Array.isArray(stageData.content)) { tasks.push(...stageData.content) }
          if (stageData.duration) { tasks.unshift(`Duration: ${stageData.duration}`) }
          if (Array.isArray(stageData.resources) && stageData.resources.length > 0) {
            tasks.push("Resources:")
            tasks.push(...stageData.resources.map((resource: string) => `• ${resource}`))
          }
          return {
            title: String(stageData.name || stageData.title || `Stage ${index + 1}`),
            tasks: tasks.length > 0 ? tasks : [`Complete ${String(stageData.name || `Stage ${index + 1}`)}`],
          }
        })
        if (Array.isArray(roadmapJson.additional_tips) && roadmapJson.additional_tips.length > 0) {
          steps.push({
            title: "Additional Tips",
            tasks: roadmapJson.additional_tips as string[],
          })
        }
        roadmapData = { goal: roadmapJson.title, steps: steps }
      } else if (typeof roadmapJson.title === 'string' && typeof roadmapJson.timeline === 'object' && roadmapJson.timeline !== null) {
        const steps: RoadmapStep[] = Object.values(roadmapJson.timeline).map((phase: unknown) => {
          const phaseData = phase as JsonData;
          return {
            title: String(phaseData.name || phaseData.title),
            tasks: (phaseData.tasks || phaseData.topics || []) as string[],
          }
        })
        roadmapData = { goal: roadmapJson.title, steps: steps }
      } else {
        const goal = String(roadmapJson.title || roadmapJson.goal || roadmapJson.name || "Learning Plan")
        const steps: RoadmapStep[] = []
        const stepsData = roadmapJson.steps || roadmapJson.stages || roadmapJson.phases || roadmapJson.timeline


        if (Array.isArray(stepsData)) {
          stepsData.forEach((item: unknown, index: number) => {
            const itemData = item as JsonData;
            const tasks: string[] = []
            if (Array.isArray(itemData.tasks)) { tasks.push(...itemData.tasks) }
            if (Array.isArray(itemData.topics)) { tasks.push(...itemData.topics) }
            if (Array.isArray(itemData.content)) { tasks.push(...itemData.content) }
            if (itemData.description) { tasks.push(String(itemData.description)) }
            steps.push({
              title: String(itemData.title || itemData.name || `Step ${index + 1}`),
              tasks: tasks.length > 0 ? tasks : [`Complete ${String(itemData.title || itemData.name || `Step ${index + 1}`)}`],
            })
          })
        } else if (typeof stepsData === "object" && stepsData !== null) {
          Object.values(stepsData).forEach((item: unknown, index: number) => {
            const itemData = item as JsonData;
            const tasks: string[] = []
            if (Array.isArray(itemData.tasks)) { tasks.push(...itemData.tasks) }
            if (Array.isArray(itemData.topics)) { tasks.push(...itemData.topics) }
            if (Array.isArray(itemData.content)) { tasks.push(...itemData.content) }
            if (itemData.description) { tasks.push(String(itemData.description)) }
            steps.push({
              title: String(itemData.title || itemData.name || `Step ${index + 1}`),
              tasks: tasks.length > 0 ? tasks : [`Complete ${String(itemData.title || itemData.name || `Step ${index + 1}`)}`],
            })
          })
        }
        if (steps.length === 0) {
          throw new Error("No valid steps found in response")
        }
        roadmapData = { goal, steps }
      }


      roadmapData.steps = roadmapData.steps.map((step) => ({
        ...step,
        tasks: Array.isArray(step.tasks) ? step.tasks.map(task => String(task)).filter((task) => typeof task === "string") : [],
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
            tasks: ["Sorry, I couldn&apos;t parse the roadmap. The AI returned an unexpected format. Please try again."],
          },
        ],
        error: "Failed to parse response",
      }
    }
  }



  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || !isFullyAuthenticated || !session?.accessToken) {
      requestProtectedAccess()
      return
    }
    
    setIsLoading(true)
    setRoadmap(null)
    setEditedRoadmap(null)
    setIsEditing(false)
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}` 
        },
        body: JSON.stringify({ 
          message: `Create a roadmap for: ${goal}`, 
          access_token: session.accessToken
        }),
      })
      
      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }


      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const parser = createParser({
        onEvent(event: EventSourceMessage) {
          try {
            if (event.event === "final_chunk") {
              const data = JSON.parse(event.data)
              const roadmapJsonString = data.output 
              
              if (!roadmapJsonString) {
                throw new Error("Agent returned an empty response.")
              }


              const parsedRoadmap = parseRoadmapResponse(roadmapJsonString)
              setRoadmap(parsedRoadmap)
              if (parsedRoadmap) {
                setEditedRoadmap(JSON.parse(JSON.stringify(parsedRoadmap)))
              }
            } else if (event.event === "tool_start") {
              console.log("Advisor agent started tool:", JSON.parse(event.data))
            } else if (event.event === "error") {
              throw new Error(JSON.parse(event.data).detail)
            }
          } catch (e) {
            console.error("Streaming parse error:", e)
            setRoadmap({
              goal,
              steps: [{ title: "Parsing Error", tasks: ["The agent&apos;s response was not in the correct format."] }],
              error: (e as Error).message,
            })
          }
        },
      })


      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        parser.feed(chunk)
      }


    } catch (error) {
      console.error("Advisor API error:", error)
      setRoadmap({
        goal,
        steps: [{ title: "Connection Error", tasks: ["Sorry, I couldn&apos;t generate a roadmap right now."] }],
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
    if (!roadmap) return;
    setIsDownloading(true);


    try {
      const doc = new jsPDF();
      let yPosition = 20; 


      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(roadmap.goal, 105, yPosition, { align: "center" });
      yPosition += 15;


      roadmap.steps.forEach((step, stepIndex) => {
        if (yPosition > 25) {
          yPosition += 5;
        }
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }


        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Step ${stepIndex + 1}: ${step.title}`, 15, yPosition);
        yPosition += 10;


        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        step.tasks.forEach(task => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          const splitTask = doc.splitTextToSize(`• ${task}`, 175); 
          doc.text(splitTask, 20, yPosition);
          yPosition += (splitTask.length * 5) + 3; 
        });


        if (stepIndex < roadmap.steps.length - 1) {
           yPosition += 5;
           doc.line(15, yPosition, 195, yPosition); 
           yPosition += 5;
        }
      });


      doc.save(`${roadmap.goal.replace(/\s+/g, "_") || "roadmap"}.pdf`);


    } catch (error) {
      console.error("Simple PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };


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
    <div className="flex flex-col h-full bg-white text-black">
      <header className="flex items-center ml-8 border-b-2 border-black bg-white p-4 justify-between flex-wrap">
        <h1 className="text-3xl font-bold ml-8" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Advisor Agent
        </h1>
        {roadmap && !roadmap.error && (
          <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
            <SecondaryButton onClick={handleDownloadPdf} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download"}
            </SecondaryButton>
            {isEditing ? (
              <div className="flex gap-2">
                <SecondaryButton
                  onClick={() => {
                    setIsEditing(false)
                    setEditedRoadmap(roadmap)
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={handleSaveChanges}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </PrimaryButton>
              </div>
            ) : (
              <PrimaryButton onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Plan
              </PrimaryButton>
            )}
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <p className="text-gray-800 mb-6 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
            Ask for a plan to achieve a goal, and the agent will generate a step-by-step roadmap for you.
          </p>
          <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-8">
            <DoodleInput
              placeholder="e.g., &apos;Prepare for Google Summer of Code&apos;"
              value={goal}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <PrimaryButton type="submit" disabled={isLoading || !goal.trim() || !isFullyAuthenticated}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Plan"
              )}
            </PrimaryButton> 
          </form>


          <div ref={roadmapRef} className="bg-white">
            {roadmap && (
              <div className="space-y-8 p-6 border-4 border-black rounded-3xl">
                <div className="text-center">
                  <h2 className="text-4xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                    {isEditing ? (
                      <DoodleInput
                        value={editedRoadmap?.goal || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditedRoadmap((prev) => (prev ? { ...prev, goal: e.target.value } : null))
                        }
                        className="text-4xl font-bold text-center border-none shadow-none bg-transparent h-auto"
                        style={{ fontFamily: "'Luckiest Guy', cursive" }}
                      />
                    ) : (
                      roadmap.goal
                    )}
                  </h2>
                </div>
                <div className="grid gap-6">
                  {(isEditing ? editedRoadmap : roadmap)?.steps.map((step, stepIndex) => (
                    <Card key={stepIndex} className="border-4 border-black rounded-2xl shadow-[4px_4px_0px_#000] bg-white">
                      <CardHeader>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <DoodleInput
                              value={step.title}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handlePhaseTitleChange(stepIndex, e.target.value)
                              }
                              className="text-2xl font-bold h-12"
                              style={{ fontFamily: "'Baloo 2', cursive" }}
                            />
                            <SecondaryButton onClick={() => handleAddTask(stepIndex)}>
                              <Plus className="h-4 w-4" />
                            </SecondaryButton>
                          </div>
                        ) : (
                          <CardTitle className="text-2xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
                            Step {stepIndex + 1}: {step.title}
                          </CardTitle>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {step.tasks.map((task, taskIndex) => (
                            <div key={taskIndex} className="flex items-start gap-3">
                              <CheckCircle2 className="w-6 h-6 mt-0.5 flex-shrink-0 text-orange-500" />
                              {isEditing ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <DoodleTextarea
                                    value={task}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                      handleEditChange(stepIndex, taskIndex, e.target.value)
                                    }
                                    className="leading-relaxed min-h-[60px]"
                                  />
                                  <SecondaryButton
                                    onClick={() => handleRemoveTask(stepIndex, taskIndex)}
                                    className="text-red-600 hover:bg-red-100 hover:border-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </SecondaryButton>
                                </div>
                              ) : (
                                <span className="text-base leading-relaxed text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
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
                      <SecondaryButton onClick={handleAddStep}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Step
                      </SecondaryButton>
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
