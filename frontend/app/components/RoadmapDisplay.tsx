"use client"
import React, { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Edit, Save, XCircle, CheckCircle2, Plus, Trash2, ThumbsUp, Loader2 } from "lucide-react"
import { Button,} from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { type Roadmap, type RoadmapStep } from "./GenerateRoadmap"

interface CustomButtonProps extends React.ComponentProps<typeof Button> { children: React.ReactNode; }
const PrimaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button {...props} style={{ fontFamily: "'Luckiest Guy', cursive", boxShadow: "2px 2px 0px #000" }} className="bg-orange-500 text-white border-2 border-black rounded-xl px-6 py-2 text-base hover:bg-orange-600">
    {children}
  </Button>
)
const SecondaryButton = ({ children, ...props }: CustomButtonProps) => (
  <Button {...props} variant="outline" style={{ fontFamily: "'Baloo 2', cursive" }} className="bg-white text-black border-2 border-black rounded-xl px-4 py-2 text-sm font-bold hover:bg-orange-100">
    {children}
  </Button>
)
const DoodleInput = (props: React.ComponentProps<typeof Input>) => (
  <Input {...props} style={{ fontFamily: "'Baloo 2', cursive" }} className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-base" />
)
const DoodleTextarea = (props: React.ComponentProps<typeof Textarea>) => (
  <Textarea {...props} style={{ fontFamily: "'Baloo 2', cursive" }} className="border-2 border-black rounded-xl focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-sm" />
)

interface RoadmapDisplayProps {
  initialRoadmap: Roadmap;
  currentUserId: string | undefined;
  isCompact?: boolean;
  onFullViewRequest?: (roadmap: Roadmap) => void;
}

export default function RoadmapDisplay({ initialRoadmap, currentUserId, isCompact = false, onFullViewRequest }: RoadmapDisplayProps) {
  const [roadmap, setRoadmap] = useState<Roadmap>(initialRoadmap);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRoadmap, setEditedRoadmap] = useState<Roadmap>(initialRoadmap);
  const roadmapRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpvoting, setIsUpvoting] = useState(false);
  
  const [localUpvotes, setLocalUpvotes] = useState(roadmap.upvotes || 0);

  // PDF Download with simplified inline styles
  const handleDownloadPdf = async () => {
    if (!roadmapRef.current) return;
    setIsDownloading(true);

    try {
      // Capture directly with simplified settings
      const canvas = await html2canvas(roadmapRef.current, {
        scale: 3, // Increased scale for better quality
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: roadmapRef.current.scrollWidth,
        windowHeight: roadmapRef.current.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = imgWidth / imgHeight;
      
      // Use almost full width with minimal margins (5mm on each side)
      let widthInPdf = pdfWidth - 10; 
      let heightInPdf = widthInPdf / ratio;
      
      // If height exceeds page, fit to height instead
      if (heightInPdf > pdfHeight - 10) {
        heightInPdf = pdfHeight - 10;
        widthInPdf = heightInPdf * ratio;
      }
      
      const x = (pdfWidth - widthInPdf) / 2;
      const y = 5; // Minimal top margin
      
      pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
      pdf.save(`${roadmap.goal.replace(/\s+/g, "_") || "roadmap"}.pdf`);

    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editedRoadmap || !editedRoadmap.id || !currentUserId) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/roadmaps/${editedRoadmap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_json: editedRoadmap, 
          user_id: currentUserId,
        })
      });
      
      if (!response.ok) throw new Error('Failed to save changes');
      
      const data = await response.json();
      const newRoadmap = {
        ...data.roadmap.roadmap_json,
        id: data.roadmap.id,
        upvotes: data.roadmap.upvotes,
        user_id: data.roadmap.user_id
      }
      setRoadmap(newRoadmap); 
      setEditedRoadmap(newRoadmap);
      setIsEditing(false);
      
    } catch (error) {
      console.error('Save changes error:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpvote = async () => {
    if (!roadmap.id || !currentUserId) {
      alert("Please sign in to upvote.");
      return;
    }
    
    setIsUpvoting(true);
    try {
      const response = await fetch(`/api/roadmaps/${roadmap.id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId })
      });
      
      if (!response.ok) throw new Error('Failed to toggle upvote');
      
      const data = await response.json();
      setLocalUpvotes(data.new_upvote_count);

    } catch (error) {
      console.error('Upvote error:', error);
      alert('Failed to submit upvote.');
    } finally {
      setIsUpvoting(false);
    }
  }

  const handleEditChange = (phaseIndex: number, taskIndex: number, value: string) => {
    setEditedRoadmap(prev => {
      const newSteps = [...prev.steps];
      newSteps[phaseIndex].tasks[taskIndex] = value;
      return { ...prev, steps: newSteps };
    });
  };

  const handlePhaseTitleChange = (phaseIndex: number, value: string) => {
    setEditedRoadmap(prev => {
      const newSteps = [...prev.steps];
      newSteps[phaseIndex].title = value;
      return { ...prev, steps: newSteps };
    });
  };

  const handleAddTask = (stepIndex: number) => {
    setEditedRoadmap(prev => {
      const newSteps = [...prev.steps];
      newSteps[stepIndex].tasks.push("New task");
      return { ...prev, steps: newSteps };
    });
  };

  const handleRemoveTask = (stepIndex: number, taskIndex: number) => {
    setEditedRoadmap(prev => {
      const newSteps = [...prev.steps];
      newSteps[stepIndex].tasks.splice(taskIndex, 1);
      return { ...prev, steps: newSteps };
    });
  };

  const handleAddStep = () => {
    setEditedRoadmap(prev => ({
      ...prev,
      steps: [...prev.steps, { title: "New Step", tasks: ["New task"] }]
    }));
  };
  
  const canEdit = currentUserId && currentUserId === roadmap.user_id;
  const currentSteps = (isEditing ? editedRoadmap : roadmap)?.steps;

  if (isCompact) {
    return (
      <Card 
        key={roadmap.id} 
        className="border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] bg-white cursor-pointer hover:shadow-[4px_4px_0px_#000] transition-shadow duration-200"
        onClick={() => onFullViewRequest && onFullViewRequest(roadmap)}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {roadmap.goal}
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-sm font-bold" style={{ color: '#f97316' }}>
              <ThumbsUp className="w-4 h-4 mr-1" />
              {localUpvotes}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 truncate" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {currentSteps?.[0]?.tasks?.[0] || 'Click to view details...'}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (!roadmap || roadmap.error || !currentSteps || currentSteps.length === 0) {
    return (
        <div className="space-y-8 p-6 border-4 border-dashed rounded-3xl" style={{ borderColor: '#fca5a5' }}>
          <h2 className="text-4xl font-bold" style={{ fontFamily: "'Luckiest Guy', cursive", color: '#ef4444' }}>
            {roadmap?.goal || 'Generation Error'}
          </h2>
          <p style={{ fontFamily: "'Baloo 2', cursive", color: '#1f2937' }}>
            {roadmap?.steps?.[0]?.tasks?.[0] || 'Roadmap data is invalid or missing steps.'}
          </p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleUpvote} 
            disabled={isUpvoting || !currentUserId} 
            variant="outline" 
            className="border-2 border-black rounded-xl font-bold shadow-[2px_2px_0px_#000] hover:bg-orange-100"
            style={{ backgroundColor: '#ffffff' }}
          >
            <ThumbsUp className="w-5 h-5 mr-2" style={{ color: '#f97316' }} />
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
      
      <div ref={roadmapRef} style={{ backgroundColor: '#ffffff' }}>
        <div className="space-y-8 p-6" style={{ border: '4px solid #000000', borderRadius: '24px' }}>
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
            {currentSteps.map((step, stepIndex: number) => (
              <div 
                key={stepIndex} 
                style={{ 
                  border: '4px solid #000000', 
                  borderRadius: '16px', 
                  boxShadow: '4px 4px 0px #000000',
                  backgroundColor: '#ffffff'
                }}
              >
                <div style={{ padding: '20px 24px 0 24px' }}>
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
                    <h3 className="text-2xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
                      Step {stepIndex + 1}: {step.title}
                    </h3>
                  )}
                </div>
                <div style={{ padding: '20px 24px 24px 24px' }}>
                  <div className="grid gap-4">
                    {step.tasks.map((task, taskIndex) => (
                      <div key={taskIndex} className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
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
                              className="rounded-full"
                              style={{ color: '#dc2626' }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </SecondaryButton>
                          </div>
                        ) : (
                          <span className="text-base leading-relaxed" style={{ fontFamily: "'Baloo 2', cursive", color: '#1f2937' }}>
                            {task}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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