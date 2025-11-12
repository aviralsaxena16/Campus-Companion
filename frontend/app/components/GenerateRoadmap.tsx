"use client";
import React, { useState, FormEvent } from "react";
import { createParser, type EventSourceMessage } from "eventsource-parser";
import { Loader2 } from "lucide-react";
import RoadmapDisplay from "./RoadmapDisplay";
import PopularRoadmaps from "./PopularRoadmaps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Session } from "next-auth";

// --- Define Types ---
export interface RoadmapStep {
  title: string;
  tasks: string[];
}
export interface Roadmap {
  id?: string;
  goal: string;
  steps: RoadmapStep[];
  error?: string;
  user_id?: string;
  upvotes?: number;
}
type JsonData = Record<string, unknown>;

interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}
const PrimaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button
    {...props}
    style={{
      fontFamily: "'Luckiest Guy', cursive",
      boxShadow: "2px 2px 0px #000",
    }}
    className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600"
  >
    {children}
  </Button>
);
const DoodleInput = (props: React.ComponentProps<typeof Input>) => (
  <Input
    {...props}
    style={{ fontFamily: "'Baloo 2', cursive" }}
    className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base"
  />
);

// --- Props type ---
interface GenerateRoadmapProps {
  session: Session | null;
  isFullyAuthenticated: boolean;
  requestProtectedAccess: () => boolean;
}

export default function GenerateRoadmap({
  session,
  isFullyAuthenticated,
  requestProtectedAccess,
}: GenerateRoadmapProps) {
  const [goal, setGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  // --- Helper: find all balanced JSON objects ---
  const extractAllJsonObjects = (text: string): string[] => {
    const results: string[] = [];
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        if (inString) escapeNext = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (ch === "{") {
          if (depth === 0) startIndex = i;
          depth++;
        } else if (ch === "}" && depth > 0) {
          depth--;
          if (depth === 0 && startIndex !== -1) {
            results.push(text.substring(startIndex, i + 1));
            startIndex = -1;
          }
        }
      }
    }
    return results;
  };

  // --- Helper: unwrap nested advisor_tool_response ---
  const unwrapAdvisorWrapper = (obj: unknown): Record<string, unknown> => {
    let current = obj as Record<string, unknown>;
    while (
      current &&
      typeof current === "object" &&
      "advisor_tool_response" in current &&
      (Object.keys(current).length === 1 ||
        typeof (current as Record<string, unknown>).advisor_tool_response ===
          "object")
    ) {
      current = (current as Record<string, unknown>)
        .advisor_tool_response as Record<string, unknown>;
    }
    return current;
  };

  // --- Robust parse function ---
  const parseRoadmapResponse = (
    response: string,
    fallbackGoal = "Learning Plan"
  ): Roadmap => {
    try {
      if (!response || typeof response !== "string") {
        throw new Error("Empty or non-string response");
      }

      const cleaned = response
        .replace(/```(?:json)?\s*/g, "")
        .replace(/```\s*$/g, "")
        .trim();

      const jsonBlocks = extractAllJsonObjects(cleaned);
      console.log("[parseRoadmapResponse] Found JSON blocks:", jsonBlocks.length);

      if (jsonBlocks.length === 0) {
        throw new Error("No JSON blocks found in response");
      }

      for (let i = jsonBlocks.length - 1; i >= 0; i--) {
        const block = jsonBlocks[i];
        try {
          let parsed = JSON.parse(block) as JsonData;
          parsed = unwrapAdvisorWrapper(parsed);

          if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.goal === "string" &&
            Array.isArray(parsed.steps)
          ) {
            const steps: RoadmapStep[] = (parsed.steps as unknown[]).map(
              (s) => {
                const stepObj = (s as JsonData) ?? {};
                const title =
                  typeof stepObj.title === "string"
                    ? String(stepObj.title)
                    : "Untitled Step";
                const tasks: string[] = Array.isArray(stepObj.tasks)
                  ? (stepObj.tasks as unknown[]).map((t) => String(t))
                  : [];
                return { title, tasks };
              }
            );
            const roadmapObj: Roadmap = { goal: String(parsed.goal), steps };
            console.log(
              "[parseRoadmapResponse] Parsed valid roadmap from block index",
              i
            );
            return roadmapObj;
          }
        } catch {
          try {
            const fixed = block.replace(/,(\s*[}\]])/g, "$1");
            let parsed = JSON.parse(fixed) as JsonData;
            parsed = unwrapAdvisorWrapper(parsed);
            if (
              parsed &&
              typeof parsed.goal === "string" &&
              Array.isArray(parsed.steps)
            ) {
              const steps: RoadmapStep[] = (parsed.steps as unknown[]).map(
                (s) => {
                  const stepObj = (s as JsonData) ?? {};
                  const title =
                    typeof stepObj.title === "string"
                      ? String(stepObj.title)
                      : "Untitled Step";
                  const tasks: string[] = Array.isArray(stepObj.tasks)
                    ? (stepObj.tasks as unknown[]).map((t) => String(t))
                    : [];
                  return { title, tasks };
                }
              );
              const roadmapObj: Roadmap = { goal: String(parsed.goal), steps };
              console.log(
                "[parseRoadmapResponse] Parsed valid roadmap after minor fix from block index",
                i
              );
              return roadmapObj;
            }
          } catch {
            // ignore and continue
          }
        }
      }

      throw new Error(
        "No valid roadmap structure found inside extracted JSON blocks"
      );
    } catch (error) {
      console.error("[parseRoadmapResponse] Final parse error:", error);
      return {
        goal: fallbackGoal,
        steps: [
          {
            title: "Parsing Error",
            tasks: [
              "Sorry, I couldn't parse the roadmap. The AI returned an unexpected format.",
              "Try again or refine your prompt (shorter, ask for JSON only).",
              `Debug: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ],
          },
        ],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const saveRoadmapToDb = async (
    goal: string,
    roadmapObj: Roadmap,
    user_id: string
  ): Promise<Roadmap | null> => {
    try {
      const response = await fetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal,
          roadmap_json: roadmapObj,
          user_id: user_id,
        }),
      });
      if (!response.ok) throw new Error("Failed to save roadmap");
      const data = await response.json();
      console.log("Roadmap saved to database.");
      return { ...roadmapObj, ...data.roadmap };
    } catch (error) {
      console.error("Failed to save roadmap:", error);
      return roadmapObj;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || !isFullyAuthenticated || !session?.accessToken) {
      requestProtectedAccess();
      return;
    }

    setIsLoading(true);
    setRoadmap(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          message: `Create a roadmap for: ${goal}`,
          access_token: session.accessToken,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalRoadmap: Roadmap | null = null;

      const parser = createParser({
        onEvent(event: EventSourceMessage) {
          try {
            if (event.event === "final_chunk") {
              const data = JSON.parse(event.data);
              const roadmapJsonString = data.output;

              if (!roadmapJsonString) {
                throw new Error("Agent returned an empty response.");
              }

              const parsedRoadmap = parseRoadmapResponse(roadmapJsonString);
              finalRoadmap = parsedRoadmap;
            } else if (event.event === "tool_start") {
              console.log(
                "Advisor agent started tool:",
                JSON.parse(event.data)
              );
            }
          } catch (e) {
            console.error("Streaming parse error:", e);
            finalRoadmap = {
              goal,
              steps: [
                {
                  title: "Parsing Error",
                  tasks: [
                    "The agent's response was not in the correct format.",
                  ],
                },
              ],
              error: (e as Error).message,
            };
          }
        },
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }

      if (finalRoadmap  && session?.user?.email) {
        const savedRoadmap = await saveRoadmapToDb(
          goal,
          finalRoadmap,
          session.user.email
        );
        setRoadmap(savedRoadmap);
      } else {
        setRoadmap(finalRoadmap);
      }
    } catch (error) {
      console.error("Advisor API error:", error);
      setRoadmap({
        goal,
        steps: [
          {
            title: "Connection Error",
            tasks: ["Sorry, I couldn't generate a roadmap right now."],
          },
        ],
        error: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <p
        className="text-gray-800 mb-6 text-lg"
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        Ask for a plan to achieve a goal, and the agent will generate a
        step-by-step roadmap for you.
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-8">
        <DoodleInput
          placeholder="e.g., 'Prepare for Google Summer of Code'"
          value={goal}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setGoal(e.target.value)
          }
          disabled={isLoading}
          className="flex-1"
        />
        <PrimaryButton
          type="submit"
          disabled={isLoading || !goal.trim() || !isFullyAuthenticated}
        >
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

      {roadmap && roadmap.steps && (
        <RoadmapDisplay
          initialRoadmap={roadmap}
          currentUserId={session?.user?.email ?? undefined}
        />
      )}

      {!roadmap && !isLoading && (
        <PopularRoadmaps currentUserId={session?.user?.email ?? undefined} />
      )}
    </div>
  );
}
