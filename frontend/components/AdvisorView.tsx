"use client"
import React, { useState, useRef, type FormEvent } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Edit, Save, XCircle, Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface RoadmapStep {
  title: string
  tasks: string[]
}
interface Roadmap {
  goal: string
  steps: RoadmapStep[]
  error?: string
}

const PrimaryButton = ({ children, ...props }: any) => (
  <Button
    {...props}
    style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }}
    className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600"
  >
    {children}
  </Button>
)

const SecondaryButton = ({ children, ...props }: any) => (
  <Button
    {...props}
    variant="outline"
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="bg-white text-black border-2 border-black rounded-xl px-4 py-2 text-sm font-bold hover:bg-orange-100"
  >
    {children}
  </Button>
)

const DoodleInput = ({ ...props }: any) => (
  <Input
    {...props}
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base"
  />
)

const DoodleTextarea = ({ ...props }: any) => (
  <Textarea
    {...props}
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-sm"
  />
)


export default function AdvisorView() {
  const { data: session } = useSession()
  const [goal, setGoal] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedRoadmap, setEditedRoadmap] = useState<Roadmap | null>(null)
  const roadmapRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // ... (Your existing parseRoadmapResponse function remains unchanged)
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
    if (!roadmap) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF();
      let yPosition = 20; // Starting Y position for content

      // --- Set Document Title ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(roadmap.goal, 105, yPosition, { align: "center" });
      yPosition += 15;

      // --- Loop Through Each Step ---
      roadmap.steps.forEach((step, stepIndex) => {
        // Add space before a new section unless it's the first one
        if (yPosition > 25) {
          yPosition += 5;
        }

        // Check for page breaks
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        // --- Step Title ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Step ${stepIndex + 1}: ${step.title}`, 15, yPosition);
        yPosition += 10;

        // --- Step Tasks ---
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        step.tasks.forEach(task => {
          // Check for page breaks before adding a task
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }

          // Handle long text by splitting it
          const splitTask = doc.splitTextToSize(`• ${task}`, 175); // 175 is the max width
          doc.text(splitTask, 20, yPosition);
          yPosition += (splitTask.length * 5) + 3; // Move yPosition down based on number of lines
        });

        // --- Section Line ---
        if (stepIndex < roadmap.steps.length - 1) {
             yPosition += 5;
             doc.line(15, yPosition, 195, yPosition); // Draw a line from left to right
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
      <header className="flex items-center border-b-2 border-black bg-white p-4 justify-between flex-wrap">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
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
              </PrimaryButton> // <-- FIXED TYPO HERE
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
              placeholder="e.g., 'Prepare for Google Summer of Code'"
              value={goal}
              // FIXED: Added explicit type for the event parameter 'e'
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <PrimaryButton type="submit" disabled={isLoading || !goal.trim()}>
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
                        // FIXED: Added explicit type for the event parameter 'e'
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
                              // FIXED: Added explicit type for the event parameter 'e'
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
                                    // FIXED: Added explicit type for the event parameter 'e'
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