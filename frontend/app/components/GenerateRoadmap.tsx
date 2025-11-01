"use client"
import React, { useState, FormEvent } from "react"

import { createParser, type EventSourceMessage } from "eventsource-parser"
import { Loader2 } from "lucide-react"
import RoadmapDisplay from "./RoadmapDisplay" // New Component
import PopularRoadmaps from "./PopularRoadmaps" // New Component
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// --- Define Types (can be moved to a types.ts file) ---
export interface RoadmapStep { 
  title: string
  tasks: string[]
}
export interface Roadmap { 
  id?: string 
  goal: string
  steps: RoadmapStep[]
  error?: string
  user_id?: string
  upvotes?: number
}
type JsonData = Record<string, unknown>;

// --- Helper Components (omitted for brevity) ---
interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}
const PrimaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button {...props} style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }} className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600">
    {children}
  </Button>
)
const DoodleInput = (props: React.ComponentProps<typeof Input>) => (
  <Input {...props} style={{ fontFamily: "'Baloo 2', cursive" }} className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base" />
)
// ---

// Props type for the component
interface GenerateRoadmapProps {
  session: any;
  isFullyAuthenticated: boolean;
  requestProtectedAccess: () => boolean;
}

export default function GenerateRoadmap({ session, isFullyAuthenticated, requestProtectedAccess }: GenerateRoadmapProps) {
  const [goal, setGoal] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)

  // Your existing roadmap parsing logic
  const parseRoadmapResponse = (response: string): Roadmap | null => {
     try {
      // ... (parsing logic is the same) ...
      let parsedData: JsonData;

      try {
        parsedData = JSON.parse(response) as JsonData
      } catch {
        const cleanedResponse = response
          .replace(/```json\s*/g, "")
          .replace(/```\s*$/g, "")
          .trim()
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON object found in response")
        }
        parsedData = JSON.parse(jsonMatch[0]) as JsonData
      }

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
        const steps: RoadmapStep[] = (roadmapJson.stages as any[]).map((stage: unknown, index: number) => {
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

  // New save function
  const saveRoadmapToDb = async (goal: string, roadmap: Roadmap, user_id: string): Promise<Roadmap | null> => {
    try {
      const response = await fetch('/api/roadmaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal,
          roadmap_json: roadmap,
          user_id: user_id
        })
      });
      if (!response.ok) throw new Error('Failed to save roadmap');
      const data = await response.json();
      console.log("Roadmap saved to database.");
      return { ...roadmap, ...data.roadmap }; // Merge the new ID/upvotes from the DB
    } catch (error) {
      console.error("Failed to save roadmap:", error);
      return roadmap;
    }
  }
  
  // Your existing handleSubmit, now calls the save function
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || !isFullyAuthenticated || !session?.accessToken) {
      requestProtectedAccess()
      return
    }
    
    setIsLoading(true)
    setRoadmap(null)
    
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
      
      let finalRoadmap: Roadmap | null = null;

      
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
              
              if (parsedRoadmap && !parsedRoadmap.error && session?.user?.email) {
                 finalRoadmap = parsedRoadmap; // Store result
              } else {
                 finalRoadmap = parsedRoadmap; // Store result
              }
            } else if (event.event === "tool_start") {
              console.log("Advisor agent started tool:", JSON.parse(event.data))
            }
          } catch (e) {
            console.error("Streaming parse error:", e)
            finalRoadmap = {
              goal,
              steps: [{ title: "Parsing Error", tasks: ["The agent&apos;s response was not in the correct format."] }],
              error: (e as Error).message,
            };
          }
        },
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        parser.feed(chunk)
      }

      // --- NEW FIX: Process after stream completes ---
      if (finalRoadmap && !(finalRoadmap as Roadmap).error && session?.user?.email) {
  const savedRoadmap = await saveRoadmapToDb(goal, finalRoadmap as Roadmap, session.user.email);
  setRoadmap(savedRoadmap);
} else {
  setRoadmap(finalRoadmap);
}

      // --- END OF NEW FIX ---

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
  
  return (
    <div>
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
      
      {isLoading && (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        </div>
      )}

      {/* FIX: Ensure roadmap.steps exists before calling RoadmapDisplay */}
      {roadmap && roadmap.steps && (
        <RoadmapDisplay 
          initialRoadmap={roadmap}
          currentUserId={session?.user?.email}
        />
      )}

      {/* FIX: Only show Popular if no generation is active and no roadmap is showing */}
      {!roadmap && !isLoading && (
        <PopularRoadmaps currentUserId={session?.user?.email} />
      )}

    </div>
  )
}