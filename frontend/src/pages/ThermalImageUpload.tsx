import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Layout from "@/components/Layout";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Tune these to taste
const MIN_UPLOAD_TIME = 2200;   // ms: minimum time to keep progress on screen
const SUCCESS_HOLD     = 900;   // ms: time to show the "Upload Complete" state

const ThermalImageUpload = () => {
  const { id, inspectionId } = useParams();
  const navigate = useNavigate();

  // Get current user information
  const user = localStorage.getItem("user");
  const userData = user ? JSON.parse(user) : null;
  const uploaderName = userData?.username || userData?.email || "admin";

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState<"IN_PROGRESS" | "COMPLETED">("IN_PROGRESS");
  
  // AI Analysis state
  const [aiAnalysisProgress, setAiAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  
  // Review state
  const [reviewProgress, setReviewProgress] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Faux progress interval (for smooth effect when real progress is missing/quick)
  const simIntervalRef = useRef<number | null>(null);
  const reviewIntervalRef = useRef<number | null>(null);

  // Finishing animation / timing
  const startedAtRef = useRef<number>(0);
  const finishIntervalRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  useEffect(() => { progressRef.current = uploadProgress; }, [uploadProgress]);

  // Images (for header + preview)
  const [baselineUrl, setBaselineUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  // Transformer data
  const [transformerData, setTransformerData] = useState<{
    transformerNo: string;
    poleNo: string;
    region: string;
    inspectedBy: string;
  } | null>(null);

  // Timestamps (captions)
  const [baselineTakenAt, setBaselineTakenAt] = useState<Date | null>(null);
  const [currentTakenAt, setCurrentTakenAt] = useState<Date | null>(null);

  // File picker & preview
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Weather condition state
  const [weatherCondition, setWeatherCondition] = useState<string>("sunny");

  // Helpers
  const fmt = (d: Date | null) => (d ? d.toLocaleString(undefined, { hour12: true }) : "");
  const absolutize = (u?: string | null) => {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
  };

  // Fetch baseline image (adjust to your API)
  useEffect(() => {
    const fetchBaseline = async () => {
      if (!id) return;
      try {
        const res = await fetch(`${API_BASE}/api/transformers/${id}/baseline`);
        if (res.ok) {
          const data = await res.json();
          const url = absolutize(data?.url);
          if (url) setBaselineUrl(url);
          const ts = (data?.uploadedAt ?? data?.createdAt ?? data?.takenAt) as string | number | undefined;
          if (ts) setBaselineTakenAt(new Date(ts));
        }
      } catch { /* ignore baseline failure */ }
    };
    fetchBaseline();
  }, [id]);

  // Fetch transformer data
  useEffect(() => {
    const fetchTransformerData = async () => {
      if (!id) return;
      try {
        const res = await fetch(`${API_BASE}/api/get-transformer-data?id=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          const tf = data?.transformer;
          if (tf) {
            setTransformerData({
              transformerNo: tf.transformerNo || id,
              poleNo: tf.poleNo || "—",
              region: tf.region || "—",
              inspectedBy: "Agent1", // Hardcoded as requested in TransformerDetail
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch transformer data:", error);
        // Fallback to URL id if API fails
        setTransformerData({
          transformerNo: id,
          poleNo: "—",
          region: "—",
          inspectedBy: "Agent1",
        });
      }
    };
    fetchTransformerData();
  }, [id]);

  // Cleanup previews/timers
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
      if (simIntervalRef.current) { window.clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
      if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
      if (finishTimeoutRef.current) { window.clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; }
      if (redirectTimeoutRef.current) { window.clearTimeout(redirectTimeoutRef.current); redirectTimeoutRef.current = null; }
      if (reviewIntervalRef.current) { window.clearInterval(reviewIntervalRef.current); reviewIntervalRef.current = null; }
    };
  }, [previewUrl, currentUrl]);

  // Open file chooser
  const handlePickFile = () => fileInputRef.current?.click();

  // Handle chosen file -> preview -> real upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow selecting same file again

    console.log('File selected:', file.name, file.size, 'bytes');

    // Store the uploaded file for AI analysis BEFORE starting upload
    setUploadedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(prev => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    setCurrentTakenAt(new Date());

    console.log('Starting upload for file:', file.name);
    startUpload(file);
  };

  const startSimProgress = () => {
    if (simIntervalRef.current) { window.clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    // Ease towards ~95% while waiting for real progress/response
    simIntervalRef.current = window.setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) return prev;
        const delta = Math.max(1, Math.round((95 - prev) * 0.06));
        return Math.min(95, prev + delta);
      });
    }, 180);
  };

  const stopSimProgress = () => {
    if (simIntervalRef.current) { window.clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
  };

  // AI Analysis function
  const startAiAnalysis = async (uploadedFile: File) => {
    console.log('Starting AI analysis with file:', uploadedFile);
    console.log('File details:', {
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
      lastModified: uploadedFile.lastModified
    });
    
    // Clear any previous results for this transformer/inspection
    const resultsKey = `anomaly_results_${id}_${inspectionId}`;
    localStorage.removeItem(resultsKey);
    console.log('Cleared previous results from localStorage for key:', resultsKey);
    
    setIsAnalyzing(true);
    setAiAnalysisProgress(0);
    setAnalysisComplete(false);
    setAnalysisError(null);

    // Simulate progress for AI analysis
    const progressInterval = setInterval(() => {
      setAiAnalysisProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      // Create FormData to send the actual image file
      const formData = new FormData();
      formData.append('thermalImage', uploadedFile);
      formData.append('transformerId', id || '');
      formData.append('inspectionId', inspectionId || '');

      console.log('Sending request to:', `${API_BASE}/api/analyze-thermal-image`);
      console.log('FormData contents:', {
        thermalImage: uploadedFile.name,
        transformerId: id,
        inspectionId: inspectionId
      });

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Call the AI analysis API with the uploaded image
      const response = await fetch(`${API_BASE}/api/analyze-thermal-image`, {
        method: 'POST',
        body: formData, // Send the actual image file
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`AI Analysis failed: ${response.status} - ${errorText}`);
      }

      const results = await response.json();
      console.log('Analysis results:', results);
      
      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setAiAnalysisProgress(100);
      setAnalysisResults(results.detections || []);
      setAnalysisComplete(true);
      
      // Store results for InspectionDetail page
      const storageData = {
        detections: results.detections || [],
        analysisDate: new Date().toISOString(),
        transformerId: id,
        inspectionId: inspectionId,
        imageAnalyzed: true,
        originalFileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        analysisTimestamp: Date.now()
      };
      
      localStorage.setItem(`anomaly_results_${id}_${inspectionId}`, JSON.stringify(storageData));
      console.log('Stored analysis results:', storageData);
      
      // Start review phase
      setTimeout(() => {
        startReview();
      }, 500);

    } catch (error) {
      console.error('AI Analysis error:', error);
      clearInterval(progressInterval);
      
      if (error.name === 'AbortError') {
        setAnalysisError('Analysis timeout - please try again');
      } else {
        setAnalysisError(error instanceof Error ? error.message : 'AI Analysis failed');
      }
      
      // No fallback data - show actual error to user
      setAiAnalysisProgress(0);
      setAnalysisResults([]);
      setAnalysisComplete(false);
      
      // Don't continue to review phase on error - let user retry
      
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
    }
  };

  // Review phase (simulated)
  const startReview = () => {
    setIsReviewing(true);
    setReviewProgress(0);
    
    if (reviewIntervalRef.current) {
      clearInterval(reviewIntervalRef.current);
    }
    
    reviewIntervalRef.current = window.setInterval(() => {
      setReviewProgress(prev => {
        if (prev >= 100) {
          if (reviewIntervalRef.current) {
            clearInterval(reviewIntervalRef.current);
            reviewIntervalRef.current = null;
          }
          setReviewComplete(true);
          setIsReviewing(false);
          setInspectionStatus("COMPLETED");
          
          // Redirect after review complete
          setTimeout(() => {
            console.log('Redirecting to:', `/transformer/${id}/inspection/${inspectionId}`);
            navigate(`/transformer/${id}/inspection/${inspectionId}`);
          }, 1000);
          
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Smooth finish to 100 over "remaining" ms
  const finishToHundred = (remainingMs: number) => {
    if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
    if (remainingMs <= 0) {
      setUploadProgress(100);
      setIsUploading(false);
      setUploadComplete(true);
      
      // Start AI analysis after upload completion with the actual uploaded file
      console.log('Upload complete, starting AI analysis with file:', uploadedFile);
      if (uploadedFile) {
        setTimeout(() => {
          console.log('Triggering AI analysis...');
          startAiAnalysis(uploadedFile);
        }, 500);
      } else {
        console.error('No uploaded file found for AI analysis');
        // Fallback: proceed without AI analysis
        setTimeout(() => {
          startReview();
        }, 1000);
      }
      
      return;
    }

    const intervalMs = 90;
    const steps = Math.max(1, Math.floor(remainingMs / intervalMs));
    const start = progressRef.current;
    const target = 99; // leave a tiny gap for the final tick
    const totalDelta = Math.max(0, target - start);
    const perStep = totalDelta / steps;

    let tick = 0;
    finishIntervalRef.current = window.setInterval(() => {
      tick += 1;
      setUploadProgress(prev => Math.min(target, Math.max(prev, Math.round(start + perStep * tick))));
      if (tick >= steps) {
        if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
        finishTimeoutRef.current = window.setTimeout(() => {
          setUploadProgress(100);
          setIsUploading(false);
          setUploadComplete(true);
          
          // Start AI analysis after upload completion with the actual uploaded file
          if (uploadedFile) {
            setTimeout(() => {
              startAiAnalysis(uploadedFile);
            }, 500);
          }
        }, 80);
      }
    }, intervalMs);
  };

  // REAL upload with progress (plus smooth fallback + minimum duration)
  const startUpload = (file: File) => {
    if (!id || !inspectionId) {
      setUploadError("Missing transformer or inspection id");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);
    setUploadError(null);

    // Show an "uploaded preview" while uploading
    const blobUrl = URL.createObjectURL(file);
    setCurrentUrl(prev => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return blobUrl;
    });

    const params = new URLSearchParams({ transformer_id: id, inspection_no: inspectionId });
    const url = `${API_BASE}/api/upload-thermal-image?${params.toString()}`;

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("uploaderName", uploaderName);
    form.append("weatherCondition", weatherCondition);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open("POST", url, true);
    // xhr.withCredentials = true; // if you need auth cookies

    startedAtRef.current = performance.now();

    // Start faux progress right away
    startSimProgress();

    xhr.upload.onprogress = (evt) => {
      const elapsed = performance.now() - startedAtRef.current;
      if (!evt.lengthComputable) return; // keep faux progress
      const pct = Math.round((evt.loaded / evt.total) * 100);
      // Before the min time, never show 100% (cap at 98)
      const capped = elapsed < MIN_UPLOAD_TIME ? Math.min(pct, 98) : pct;
      setUploadProgress(prev => Math.max(prev, capped));
    };

    xhr.onload = () => {
      stopSimProgress();
      xhrRef.current = null;

      const elapsed = performance.now() - startedAtRef.current;
      const remaining = Math.max(0, MIN_UPLOAD_TIME - elapsed);

      if (xhr.status >= 200 && xhr.status < 300) {
        // Smoothly finish to 100 over the remaining time
        finishToHundred(remaining);
      } else {
        // Fail fast
        if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
        setIsUploading(false);
        setUploadError(`Upload failed (HTTP ${xhr.status})`);
      }
    };

    xhr.onerror = () => {
      stopSimProgress();
      xhrRef.current = null;
      if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
      setIsUploading(false);
      setUploadError("Network error during upload");
    };

    xhr.send(form);
  };

  // Cancel upload (abort XHR)
  const handleCancelUpload = () => {
    try { xhrRef.current?.abort(); } catch {}
    xhrRef.current = null;

    stopSimProgress();
    if (finishIntervalRef.current) { window.clearInterval(finishIntervalRef.current); finishIntervalRef.current = null; }
    if (finishTimeoutRef.current) { window.clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; }
    if (redirectTimeoutRef.current) { window.clearTimeout(redirectTimeoutRef.current); redirectTimeoutRef.current = null; }
    if (reviewIntervalRef.current) { window.clearInterval(reviewIntervalRef.current); reviewIntervalRef.current = null; }

    setIsUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    setUploadError(null);
    
    // Reset AI analysis state
    setIsAnalyzing(false);
    setAiAnalysisProgress(0);
    setAnalysisComplete(false);
    setAnalysisError(null);
    
    // Reset review state
    setIsReviewing(false);
    setReviewProgress(0);
    setReviewComplete(false);

    if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);

    setCurrentUrl(null);
    setPreviewUrl(null);
    setCurrentTakenAt(null);
    setUploadedFile(null);
  };

  return (
    <Layout title="Transformer">
      {/* local keyframes for shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div className="p-6">
        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mb-6">
          {/* Main Inspection Header */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <Badge variant="secondary" className="gap-2">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                {inspectionId || "104"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last updated: Mon(21), May, 2023 12:55pm
              </span>
            </div>
          </div>

          {/* Inspection Details Card */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-4 mb-3">
              <Button
                variant="ghost"
                onClick={() => navigate(`/transformer/${id}`)}
                className="bg-primary text-primary-foreground rounded-lg p-3 flex items-center justify-center w-12 h-12 hover:bg-primary/90"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{inspectionId || "000123589"}</h2>
                <p className="text-sm text-gray-600">Mon(21), May, 2023 12:55pm</p>
              </div>
                <div className="ml-auto flex items-center gap-2">
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
                  inspectionStatus === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  <span
                  className={`h-2 w-2 rounded-full ${
                    inspectionStatus === "COMPLETED"
                    ? "bg-green-500"
                    : "bg-yellow-500"
                  }`}
                  ></span>
                  {inspectionStatus === "COMPLETED"
                  ? "Inspection completed"
                  : "In Progress"}
                </div>
                </div>
            </div>
            
            {/* Details Grid and Baseline Image in Same Row */}
            <div className="flex items-center justify-between gap-6">
              {/* Left Side - Details Grid */}
              <div className="grid grid-cols-4 gap-3 w-auto">
                <div className="bg-gray-200 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformerData?.transformerNo || id || "—"}</div>
                  <div className="text-xs font-medium text-gray-700">Transformer No.</div>
                </div>
                <div className="bg-gray-200 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformerData?.poleNo || "—"}</div>
                  <div className="text-xs font-medium text-gray-700">Pole No.</div>
                </div>
                <div className="bg-gray-200 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformerData?.region || "—"}</div>
                  <div className="text-xs font-medium text-gray-700">Branch</div>
                </div>
                <div className="bg-gray-200 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformerData?.inspectedBy || "—"}</div>
                  <div className="text-xs font-medium text-gray-700">Inspected By</div>
                </div>
              </div>
              
              {/* Right Side - Baseline Image Section */}
              <div className="flex items-center gap-3">
                {baselineUrl && (
                  <>
                    <img
                      src={baselineUrl}
                      alt="Baseline preview"
                      className="h-10 w-10 rounded object-cover border"
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-primary">
                          <Eye className="h-4 w-4" />
                          Baseline Image
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Baseline Image</DialogTitle>
                        </DialogHeader>
                        <img
                          src={baselineUrl}
                          alt="Baseline"
                          className="w-full max-h-[75vh] object-contain rounded-md"
                        />
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upload card */}
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Thermal Image</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="relative">
                {previewUrl && (
                  <>
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="mx-auto w-full max-h-80 object-contain rounded-md border"
                    />
                    {isUploading && (
                      <div className="absolute inset-0 rounded-md bg-black/5 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="text-xs px-2 py-1 rounded bg-black/60 text-white">
                          Uploading…
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {uploadError && (
                <div className="text-sm text-red-600">{uploadError}</div>
              )}

              {analysisError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  <strong>AI Analysis Error:</strong> {analysisError}
                  <br />
                  <small>The system will use sample data for demonstration purposes.</small>
                </div>
              )}

              <div>
                <Badge className="mb-2 bg-warning text-warning-foreground">
                  {isUploading ? "Uploading" : uploadComplete ? "Completed" : "Pending"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Upload a maintenance image of the transformer to identify potential issues.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">Weather Condition</Label>
                <Select value={weatherCondition} onValueChange={setWeatherCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunny">Sunny</SelectItem>
                    <SelectItem value="cloudy">Cloudy</SelectItem>
                    <SelectItem value="rainy">Rainy</SelectItem>
                    <SelectItem value="windy">Windy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isUploading && !uploadComplete && (
                <Button className="w-full gap-2" size="lg" onClick={handlePickFile}>
                  <Upload className="h-4 w-4" />
                  Upload maintenance image
                </Button>
              )}

              {/* Progress Section */}
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress</h3>
                
                {/* Thermal Image Upload */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      uploadComplete ? 'bg-green-200' : isUploading ? 'bg-primary/20' : 'bg-orange-200'
                    }`}>
                      <div className={`w-3 h-3 rounded-full ${
                        uploadComplete ? 'bg-green-500' : isUploading ? 'bg-primary' : 'bg-orange-400'
                      }`}></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Thermal Image Upload</h4>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          uploadComplete ? 'bg-green-500' : isUploading ? 'bg-primary' : 'bg-orange-400'
                        }`} 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-sm font-medium ${
                      uploadComplete ? 'text-green-600' : isUploading ? 'text-primary' : 'text-orange-600'
                    }`}>
                      {uploadComplete ? 'Complete' : isUploading ? 'Uploading...' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* AI Analysis */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      analysisComplete ? 'bg-green-200' : isAnalyzing ? 'bg-primary/20' : 'bg-orange-200'
                    }`}>
                      <div className={`w-3 h-3 rounded-full ${
                        analysisComplete ? 'bg-green-500' : isAnalyzing ? 'bg-primary' : 'bg-orange-400'
                      }`}></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">AI Analysis</h4>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          analysisComplete ? 'bg-green-500' : isAnalyzing ? 'bg-primary' : 'bg-orange-400'
                        }`} 
                        style={{ width: `${aiAnalysisProgress}%` }}
                      ></div>
                    </div>
                    {isAnalyzing && (
                      <p className="text-xs text-gray-500 mt-1">
                        Processing thermal image through AI model...
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-sm font-medium ${
                      analysisComplete ? 'text-green-600' : isAnalyzing ? 'text-primary' : 'text-orange-600'
                    }`}>
                      {analysisComplete ? `Found ${analysisResults.length} anomalies` : isAnalyzing ? 'Analyzing...' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Thermal Image Review */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      reviewComplete ? 'bg-green-200' : isReviewing ? 'bg-primary/20' : 'bg-orange-200'
                    }`}>
                      <div className={`w-3 h-3 rounded-full ${
                        reviewComplete ? 'bg-green-500' : isReviewing ? 'bg-primary' : 'bg-orange-400'
                      }`}></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Thermal Image Review</h4>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          reviewComplete ? 'bg-green-500' : isReviewing ? 'bg-primary' : 'bg-orange-400'
                        }`} 
                        style={{ width: `${reviewProgress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-sm font-medium ${
                      reviewComplete ? 'text-green-600' : isReviewing ? 'text-primary' : 'text-orange-600'
                    }`}>
                      {reviewComplete ? 'Complete' : isReviewing ? 'Reviewing...' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {isUploading && (
                <div className="text-center space-y-4">
                  <div className="relative w-full">
                    <Progress value={uploadProgress} className="w-full" />
                    {/* shimmer overlay */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
                      <div
                        style={{
                          width: "35%",
                          height: "100%",
                          opacity: 0.18,
                          background: "white",
                          animation: "shimmer 1.2s linear infinite",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{uploadProgress}%</div>
                  <Button variant="outline" onClick={handleCancelUpload}>
                    Cancel
                  </Button>
                </div>
              )}

              {uploadComplete && !isUploading && !isAnalyzing && !analysisComplete && (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-success mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">Upload Complete</h3>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Thermal image uploaded successfully
                      </p>
                      <p className="text-sm text-green-600 font-medium">
                        Let's start AI analysis...
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      console.log('Manual AI analysis trigger');
                      startAiAnalysis(uploadedFile!);
                    }}
                    className="mt-4"
                  >
                    Start AI Analysis
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      console.log('Skipping AI analysis, proceeding to review');
                      startReview();
                    }}
                    className="mt-2"
                  >
                    Skip AI Analysis (Use Sample Data)
                  </Button>
                </div>
              )}

              {reviewComplete && (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-success mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">Analysis Complete!</h3>
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 font-medium">
                        Found {analysisResults.length} anomal{analysisResults.length === 1 ? 'y' : 'ies'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Redirecting to inspection details...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ThermalImageUpload;
