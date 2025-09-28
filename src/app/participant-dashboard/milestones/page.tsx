"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText, CheckCircle, AlertCircle, Loader2, Upload, X, RefreshCw, Info } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES } from '@/lib/constants';

// Define the Milestone type
type Milestone = {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date string
  status: string;
  requirements: string[];
  submissionCount: number;
  submissionLink?: string | null;
  createdAt: string;
  updatedAt: string;
  hasSubmitted?: boolean; // Track if the current participant has submitted
};

// Define the submission response type
type SubmissionResponse = {
  success: boolean;
  message: string;
  error?: string;
  submission?: any;
};

export default function ParticipantMilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Fetch milestones from API
  useEffect(() => {
    const fetchMilestones = async () => {
      try {
        const response = await fetch('/api/milestones');
        
        if (!response.ok) {
          throw new Error('Failed to fetch milestones');
        }
        
        const data = await response.json();
        setMilestones(data);
      } catch (err) {
        console.error('Error fetching milestones:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMilestones();
  }, []);

  // Format date to Arabic format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "d MMMM yyyy", { locale: ar });
  };

  // Get days remaining until due date
  const getDaysRemaining = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status badge based on milestone status and days remaining
  const getStatusBadge = (status: string, dueDate: string) => {
    const daysRemaining = getDaysRemaining(dueDate);
    
    if (status === "completed") {
      return (
        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
          <CheckCircle className="h-3 w-3" />
          <span>مكتمل</span>
        </div>
      );
    } else if (status === "overdue") {
      return (
        <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>متأخر</span>
        </div>
      );
    } else if (daysRemaining <= 3) {
      return (
        <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs">
          <Clock className="h-3 w-3" />
          <span>قريب ({daysRemaining} أيام)</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs">
          <Clock className="h-3 w-3" />
          <span>{daysRemaining} أيام متبقية</span>
        </div>
      );
    }
  };

  // Open the submission dialog
  const openSubmissionDialog = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setSelectedFile(null);
    setSubmissionStatus(null);
    setFileError(null);
    setUploadProgress(0);
    setShowProgress(false);
    setRetryCount(0);
    setIsDialogOpen(true);
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `حجم الملف (${formatFileSize(file.size)}) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_SIZE_MB} ميجابايت)`;
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== "") {
      return "نوع الملف غير مدعوم. الأنواع المدعومة: PDF, Word, ZIP, RAR, JPEG, PNG";
    }

    return null;
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const error = validateFile(file);
      
      if (error) {
        setFileError(error);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        setFileError(null);
      }
    }
  };

  // Create a simulated progress updater
  const simulateProgress = () => {
    setShowProgress(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        // Slow down progress as it gets closer to 90%
        const increment = prev < 30 ? 5 : prev < 60 ? 3 : prev < 80 ? 1 : 0.5;
        const newProgress = Math.min(prev + increment, 90);
        return newProgress;
      });
    }, 300);
    
    return interval;
  };

  // Submit a milestone using direct upload to Supabase
  const submitMilestone = async () => {
    if (!selectedMilestone || !selectedFile) {
      setSubmissionStatus({
        success: false,
        message: "يرجى اختيار ملف للتسليم"
      });
      return;
    }

    // Validate file again before upload
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus(null);
    setFileError(null);
    
    // Start progress simulation
    const progressInterval = simulateProgress();

    try {
      // Step 1: Get a signed URL for direct upload
      const getSignedUrlResponse = await fetch("/api/participant/get-signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestoneId: selectedMilestone.id,
          fileName: selectedFile.name,
          fileType: selectedFile.type
        })
      });

      if (!getSignedUrlResponse.ok) {
        const errorData = await getSignedUrlResponse.json();
        throw new Error(errorData.error || "حدث خطأ أثناء الحصول على رابط الرفع");
      }

      const signedUrlData = await getSignedUrlResponse.json();
      
      if (!signedUrlData.success || !signedUrlData.signedUrl) {
        throw new Error("فشل الحصول على رابط الرفع");
      }

      // Step 2: Upload the file directly to Supabase using the signed URL
      const uploadResponse = await fetch(signedUrlData.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile
      });

      if (!uploadResponse.ok) {
        throw new Error("فشل رفع الملف إلى الخادم");
      }

      // Update progress to 80% after successful upload
      setUploadProgress(80);

      // Step 3: Record the submission in our database
      const recordSubmissionResponse = await fetch("/api/participant/record-submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestoneId: selectedMilestone.id,
          filePath: signedUrlData.path,
          fileName: selectedFile.name,
          publicUrl: signedUrlData.publicUrl
        })
      });

      // Complete the progress bar
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!recordSubmissionResponse.ok) {
        const errorData = await recordSubmissionResponse.json();
        throw new Error(errorData.error || "حدث خطأ أثناء تسجيل التسليم");
      }

      const result = await recordSubmissionResponse.json();

      if (result.success) {
        setSubmissionStatus({
          success: true,
          message: result.message || "تم تسليم المشروع بنجاح"
        });

        // Update the milestone status in the UI
        setMilestones(milestones.map(m => 
          m.id === selectedMilestone.id 
            ? { ...m, hasSubmitted: true, submissionCount: m.submissionCount + 1 } 
            : m
        ));

        // Close the dialog after a delay
        setTimeout(() => {
          setIsDialogOpen(false);
          setShowProgress(false);
        }, 2000);
      } else {
        setSubmissionStatus({
          success: false,
          message: result.error || "حدث خطأ أثناء تسليم المشروع"
        });
        
        setShowProgress(false);
      }
    } catch (err) {
      console.error("Error submitting milestone:", err);
      
      // Clear progress interval
      clearInterval(progressInterval);
      
      // Handle errors and implement retry logic
      if (retryCount < maxRetries) {
        setSubmissionStatus({
          success: false,
          message: `حدث خطأ أثناء الاتصال بالخادم. جاري إعادة المحاولة (${retryCount + 1}/${maxRetries})...`
        });
        
        // Increment retry count
        setRetryCount(prev => prev + 1);
        
        // Retry after a delay
        setTimeout(() => {
          submitMilestone();
        }, 2000);
      } else {
        setSubmissionStatus({
          success: false,
          message: "فشلت عملية التسليم بعد عدة محاولات. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى."
        });
        setShowProgress(false);
      }
    } finally {
      if (retryCount >= maxRetries) {
        setIsSubmitting(false);
      }
    }
  };

  // Reset and retry upload
  const retryUpload = () => {
    setRetryCount(0);
    setUploadProgress(0);
    setShowProgress(false);
    setSubmissionStatus(null);
    submitMilestone();
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold">التسليمات</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md text-red-600">
          <p>{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {milestones.length > 0 ? (
            milestones.map((milestone) => (
              <Card key={milestone.id} className="overflow-hidden border-r-4 border-r-primary">
                <div className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h3 className="text-xl font-semibold">{milestone.title}</h3>
                        {getStatusBadge(milestone.status, milestone.dueDate)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{milestone.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm mt-2 sm:mt-0">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>الموعد النهائي: {formatDate(milestone.dueDate)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-3">المتطلبات:</h4>
                    <ul className="text-sm space-y-2 bg-muted p-4 rounded-lg">
                      {milestone.requirements.map((req, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="mt-6 flex justify-center sm:justify-end">
                    {milestone.hasSubmitted || milestone.status === "completed" ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>تم التسليم</span>
                      </div>
                    ) : (
                      <Button 
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => openSubmissionDialog(milestone)}
                      >
                        <FileText className="h-4 w-4" />
                        تسليم المشروع
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                لا توجد تسليمات مجدولة حالياً.
              </p>
            </div>
          )}
        </div>
      )}

      {/* File Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!isSubmitting) setIsDialogOpen(open);
      }}>
        <DialogContent className="max-w-[90vw] sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسليم المشروع</DialogTitle>
            <DialogDescription>
              {selectedMilestone && (
                <span>تسليم مشروع لـ: {selectedMilestone.title}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">اختر ملف المشروع</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                الملفات المدعومة: PDF, Word, ZIP, RAR, JPEG, PNG (الحد الأقصى: {MAX_FILE_SIZE_MB} ميجابايت)
              </p>
            </div>

            {fileError && (
              <div className="p-3 rounded-md bg-amber-50 text-amber-600 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{fileError}</p>
              </div>
            )}

            {selectedFile && !fileError && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedFile(null)}
                    className="h-6 w-6"
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-600">
                    قد تستغرق عملية رفع الملفات الكبيرة وقتًا أطول. يرجى عدم إغلاق هذه النافذة أثناء الرفع.
                  </p>
                </div>
              </div>
            )}

            {showProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>جاري رفع الملف...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {submissionStatus && (
              <div className={`p-3 rounded-md ${
                submissionStatus.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              } flex items-start gap-2`}>
                {submissionStatus.success ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{submissionStatus.message}</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row sm:justify-start gap-2">
            {submissionStatus && !submissionStatus.success && retryCount >= maxRetries ? (
              <Button
                type="button"
                onClick={retryUpload}
                className="gap-2 w-full sm:w-auto"
                disabled={isSubmitting}
              >
                <RefreshCw className="h-4 w-4" />
                إعادة المحاولة
              </Button>
            ) : (
              <Button
                type="submit"
                onClick={submitMilestone}
                disabled={!selectedFile || isSubmitting || !!fileError}
                className="gap-2 w-full sm:w-auto order-1 sm:order-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري التسليم...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    تأكيد التسليم
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
