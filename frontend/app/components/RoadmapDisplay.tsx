"use client"
import React, { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Edit, Save, XCircle, CheckCircle2, Plus, Trash2, ThumbsUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { type Roadmap, type RoadmapStep } from "./GenerateRoadmap" // Import shared types

// --- HELPER COMPONENTS (omitted for brevity) ---
interface CustomButtonProps extends React.ComponentProps<typeof Button> { children: React.ReactNode; }
const PrimaryButton = ({ children, ...props }: CustomButtonProps) => ( /* ... */ <Button {...props} style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }} className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600"> {children} </Button> )
const SecondaryButton = ({ children, ...props }: CustomButtonProps) => ( /* ... */ <Button {...props} variant="outline" style={{ fontFamily: "'Baloo 2', cursive" }} className="bg-white text-black border-2 border-black rounded-xl px-4 py-2 text-sm font-bold hover:bg-orange-100"> {children} </Button> )
const DoodleInput = (props: React.ComponentProps<typeof Input>) => ( /* ... */ <Input {...props} style={{ fontFamily: "'Baloo 2', cursive" }} className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base" /> )

const DoodleTextarea = (props: React.ComponentProps<typeof Textarea>) => ( /* ... */ <Textarea {...props} style={{ fontFamily: "'Baloo 2', cursive" }} className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-sm" /> )
// ---

interface RoadmapDisplayProps {
  initialRoadmap: Roadmap;
  currentUserId: string | undefined;
}

export default function RoadmapDisplay({ initialRoadmap, currentUserId }: RoadmapDisplayProps) {
  const [roadmap, setRoadmap] = useState<Roadmap>(initialRoadmap);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRoadmap, setEditedRoadmap] = useState<Roadmap>(initialRoadmap);
  const roadmapRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpvoting, setIsUpvoting] = useState(false);
  
  const [localUpvotes, setLocalUpvotes] = useState(roadmap.upvotes || 0);

  // ... (handleDownloadPdf, handleSaveChanges, handleUpvote functions are unchanged) ...
  const handleDownloadPdf = async () => { /* ... (same logic) ... */ };
  const handleSaveChanges = async () => { /* ... (same logic) ... */ };
  const handleUpvote = async () => { /* ... (same logic) ... */ };
  const handleEditChange = (phaseIndex: number, taskIndex: number, value: string) => { /* ... (same logic) ... */ };
  const handlePhaseTitleChange = (phaseIndex: number, value: string) => { /* ... (same logic) ... */ };
  const handleAddTask = (stepIndex: number) => { /* ... (same logic) ... */ };
  const handleRemoveTask = (stepIndex: number, taskIndex: number) => { /* ... (same logic) ... */ };
  const handleAddStep = () => { /* ... (same logic) ... */ };

  // --- CRASH FIX: Add early return if data is invalid ---
  if (!roadmap || roadmap.error || !roadmap.steps || roadmap.steps.length === 0) {
    return (
        <div className="space-y-8 p-6 border-4 border-dashed border-red-300 rounded-3xl">
          <h2 className="text-4xl font-bold text-red-500" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            {roadmap?.goal || 'Generation Error'}
          </h2>
          <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {roadmap?.steps?.[0]?.tasks?.[0] || 'Roadmap data is invalid or missing steps.'}
          </p>
        </div>
    );
  }
  // --- END CRASH FIX ---
  
  const canEdit = currentUserId && currentUserId === roadmap.user_id;

  return (
    <div className="space-y-6">
      {/* Header with Buttons */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleUpvote} 
            disabled={isUpvoting || !currentUserId} 
            variant="outline" 
            className="border-2 border-black rounded-xl font-bold shadow-[2px_2px_0px_#000] hover:bg-orange-100"
          >
            <ThumbsUp className="w-5 h-5 mr-2 text-orange-500" />
            {localUpvotes}
          </Button>
          {canEdit && (
            isEditing ? (
              <div className="flex gap-2">
                <SecondaryButton
                  onClick={() => {
                    setIsEditing(false);
                    setEditedRoadmap(roadmap);
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </PrimaryButton>
              </div>
            ) : (
              <PrimaryButton onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Plan
              </PrimaryButton>
            )
          )}
        </div>
        <SecondaryButton onClick={handleDownloadPdf} disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Downloading..." : "Download as PDF"}
        </SecondaryButton>
      </div>
      
      {/* The Roadmap Itself */}
      <div ref={roadmapRef} className="bg-white">
        <div className="space-y-8 p-6 border-4 border-black rounded-3xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              {isEditing ? (
                <DoodleInput
  value={editedRoadmap?.goal || ""}
  onChange={(e) =>
    setEditedRoadmap((prev) => ({ ...prev, goal: e.target.value }))
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
            {(isEditing ? editedRoadmap : roadmap).steps.map((step, stepIndex: number) => (
              <Card key={stepIndex} className="border-4 border-black rounded-2xl shadow-[4px_4px_0px_#000] bg-white">
                <CardHeader>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <DoodleInput
                        value={step.title}
                        onChange={(e) =>
                          handlePhaseTitleChange(stepIndex, e.target.value)
                        }
                        className="text-2xl font-bold h-12"
                        style={{ fontFamily: "'Baloo 2', cursive" }}
                      />
                      
                      <SecondaryButton onClick={() => handleAddTask(stepIndex)} size="icon">
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
                              onChange={(e) =>
                                handleEditChange(stepIndex, taskIndex, e.target.value)
                              }
                              className="leading-relaxed min-h-[60px]"
                            />
                            <SecondaryButton
                              onClick={() => handleRemoveTask(stepIndex, taskIndex)}
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-100 hover:border-red-500 rounded-full"
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
      </div>
    </div>
  );
}