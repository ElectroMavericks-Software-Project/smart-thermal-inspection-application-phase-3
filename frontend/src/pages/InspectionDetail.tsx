import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle, Eye, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Settings, Plus, Minus, Bot, Edit3, X, Check, Zap, ScanSearch, UserRoundPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";

// NOTE: demo fallbacks removed to avoid undefined variables
// import baselineThermalImage from "@/assets/baseline-thermal.jpg";
// import currentThermalImage from "@/assets/current-thermal.jpg";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Function to translate Python model class names to user-friendly descriptions
const translateAnomalyClass = (className: string): string => {
  const translations: { [key: string]: string } = {
    'point_overload_yellow': 'Point Overload Potential Faulty',
    'point_overload_red': 'Point Overload Faulty',
    'loose_joint_yellow': 'Loose Joint Potential Faulty',
    'loose_joint_red': 'Loose Joint Faulty'
  };

  return translations[className] || className;
};

// Function to determine if an anomaly is critical (red) or potential (yellow)
const getAnomalySeverity = (className: string): 'critical' | 'potential' => {
  return className.includes('_red') ? 'critical' : 'potential';
};

// Ensure stable label numbers across sessions/refreshes
const normalizeDetectionsWithLabels = (detections: any[]): any[] => {
  const used = new Set<number>();
  let next = 1;
  return detections.map((d, i) => {
    let n = Number((d as any).labelNumber);
    if (!Number.isFinite(n) || n <= 0 || used.has(n)) {
      while (used.has(next)) next++;
      n = next;
      next++;
    } else {
      used.add(n);
    }
    return { ...d, labelNumber: n };
  });
};

const InspectionDetail = () => {
  const { id, inspectionId } = useParams();
  const navigate = useNavigate();

  // Get current user from localStorage (fallback if backend user endpoint not available)
  const currentUserObj = JSON.parse(localStorage.getItem("user") || '{}');
  const currentUser = currentUserObj.name || currentUserObj.username || "Unknown User";

  // Helper to format timestamps as DD/MM/YYYY HH:mm
  const formatTimestamp = (ts?: string | number) => {
    try {
      const d = ts ? new Date(ts) : new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const HH = String(d.getHours()).padStart(2, '0');
      const MM = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
    } catch {
      return '';
    }
  };

  // Initial fetch state
  const [loadingImages, setLoadingImages] = useState(true);

  // Whether *both* baseline & current exist (for comparison UI)
  const [hasExistingImages, setHasExistingImages] = useState<boolean>(false);

  // Track existence of each image explicitly (for redirect decision)
  const [hasBaselineImage, setHasBaselineImage] = useState<boolean | null>(null);
  const [hasCurrentImage, setHasCurrentImage] = useState<boolean | null>(null);

  // Image object-URLs we render
  const [baselineUrl, setBaselineUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  // Transformer data
  const [transformerData, setTransformerData] = useState<{
    transformerNo: string;
    poleNo: string;
    region: string;
    inspectedBy: string;
  } | null>(null);

  // Per-image loading/error
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Timestamps for captions
  const [baselineTakenAt, setBaselineTakenAt] = useState<Date | null>(null);
  const [currentTakenAt, setCurrentTakenAt] = useState<Date | null>(null);

  // Upload simulation state (kept as-is for the "else" UI)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Zoom and pan state for current image
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Settings dialog state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const [showLowConfidenceDetections, setShowLowConfidenceDetections] = useState(false);

  // Initialize preferences from Settings page if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem("app_settings");
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.confidenceThreshold === 'number') {
          setConfidenceThreshold(saved.confidenceThreshold);
        } else {
          const t = Number(localStorage.getItem('settings.confidenceThreshold'));
          if (!Number.isNaN(t) && t > 0) setConfidenceThreshold(t);
        }
        if (typeof saved.showLowConfidenceDetections === 'boolean') {
          setShowLowConfidenceDetections(saved.showLowConfidenceDetections);
        } else {
          const v = localStorage.getItem('settings.showLowConfidenceDetections');
          if (v != null) setShowLowConfidenceDetections(v === 'true');
        }
      }
    } catch {}
  }, []);

  // File input and preview for simulated upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadIntervalRef = useRef<number | null>(null);

  // Anomaly detection results
  const [anomalyResults, setAnomalyResults] = useState<any[]>([]);
  const [anomalyDetectionRun, setAnomalyDetectionRun] = useState<boolean>(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);

  // Edit mode state for interactive annotations
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedContourIndex, setSelectedContourIndex] = useState<number | null>(null);
  const [isDraggingContour, setIsDraggingContour] = useState(false);
  const [isResizingContour, setIsResizingContour] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'

  // AI Analysis state for re-running analysis
  const [aiAnalysisProgress, setAiAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reAnalysisError, setReAnalysisError] = useState<string | null>(null);

  // Image dimensions for bounding box calculations
  const [currentImageDimensions, setCurrentImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [imageRenderInfo, setImageRenderInfo] = useState<{
    displayWidth: number,
    displayHeight: number,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number,
    containerWidth: number,
    containerHeight: number
  } | null>(null);

  // Prevent multiple image onLoad executions
  const imageInitialized = useRef(false);

  // Refs to access current state in global event listeners
  const isDraggingContourRef = useRef(false);
  const isResizingContourRef = useRef(false);
  const selectedContourIndexRef = useRef<number | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const resizeHandleRef = useRef<string | null>(null);
  const imageRenderInfoRef = useRef<typeof imageRenderInfo>(null);
  const currentImageDimensionsRef = useRef<typeof currentImageDimensions>(null);

  // Track blob URLs to revoke safely
  const pendingRevoke = useRef<string[]>([]);
  const lastBaselineUrlRef = useRef<string | null>(null);
  const lastCurrentUrlRef = useRef<string | null>(null);
  const lastPreviewUrlRef = useRef<string | null>(null);

  // Add contour functionality state
  const [isAddingContour, setIsAddingContour] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number, y: number } | null>(null);
  const [drawingEnd, setDrawingEnd] = useState<{ x: number, y: number } | null>(null);
  const [isNewContourDialogOpen, setIsNewContourDialogOpen] = useState(false);
  const [newContourNote, setNewContourNote] = useState("");
  const [newContourClass, setNewContourClass] = useState("point_overload_yellow");
  const [pendingContour, setPendingContour] = useState<{
    x: number,
    y: number,
    width: number,
    height: number
  } | null>(null);

  // Keep refs in sync with latest state
  useEffect(() => { lastBaselineUrlRef.current = baselineUrl; }, [baselineUrl]);
  useEffect(() => { lastCurrentUrlRef.current = currentUrl; }, [currentUrl]);
  useEffect(() => { lastPreviewUrlRef.current = previewUrl; }, [previewUrl]);

  // Reset image initialization when current image changes
  useEffect(() => {
    imageInitialized.current = false;
  }, [currentUrl]);

  // Keep refs in sync with state for global event listeners
  useEffect(() => {
    isDraggingContourRef.current = isDraggingContour;
  }, [isDraggingContour]);

  useEffect(() => {
    isResizingContourRef.current = isResizingContour;
  }, [isResizingContour]);

  useEffect(() => {
    selectedContourIndexRef.current = selectedContourIndex;
  }, [selectedContourIndex]);

  useEffect(() => {
    dragStartPosRef.current = dragStartPos;
  }, [dragStartPos]);

  useEffect(() => {
    resizeHandleRef.current = resizeHandle;
  }, [resizeHandle]);

  useEffect(() => {
    imageRenderInfoRef.current = imageRenderInfo;
  }, [imageRenderInfo]);

  useEffect(() => {
    currentImageDimensionsRef.current = currentImageDimensions;
  }, [currentImageDimensions]);

  // Zoom functions with pan constraint updates
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoomLevel = Math.min(prev * 1.2, 5);
      // Constrain pan after zoom change
      setTimeout(() => constrainPan(newZoomLevel), 0);
      return newZoomLevel;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoomLevel = Math.max(prev / 1.2, 1);
      // Reset pan when zooming out to original size
      if (newZoomLevel <= 1) {
        setPanX(0);
        setPanY(0);
      } else {
        // Constrain pan after zoom change
        setTimeout(() => constrainPan(newZoomLevel), 0);
      }
      return newZoomLevel;
    });
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  // Helper function to constrain pan values based on current zoom
  const constrainPan = (currentZoom: number) => {
    if (currentZoom <= 1) {
      setPanX(0);
      setPanY(0);
      return;
    }

    // Estimate container size (aspect ratio 4:3)
    const estimatedWidth = 400; // approximate container width
    const estimatedHeight = 300; // approximate container height (4:3 aspect)

    const scaledWidth = estimatedWidth * currentZoom;
    const scaledHeight = estimatedHeight * currentZoom;

    const maxPanX = (scaledWidth - estimatedWidth) / 2;
    const maxPanY = (scaledHeight - estimatedHeight) / 2;

    setPanX(prev => Math.max(-maxPanX, Math.min(maxPanX, prev)));
    setPanY(prev => Math.max(-maxPanY, Math.min(maxPanY, prev)));
  };

  // Pan functions with boundary constraints
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning when zoomed in, even in edit mode, as long as we aren't
    // currently drawing, dragging, or resizing a contour.
    const busyWithContours = isAddingContour || isDraggingContourRef.current || isResizingContourRef.current;
    if (!busyWithContours && zoomLevel > 1) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Contour dragging and resizing are now handled by the global mouse move listener.
    // This ensures the interaction continues even if the cursor leaves this element.
    // This handler will only manage image panning.
    if (isPanning && zoomLevel > 1) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      // Calculate the scaled image dimensions
      const container = e.currentTarget as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const scaledWidth = containerRect.width * zoomLevel;
      const scaledHeight = containerRect.height * zoomLevel;

      // Calculate maximum pan values to keep image edges within container
      const maxPanX = (scaledWidth - containerRect.width) / 2;
      const maxPanY = (scaledHeight - containerRect.height) / 2;

      setPanX(prev => {
        const newPanX = prev + deltaX;
        return Math.max(-maxPanX, Math.min(maxPanX, newPanX));
      });

      setPanY(prev => {
        const newPanY = prev + deltaY;
        return Math.max(-maxPanY, Math.min(maxPanY, newPanY));
      });

      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    // This handler is for the container and should only affect panning.
    // Contour drag/resize ending is handled by the global mouseup listener
    // to ensure the drag can complete even if the mouse is released outside the element.
    setIsPanning(false);
  };

  // Format caption datetime
  const fmt = (d: Date | null) => (d ? d.toLocaleString(undefined, { hour12: true }) : "");

  // Turn relative media URL into absolute API URL
  const absolutize = (u?: string | null) => {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
  };

  // Download a URL to an object URL
  async function downloadToObjectUrl(src: string): Promise<string> {
    const resp = await fetch(src, {
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "image/*" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }

  // Show comparison only if both exist
  const canShowComparison = Boolean(baselineUrl && currentUrl);

  // Fetch JSON metadata, then download images as blobs
  useEffect(() => {
    let aborted = false;

    const run = async () => {
      if (!inspectionId) {
        setLoadingImages(false);
        return;
      }
      setBaselineLoading(true);
      setCurrentLoading(true);
      setBaselineError(null);
      setCurrentError(null);

      try {
        const qs = new URLSearchParams({
          inspectionId,
          ...(id ? { transformerNo: id } : {}),
        }).toString();

        const res = await fetch(`${API_BASE}/api/get-inspection?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const baselineSrc = absolutize(data?.baselineImage);
        const currentSrc  = absolutize(data?.currentImage);

        // timestamps (if your API returns these)
        if (data?.baselineTimestamp) setBaselineTakenAt(new Date(data.baselineTimestamp));
        if (data?.currentTimestamp)  setCurrentTakenAt(new Date(data.currentTimestamp));

        // existence flags (used for redirect decision)
        const _hasBaseline = Boolean(baselineSrc);
        const _hasCurrent  = Boolean(currentSrc);
        if (!aborted) {
          setHasBaselineImage(_hasBaseline);
          setHasCurrentImage(_hasCurrent);
          setHasExistingImages(_hasBaseline && _hasCurrent);
        }

        // Baseline
        if (baselineSrc) {
          try {
            const blobUrl = await downloadToObjectUrl(baselineSrc);
            if (!aborted) {
              setBaselineUrl(prev => {
                if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
                return blobUrl;
              });
              setBaselineLoading(false);
            }
          } catch (e: any) {
            if (!aborted) {
              setBaselineError(e?.message || "Failed to load image");
              setBaselineUrl(null);
              setBaselineLoading(false);
            }
          }
        } else {
          if (!aborted) {
            setBaselineUrl(null);
            setBaselineLoading(false);
          }
        }

        // Current
        if (currentSrc) {
          try {
            const blobUrl = await downloadToObjectUrl(currentSrc);
            if (!aborted) {
              setCurrentUrl(prev => {
                if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
                return blobUrl;
              });
              setCurrentLoading(false);
            }
          } catch (e: any) {
            if (!aborted) {
              setCurrentError(e?.message || "Failed to load image");
              setCurrentUrl(null);
              setCurrentLoading(false);
            }
          }
        } else {
          if (!aborted) {
            setCurrentUrl(null);
            setCurrentLoading(false);
          }
        }
      } catch {
        // On API error: treat as "no current image"
        if (!aborted) {
          setHasBaselineImage(null);
          setHasCurrentImage(false);
          setHasExistingImages(false);
          setBaselineLoading(false);
          setCurrentLoading(false);
        }
      } finally {
        if (!aborted) setLoadingImages(false);
      }
    };

    run();
    return () => { aborted = true; };
  }, [id, inspectionId]);

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

  // 🔁 Redirect to /thermal-upload when there is NO current image
  useEffect(() => {
    if (loadingImages) return;
    if (hasCurrentImage === false) {
      navigate(`/transformer/${id}/inspection/${inspectionId}/thermal-upload`, { replace: true });
    }
  }, [loadingImages, hasCurrentImage, id, inspectionId, navigate]);

  // Load anomaly detection results
  useEffect(() => {
    const loadAnnotations = async () => {
      if (!id || !inspectionId) return;

      try {
        console.log('Loading annotations for inspection:', inspectionId);

        // First, try to load from backend
        const response = await fetch(`${API_BASE}/api/get-annotations/${inspectionId}`);

        if (response.ok) {
          const data = await response.json();
          console.log('Loaded annotations from backend:', data);

          if (data.success && data.detections && data.detections.length > 0) {
            // Ensure all detections have annotationType and creator metadata
            const detectionsWithAnnotationTypeRaw = data.detections.map((detection: any) => ({
              ...detection,
              annotationType: detection.annotationType || 'Detected by AI',
              createdBy: detection.createdBy || (detection.annotationType === 'Manual' ? (currentUser || 'User') : 'AI'),
              createdAt: detection.createdAt || new Date().toISOString()
            }));

            const detectionsWithAnnotationType = normalizeDetectionsWithLabels(detectionsWithAnnotationTypeRaw);

            setAnomalyResults(detectionsWithAnnotationType);
            setAnomalyDetectionRun(true);

            // Also update localStorage for offline access
            const resultsKey = `anomaly_results_${id}_${inspectionId}`;
            const storageData = {
              detections: detectionsWithAnnotationType,
              analysisDate: new Date().toISOString(),
              transformerId: id,
              inspectionId: inspectionId,
              imageAnalyzed: true,
              loadedFromBackend: true,
              statistics: data.statistics
            };
            localStorage.setItem(resultsKey, JSON.stringify(storageData));

            // Reset image dimensions and render info when loading new results
            setCurrentImageDimensions(null);
            setImageRenderInfo(null);
            imageInitialized.current = false;
            return;
          }
        }

        // Fallback to localStorage if backend doesn't have data
        console.log('No backend data found, trying localStorage');
        const resultsKey = `anomaly_results_${id}_${inspectionId}`;
        const storedResults = localStorage.getItem(resultsKey);
        if (storedResults) {
          try {
            const parsed = JSON.parse(storedResults);
            const detections = parsed.detections || [];

          // Ensure all detections have annotationType and metadata
          const detectionsWithAnnotationTypeRaw = detections.map((detection: any) => ({
            ...detection,
            annotationType: detection.annotationType || 'Detected by AI',
            createdBy: detection.createdBy || (detection.annotationType === 'Manual' ? (currentUser || 'User') : 'AI'),
            createdAt: detection.createdAt || new Date().toISOString()
          }));

            const detectionsWithAnnotationType = normalizeDetectionsWithLabels(detectionsWithAnnotationTypeRaw);

            setAnomalyResults(detectionsWithAnnotationType);
            setAnomalyDetectionRun(true); // Mark that detection has been run
            // Reset image dimensions and render info when loading new results
            setCurrentImageDimensions(null);
            setImageRenderInfo(null);
            imageInitialized.current = false; // Reset initialization flag
            console.log('Loaded annotations from localStorage:', detectionsWithAnnotationType.length);
          } catch (error) {
            console.error('Failed to parse anomaly results from localStorage:', error);
            setAnomalyDetectionRun(true); // Still mark as run even if parsing failed
          }
        } else {
          console.log('No annotations found in localStorage either');
        }

      } catch (error) {
        console.error('Error loading annotations from backend:', error);

        // Fallback to localStorage on network error
        const resultsKey = `anomaly_results_${id}_${inspectionId}`;
        const storedResults = localStorage.getItem(resultsKey);
        if (storedResults) {
          try {
            const parsed = JSON.parse(storedResults);
            const detections = parsed.detections || [];

          const detectionsWithAnnotationTypeRaw2 = detections.map((detection: any) => ({
            ...detection,
            annotationType: detection.annotationType || 'Detected by AI',
            createdBy: detection.createdBy || (detection.annotationType === 'Manual' ? (currentUser || 'User') : 'AI'),
            createdAt: detection.createdAt || new Date().toISOString()
          }));

            const detectionsWithAnnotationType = normalizeDetectionsWithLabels(detectionsWithAnnotationTypeRaw2);

            setAnomalyResults(detectionsWithAnnotationType);
            setAnomalyDetectionRun(true);
            setCurrentImageDimensions(null);
            setImageRenderInfo(null);
            imageInitialized.current = false;
            console.log('Loaded annotations from localStorage after backend error:', detectionsWithAnnotationType.length);
          } catch (parseError) {
            console.error('Failed to parse anomaly results from localStorage:', parseError);
            setAnomalyDetectionRun(true);
          }
        }
      }
    };

    loadAnnotations();
  }, [id, inspectionId]);

  // Final cleanup on unmount only
  useEffect(() => {
    return () => {
      // schedule latest urls for revoke
      const latest = [
        lastPreviewUrlRef.current,
        lastBaselineUrlRef.current,
        lastCurrentUrlRef.current,
      ];
      latest.forEach(u => {
        if (u && u.startsWith("blob:")) pendingRevoke.current.push(u);
      });

      // revoke all
      pendingRevoke.current.forEach(u => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      pendingRevoke.current = [];

      if (uploadIntervalRef.current) {
        window.clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
    };
  }, []);

  // File picker
  const handlePickFile = () => fileInputRef.current?.click();

  // Handle chosen file (simulated upload)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const url = URL.createObjectURL(file);
    setPreviewUrl(prev => {
      if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
      return url;
    });
    setCurrentTakenAt(new Date());
    startUpload(file);
  };

  // Simulate upload progress for current image
  const startUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);

    const blobUrl = URL.createObjectURL(file);
    setCurrentUrl(prev => {
      if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
      return blobUrl;
    });

    if (uploadIntervalRef.current) {
      window.clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    const intervalId = window.setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(intervalId);
          uploadIntervalRef.current = null;
          setIsUploading(false);
          setUploadComplete(true);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    uploadIntervalRef.current = intervalId;
  };

  // Cancel simulated upload
  const handleCancelUpload = () => {
    if (uploadIntervalRef.current) {
      window.clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);

    setCurrentUrl(prev => {
      if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
      return null;
    });
    setPreviewUrl(prev => {
      if (prev?.startsWith("blob:")) pendingRevoke.current.push(prev);
      return null;
    });
    setCurrentTakenAt(null);
  };

  // Edit mode handlers
  const handleEnterEditMode = () => {
    console.log('Entering edit mode');
    console.log('Current state when entering edit mode:', {
      hasImageRenderInfo: !!imageRenderInfo,
      hasCurrentImageDimensions: !!currentImageDimensions,
      imageRenderInfo,
      currentImageDimensions,
      anomalyResultsCount: anomalyResults.length
    });
    setIsEditMode(true);
    setSelectedContourIndex(null);
    console.log('Edit mode state:', { isEditMode: true, selectedContourIndex: null });
  };

  const handleConfirmEdit = async () => {
    console.log('Confirming annotation edits...');
    console.log('Current anomaly results:', anomalyResults);

    // Count annotations by type for logging
    const typeCount = anomalyResults.reduce((acc, result) => {
      const type = result.annotationType || 'Detected by AI';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Annotation type breakdown:', typeCount);

    // Save updated annotations to localStorage first
    if (id && inspectionId) {
      const resultsKey = `anomaly_results_${id}_${inspectionId}`;
      const storageData = {
        detections: anomalyResults,
        analysisDate: new Date().toISOString(),
        transformerId: id,
        inspectionId: inspectionId,
        imageAnalyzed: true,
        editsConfirmed: true,
        lastEditTimestamp: Date.now(),
        annotationTypeBreakdown: typeCount
      };

      localStorage.setItem(resultsKey, JSON.stringify(storageData));
      console.log('Saved annotation edits to localStorage:', storageData);

      // Send annotation changes to backend API
      try {
        console.log('Sending annotations to backend...');
        const response = await fetch(`${API_BASE}/api/save-annotations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transformerId: id,
            inspectionId: inspectionId,
            annotations: anomalyResults,
            timestamp: new Date().toISOString()
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Successfully saved annotations to backend:', result);

          if (result.success) {
            console.log(`Backend confirmed saving ${result.annotationCount} annotations`);
            // Show success message to user (you can add a toast here)
          } else {
            console.warn('Backend returned success=false:', result.error);
          }
        } else {
          const errorText = await response.text();
          console.warn('Failed to save annotations to backend:', response.status, errorText);
          // Show warning to user that backend save failed but local save succeeded
        }
      } catch (error) {
        console.error('Error saving annotations to backend:', error);
        // Show warning to user that backend save failed but local save succeeded
        // Continue anyway since we saved locally
      }
    }

    // Exit edit mode
    setIsEditMode(false);
    setSelectedContourIndex(null);
    setIsDraggingContour(false);
    setIsResizingContour(false);

    console.log('Edit confirmation completed');
  };

  const handleCancelEdit = () => {
    // TODO: Revert any unsaved changes
    console.log('Cancelling annotation edits...');
    setIsEditMode(false);
    setSelectedContourIndex(null);
    setIsDraggingContour(false);
    setIsResizingContour(false);
  };

  const handleAddContour = () => {
    console.log('Entering add contour mode...');
    setIsAddingContour(true);
    setSelectedContourIndex(null); // Deselect any selected contour
    console.log('Add contour mode enabled');
  };

  // Handle drawing new contours
  const handleDrawingStart = (e: React.MouseEvent) => {
    if (!isAddingContour || !imageRenderInfo || !currentImageDimensions) {
      console.log('Drawing start blocked:', {
        isAddingContour,
        hasImageRenderInfo: !!imageRenderInfo,
        hasCurrentImageDimensions: !!currentImageDimensions
      });
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    console.log('🎨 Starting to draw new contour');

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log('📍 Raw coordinates:', { x, y });
    console.log('📐 Container rect:', rect);
    console.log('🔍 Current zoom/pan:', { zoomLevel, panX, panY });

    // Store raw coordinates without zoom/pan adjustment for now
    setDrawingStart({ x, y });
    setDrawingEnd({ x, y }); // Initialize end to start position
    setIsDrawing(true);
    console.log('✅ Drawing started at:', { x, y });
  };

  const handleDrawingMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawingStart || !isAddingContour) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawingEnd({ x, y });
    console.log('🖱️ Drawing moved to:', { x, y });
  };

  const handleDrawingEnd = (e: React.MouseEvent) => {
    if (!isDrawing || !drawingStart || !drawingEnd || !imageRenderInfo || !currentImageDimensions) {
      console.log('Drawing end conditions not met:', {
        isDrawing,
        hasDrawingStart: !!drawingStart,
        hasDrawingEnd: !!drawingEnd,
        hasImageRenderInfo: !!imageRenderInfo,
        hasCurrentImageDimensions: !!currentImageDimensions
      });
      setIsDrawing(false);
      setDrawingStart(null);
      setDrawingEnd(null);
      return;
    }

    console.log('Ending drawing at:', drawingEnd);

    // Calculate the bounding box in container coordinates
    const minX = Math.min(drawingStart.x, drawingEnd.x);
    const minY = Math.min(drawingStart.y, drawingEnd.y);
    const maxX = Math.max(drawingStart.x, drawingEnd.x);
    const maxY = Math.max(drawingStart.y, drawingEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;

    console.log('Calculated dimensions:', { minX, minY, width, height });

    // Only create contour if it has meaningful size (at least 20x20 pixels)
    if (width > 20 && height > 20) {
        // Correctly convert container coordinates to image coordinates, accounting for zoom and pan
        const z = zoomLevel;
        const { containerWidth, containerHeight, offsetX, offsetY, scaleX, scaleY } = imageRenderInfo;
        const cX = containerWidth / 2;
        const cY = containerHeight / 2;

        // Invert the transformation for the top-left point of the drawn box
        // The forward transform is: finalX = z*pX + panX + cX*(1-z)
        // So the inverse is: pX = (finalX - panX - cX*(1-z)) / z
        const p1X = (minX - panX - cX * (1 - z)) / z;
        const p1Y = (minY - panY - cY * (1 - z)) / z;
        const imageX1 = (p1X - offsetX) / scaleX;
        const imageY1 = (p1Y - offsetY) / scaleY;

        // Invert the transformation for the bottom-right point
        const p2X = (maxX - panX - cX * (1 - z)) / z;
        const p2Y = (maxY - panY - cY * (1 - z)) / z;
        const imageX2 = (p2X - offsetX) / scaleX;
        const imageY2 = (p2Y - offsetY) / scaleY;

        // Calculate final width, height, and center in the original image's pixel space
        const imageWidth = imageX2 - imageX1;
        const imageHeight = imageY2 - imageY1;
        const imageCenterX = imageX1 + imageWidth / 2;
        const imageCenterY = imageY1 + imageHeight / 2;

      console.log('Image coordinates (top-left -> center):', { imageX1, imageY1, imageCenterX, imageCenterY, imageWidth, imageHeight });
      console.log('Image bounds:', currentImageDimensions);

      // Validate that the contour is within image bounds (use top-left for bounds)
      if (imageX1 >= 0 && imageY1 >= 0 &&
          imageX2 <= currentImageDimensions.width &&
          imageY2 <= currentImageDimensions.height &&
          imageWidth > 10 && imageHeight > 10) {

        setPendingContour({
          x: imageCenterX,
          y: imageCenterY,
          width: imageWidth,
          height: imageHeight
        });

        console.log('Opening dialog for new contour');
        setIsNewContourDialogOpen(true);
      } else {
        console.log('Contour out of bounds or too small, discarding');
      }
    } else {
      console.log('Contour too small, discarding. Size:', { width, height });
    }

    // Clean up drawing state
    setIsDrawing(false);
    setDrawingStart(null);
    setDrawingEnd(null);
    setIsAddingContour(false);
  };

  const handleConfirmNewContour = () => {
    if (!pendingContour) return;

    const maxLabel = Math.max(0, ...anomalyResults.map((d: any) => Number(d?.labelNumber) || 0));
    const nextLabel = maxLabel + 1;

    const newDetection = {
      detection_id: `user_${Date.now()}`,
      class: newContourClass,
      confidence: 1.0, // User-drawn contours have 100% confidence
      bounding_box: pendingContour,
      note: newContourNote || "User-added annotation",
      labelNumber: nextLabel,
      annotationType: "Manual", // User-created contours are marked as manual
      createdBy: currentUser,
      createdAt: new Date().toISOString()
    };

    setAnomalyResults(prev => [...prev, newDetection]);
    console.log('Added new contour:', newDetection);

    // Clean up
    setIsNewContourDialogOpen(false);
    setNewContourNote("");
    setNewContourClass("point_overload_yellow");
    setPendingContour(null);
  };

  const handleCancelNewContour = () => {
    setIsNewContourDialogOpen(false);
    setNewContourNote("");
    setNewContourClass("point_overload_yellow");
    setPendingContour(null);
    setIsDrawing(false);
    setDrawingStart(null);
    setDrawingEnd(null);
    setIsAddingContour(false);
  };

  // Cancel add contour mode
  const handleCancelAddContour = () => {
    setIsAddingContour(false);
    setIsDrawing(false);
    setDrawingStart(null);
    setDrawingEnd(null);
    console.log('Cancelled add contour mode');
  };

  // Contour interaction handlers
  const handleContourClick = (index: number, e: React.MouseEvent) => {
    console.log('handleContourClick called:', { index, isEditMode });
    if (!isEditMode) {
      console.log('Not in edit mode, ignoring click');
      return;
    }
    e.stopPropagation();
    setSelectedContourIndex(index);
    console.log('Selected contour:', index);
  };

  const handleContourDragStart = (index: number, e: React.MouseEvent) => {
    console.log('handleContourDragStart called:', { index, isEditMode, currentSelectedIndex: selectedContourIndex });
    if (!isEditMode) {
      console.log('Not in edit mode, ignoring drag start');
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    setSelectedContourIndex(index);
    setIsDraggingContour(true);
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStartPos(startPos);

    // Update refs immediately
    selectedContourIndexRef.current = index;
    isDraggingContourRef.current = true;
    dragStartPosRef.current = startPos;

    console.log('Started dragging contour:', index, 'at position:', startPos);
    console.log('State after drag start:', { isDraggingContour: true, selectedContourIndex: index });
  };

  const handleContourDragEnd = useCallback(() => {
    setIsDraggingContour(false);
    setDragStartPos({ x: 0, y: 0 });
    // Update refs
    isDraggingContourRef.current = false;
    dragStartPosRef.current = { x: 0, y: 0 };
  }, []);

  // Ref-based drag function for global event listeners
  const handleContourDragRef = useCallback((e: MouseEvent) => {
    if (!isDraggingContourRef.current || selectedContourIndexRef.current === null || !imageRenderInfoRef.current || !currentImageDimensionsRef.current) {
      return;
    }

    const deltaX = e.clientX - dragStartPosRef.current.x;
    const deltaY = e.clientY - dragStartPosRef.current.y;

    // Convert screen pixels to image pixels with proper scaling
    const imageDeltaX = deltaX / (imageRenderInfoRef.current.scaleX * zoomLevel);
    const imageDeltaY = deltaY / (imageRenderInfoRef.current.scaleY * zoomLevel);

    // Update the contour position
    setAnomalyResults(prev => {
      const updated = [...prev];
      if (updated[selectedContourIndexRef.current!]) {
        const currentBox = updated[selectedContourIndexRef.current!].bounding_box;
        const newX = currentBox.x + imageDeltaX;
        const newY = currentBox.y + imageDeltaY;

        // Ensure the contour stays within image boundaries
        const minX = currentBox.width / 2;
        const maxX = currentImageDimensionsRef.current!.width - currentBox.width / 2;
        const minY = currentBox.height / 2;
        const maxY = currentImageDimensionsRef.current!.height - currentBox.height / 2;

        const clampedX = Math.max(minX, Math.min(maxX, newX));
        const clampedY = Math.max(minY, Math.min(maxY, newY));

        // Check if position actually changed to mark as edited
        const positionChanged = Math.abs(clampedX - currentBox.x) > 0.1 || Math.abs(clampedY - currentBox.y) > 0.1;

        updated[selectedContourIndexRef.current!] = {
          ...updated[selectedContourIndexRef.current!],
          bounding_box: {
            ...currentBox,
            x: clampedX,
            y: clampedY
          },
          // Mark as edited if position changed and it wasn't already manual
          annotationType: positionChanged && updated[selectedContourIndexRef.current!].annotationType !== "Manual"
            ? "Edited"
            : updated[selectedContourIndexRef.current!].annotationType || "Detected by AI"
        };
      }
      return updated;
    });

    const newStartPos = { x: e.clientX, y: e.clientY };
    setDragStartPos(newStartPos);
    dragStartPosRef.current = newStartPos;
  }, [zoomLevel]);

  const handleResizeStart = (handle: string, e: React.MouseEvent) => {
    console.log('handleResizeStart called:', { handle, isEditMode, selectedContourIndex });
    if (!isEditMode) {
      console.log('Not in edit mode, ignoring resize start');
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    setIsResizingContour(true);
    setResizeHandle(handle);
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStartPos(startPos);

    // Update refs immediately
    isResizingContourRef.current = true;
    resizeHandleRef.current = handle;
    dragStartPosRef.current = startPos;

    console.log('Started resizing with handle:', handle, 'at position:', startPos);
    console.log('State after resize start:', { isResizingContour: true, resizeHandle: handle });
  };

  // Soft-delete existing contours; fully remove newly added (manual) contours
  const handleSoftDeleteContour = (index: number, e?: React.MouseEvent) => {
    try { e?.stopPropagation(); } catch {}
    try { e?.preventDefault(); } catch {}
    setAnomalyResults(prev => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      // Heuristic: treat user-created, newly added contours as removable
      const detectionId = String(target.detection_id || '');
      const isManual = (target.annotationType || '').toLowerCase() === 'manual';
      const isNewUserDetection = detectionId.startsWith('user_') || (!('id' in target) && !('annotationId' in target));

      if (isManual && isNewUserDetection) {
        // Physically remove the newly added contour and clear related UI state
        updated.splice(index, 1);

        if (selectedContourIndex !== null) {
          if (selectedContourIndex === index) {
            setSelectedContourIndex(null);
            selectedContourIndexRef.current = null;
          } else if (selectedContourIndex > index) {
            setSelectedContourIndex(selectedContourIndex - 1);
            if (selectedContourIndexRef.current !== null && selectedContourIndexRef.current > index) {
              selectedContourIndexRef.current = selectedContourIndexRef.current - 1;
            }
          }
        }

        setIsDraggingContour(false);
        setIsResizingContour(false);
        isDraggingContourRef.current = false;
        isResizingContourRef.current = false;
        return updated;
      }

      // For existing (AI or persisted) contours, mark as Deleted (soft-delete)
      const prevType = target.annotationType || 'Detected by AI';
      updated[index] = {
        ...target,
        annotationType: 'Deleted',
        previousAnnotationType: prevType,
        deletedBy: currentUser,
        deletedAt: new Date().toISOString()
      };
      return updated;
    });
    if (selectedContourIndex === index) {
      setSelectedContourIndex(null);
      selectedContourIndexRef.current = null;
    }
    setIsDraggingContour(false);
    setIsResizingContour(false);
    isDraggingContourRef.current = false;
    isResizingContourRef.current = false;
  };

  // Restore a previously deleted contour to its prior annotationType
  const handleRestoreContour = (index: number, e?: React.MouseEvent) => {
    try { e?.stopPropagation(); } catch {}
    try { e?.preventDefault(); } catch {}
    setAnomalyResults(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const fallback = 'Detected by AI';
        const prevType = updated[index].previousAnnotationType || fallback;
        updated[index] = {
          ...updated[index],
          annotationType: prevType,
          previousAnnotationType: undefined,
          deletedBy: undefined,
          deletedAt: undefined
        } as any;
      }
      return updated;
    });
  };

  const handleResizeEnd = useCallback(() => {
    setIsResizingContour(false);
    setResizeHandle(null);
    setDragStartPos({ x: 0, y: 0 });
    // Update refs
    isResizingContourRef.current = false;
    resizeHandleRef.current = null;
    dragStartPosRef.current = { x: 0, y: 0 };
  }, []);

  // Ref-based resize function for global event listeners
  const handleResizeRef = useCallback((e: MouseEvent) => {
    if (!isResizingContourRef.current || selectedContourIndexRef.current === null || !resizeHandleRef.current || !imageRenderInfoRef.current) {
      return;
    }

    const deltaX = e.clientX - dragStartPosRef.current.x;
    const deltaY = e.clientY - dragStartPosRef.current.y;

    // Convert screen pixels to image pixels
    const imageDeltaX = deltaX / imageRenderInfoRef.current.scaleX / zoomLevel;
    const imageDeltaY = deltaY / imageRenderInfoRef.current.scaleY / zoomLevel;

    setAnomalyResults(prev => {
      const updated = [...prev];
      if (updated[selectedContourIndexRef.current!]) {
        const currentBox = updated[selectedContourIndexRef.current!].bounding_box;
        let newBox = { ...currentBox };

        // Apply resize based on handle
        switch (resizeHandleRef.current) {
          case 'nw': // Top-left
            newBox.width = Math.max(10, currentBox.width - imageDeltaX);
            newBox.height = Math.max(10, currentBox.height - imageDeltaY);
            newBox.x = currentBox.x + imageDeltaX / 2;
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 'ne': // Top-right
            newBox.width = Math.max(10, currentBox.width + imageDeltaX);
            newBox.height = Math.max(10, currentBox.height - imageDeltaY);
            newBox.x = currentBox.x + imageDeltaX / 2;
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 'sw': // Bottom-left
            newBox.width = Math.max(10, currentBox.width - imageDeltaX);
            newBox.height = Math.max(10, currentBox.height + imageDeltaY);
            newBox.x = currentBox.x + imageDeltaX / 2;
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 'se': // Bottom-right
            newBox.width = Math.max(10, currentBox.width + imageDeltaX);
            newBox.height = Math.max(10, currentBox.height + imageDeltaY);
            newBox.x = currentBox.x + imageDeltaX / 2;
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 'n': // Top
            newBox.height = Math.max(10, currentBox.height - imageDeltaY);
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 's': // Bottom
            newBox.height = Math.max(10, currentBox.height + imageDeltaY);
            newBox.y = currentBox.y + imageDeltaY / 2;
            break;
          case 'w': // Left
            newBox.width = Math.max(10, currentBox.width - imageDeltaX);
            newBox.x = currentBox.x + imageDeltaX / 2;
            break;
          case 'e': // Right
            newBox.width = Math.max(10, currentBox.width + imageDeltaX);
            newBox.x = currentBox.x + imageDeltaX / 2;
            break;
        }

        // Check if size actually changed to mark as edited
        const sizeChanged = Math.abs(newBox.width - currentBox.width) > 0.1 || Math.abs(newBox.height - currentBox.height) > 0.1;

        updated[selectedContourIndexRef.current!] = {
          ...updated[selectedContourIndexRef.current!],
          bounding_box: newBox,
          // Mark as edited if size changed and it wasn't already manual
          annotationType: sizeChanged && updated[selectedContourIndexRef.current!].annotationType !== "Manual"
            ? "Edited"
            : updated[selectedContourIndexRef.current!].annotationType || "Detected by AI"
        };
      }
      return updated;
    });

    const newStartPos = { x: e.clientX, y: e.clientY };
    setDragStartPos(newStartPos);
    dragStartPosRef.current = newStartPos;
  }, [zoomLevel]);

  // Global mouse event listeners for contour dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Use ref-based functions that have access to current values
      if (isDraggingContourRef.current) {
        console.log('Global handler: calling ref-based drag');
        handleContourDragRef(e);
      }
      if (isResizingContourRef.current) {
        console.log('Global handler: calling ref-based resize');
        handleResizeRef(e);
      }
    };

    const handleGlobalMouseUp = () => {
      console.log('Global mouse up:', {
        isDragging: isDraggingContourRef.current,
        isResizing: isResizingContourRef.current
      });
      if (isDraggingContourRef.current) {
        console.log('Ending contour drag from global handler');
        handleContourDragEnd();
      }
      if (isResizingContourRef.current) {
        console.log('Ending resize from global handler');
        handleResizeEnd();
      }
      setIsPanning(false);
    };

    // Always add listeners and let the handlers check state via refs
    console.log('Adding global mouse listeners');
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      console.log('Removing global mouse listeners');
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleContourDragRef, handleResizeRef, handleContourDragEnd, handleResizeEnd]);

  // Handle escape key to cancel add contour mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddingContour) {
        handleCancelAddContour();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddingContour]);

  // Run AI Analysis Again function
  const handleRunAIAnalysisAgain = async () => {
    if (!currentUrl || !id || !inspectionId) {
      console.error('Missing required data for AI analysis');
      return;
    }

    console.log('Starting AI analysis again for:', { id, inspectionId });

    // Clear any previous analysis error
    setReAnalysisError(null);
    setIsAnalyzing(true);
    setAiAnalysisProgress(0);

    // Clear previous results
    const resultsKey = `anomaly_results_${id}_${inspectionId}`;
    localStorage.removeItem(resultsKey);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAiAnalysisProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      // Convert blob URL to file for API
      const response = await fetch(currentUrl);
      const blob = await response.blob();

      // Create a File object from the blob
      const file = new File([blob], `inspection_${inspectionId}_current.jpg`, { type: blob.type });

      // Create FormData
      const formData = new FormData();
      formData.append('thermalImage', file);
      formData.append('transformerId', id);
      formData.append('inspectionId', inspectionId);
      formData.append('confidenceThreshold', confidenceThreshold.toString());

      console.log('Sending re-analysis request to:', `${API_BASE}/api/analyze-thermal-image`);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Call the AI analysis API
      const analysisResponse = await fetch(`${API_BASE}/api/analyze-thermal-image`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Re-analysis response status:', analysisResponse.status);

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('Re-analysis error:', errorText);
        throw new Error(`AI Analysis failed: ${analysisResponse.status} - ${errorText}`);
      }

      const results = await analysisResponse.json();
      console.log('Re-analysis results:', results);

      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setAiAnalysisProgress(100);

      // Update anomaly results and ensure they have annotation type and metadata
      const analysisTs = results.analysisTimestamp || Date.now();
      const detectionsWithTypeRaw = (results.detections || []).map((detection: any) => ({
        ...detection,
        annotationType: detection.annotationType || 'Detected by AI',
        createdBy: detection.createdBy || 'AI',
        createdAt: detection.createdAt || new Date(analysisTs).toISOString()
      }));
      const detectionsWithType = normalizeDetectionsWithLabels(detectionsWithTypeRaw);
      setAnomalyResults(detectionsWithType);
      setAnomalyDetectionRun(true);

      // Reset image dimensions and render info to recalculate
      setCurrentImageDimensions(null);
      setImageRenderInfo(null);

      // Store results for persistence with annotation types
      const detectionsToStore = detectionsWithType.map(detection => ({
        ...detection,
        annotationType: detection.annotationType || 'Detected by AI',
        createdBy: detection.createdBy || 'AI',
        createdAt: detection.createdAt || new Date(analysisTs).toISOString()
      }));

      const storageData = {
        detections: detectionsToStore,
        analysisDate: new Date().toISOString(),
        transformerId: id,
        inspectionId: inspectionId,
        imageAnalyzed: true,
        reAnalyzed: true,
        analysisTimestamp: Date.now()
      };

      localStorage.setItem(resultsKey, JSON.stringify(storageData));
      console.log('Stored re-analysis results:', storageData);

      // Also save to backend
      try {
        console.log('Saving re-analysis results to backend...');
        const saveResponse = await fetch(`${API_BASE}/api/save-annotations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transformerId: id,
            inspectionId: inspectionId,
            annotations: detectionsWithType,
            timestamp: new Date().toISOString()
          }),
        });

        if (saveResponse.ok) {
          const saveResult = await saveResponse.json();
          console.log('Successfully saved re-analysis results to backend:', saveResult);
        } else {
          console.warn('Failed to save re-analysis results to backend:', saveResponse.status);
        }
      } catch (saveError) {
        console.error('Error saving re-analysis results to backend:', saveError);
        // Continue anyway since we saved locally
      }

      // Show completion for a moment
      setTimeout(() => {
        setIsAnalyzing(false);
        setAiAnalysisProgress(0);
      }, 1000);

    } catch (error) {
      console.error('AI Re-analysis error:', error);
      clearInterval(progressInterval);

      if (error.name === 'AbortError') {
        setReAnalysisError('Analysis timeout - please try again');
      } else {
        setReAnalysisError(error instanceof Error ? error.message : 'AI Analysis failed');
      }

      setIsAnalyzing(false);
      setAiAnalysisProgress(0);
    }
  };

  if (loadingImages) {
    return (
      <Layout title="Transformer">
        <div className="p-6">
          <div className="text-sm text-muted-foreground">Loading inspection data...</div>
        </div>
      </Layout>
    );
  }

  // If we got here and hasCurrentImage === false, the redirect effect will fire.
  // We still render something quickly (nothing fancy) to avoid a flash.
  if (hasCurrentImage === false) {
    return (
      <Layout title="Transformer">
        <div className="p-6 text-sm text-muted-foreground">Redirecting to upload…</div>
      </Layout>
    );
  }

  // Simple image block with loader and error states
  const ImageBlock = ({
    src,
    alt,
    loading,
    error,
    caption,
  }: {
    src: string | null;
    alt: string;
    loading: boolean;
    error: string | null;
    caption: string;
  }) => (
    <div className="relative rounded-lg overflow-hidden">
      {loading && (
        <div className="aspect-[4/3] w-full animate-pulse rounded-md border bg-muted/40" />
      )}
      {!loading && error && (
        <div className="aspect-[4/3] w-full rounded-md border flex items-center justify-center text-sm text-red-600">
          {error}
        </div>
      )}
      {!loading && !error && src && (
        <img
          src={src}
          alt={alt}
          className="w-full aspect-[4/3] object-cover rounded-md border"
        />
      )}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
        {caption}
      </span>
    </div>
  );

  // Zoomable image block for current image
  const ZoomableImageBlock = ({
    src,
    alt,
    loading,
    error,
    caption,
  }: {
    src: string | null;
    alt: string;
    loading: boolean;
    error: string | null;
    caption: string;
  }) => (
    <div className="relative rounded-lg overflow-hidden">
      {loading && (
        <div className="aspect-[4/3] w-full animate-pulse rounded-md border bg-muted/40" />
      )}
      {!loading && error && (
        <div className="aspect-[4/3] w-full rounded-md border flex items-center justify-center text-sm text-red-600">
          {error}
        </div>
      )}
      {!loading && !error && src && (
        <div
          className={`w-full aspect-[4/3] rounded-md border overflow-hidden relative ${
            isAddingContour
              ? 'cursor-crosshair'
              : (zoomLevel > 1 && !(isDraggingContour || isResizingContour))
                ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
                : 'cursor-default'
          }`}
          onMouseDown={(e) => {
            if (isAddingContour) {
              e.preventDefault();
              handleDrawingStart(e);
            } else {
              handleMouseDown(e);
            }
          }}
          onMouseMove={(e) => {
            if (isAddingContour && isDrawing) {
              e.preventDefault();
              handleDrawingMove(e);
            } else {
              handleMouseMove(e);
            }
          }}
          onMouseUp={(e) => {
            if (isAddingContour && isDrawing) {
              e.preventDefault();
              handleDrawingEnd(e);
            } else {
              handleMouseUp();
            }
          }}
          onMouseLeave={() => {
            if (!isAddingContour) {
              handleMouseUp();
            }
          }}
          onClick={(e) => {
            // Handle different click scenarios based on current mode
            if (isAddingContour && !isDrawing) {
              // Cancel add contour mode when clicking without dragging
              const target = e.target as HTMLElement;
              if (target.tagName === 'IMG' || target === e.currentTarget) {
                handleCancelAddContour();
                console.log('Cancelled add contour mode by clicking');
              }
            } else if (isEditMode && !isAddingContour) {
              // Deselect contour when clicking on image but not on a contour
              const target = e.target as HTMLElement;
              if (target.tagName === 'IMG' || target === e.currentTarget) {
                // Only deselect if there's actually a contour selected
                if (selectedContourIndex !== null) {
                  setSelectedContourIndex(null);
                  console.log('Deselected contour by clicking outside');
                }
              }
            }
          }}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            style={{
              transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
              cursor: (zoomLevel > 1 && !(isDraggingContour || isResizingContour)) ? (isPanning ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
            onLoad={(e) => {
              // Prevent multiple executions
              if (imageInitialized.current) {
                console.log('Image onLoad called but already initialized, skipping');
                return;
              }

              console.log('Initializing image dimensions and render info');
              imageInitialized.current = true;

              // Get a the actual image dimensions when it loads
              const img = e.target as HTMLImageElement;
              const tempImg = new Image();
              tempImg.onload = () => {
                const dimensions = {
                  width: tempImg.naturalWidth,
                  height: tempImg.naturalHeight
                };
                console.log('Setting image dimensions:', dimensions);
                setCurrentImageDimensions(dimensions);

                // Calculate how the image is actually rendered within the container
                const containerWidth = img.clientWidth;
                const containerHeight = img.clientHeight;
                const imageAspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                const containerAspectRatio = containerWidth / containerHeight;

                let displayWidth, displayHeight, offsetX, offsetY;

                if (imageAspectRatio > containerAspectRatio) {
                  // Image is wider than container - will be cropped horizontally
                  displayHeight = containerHeight;
                  displayWidth = displayHeight * imageAspectRatio;
                  offsetX = (containerWidth - displayWidth) / 2;
                  offsetY = 0;
                } else {
                  // Image is taller than container - will be cropped vertically
                  displayWidth = containerWidth;
                  displayHeight = displayWidth / imageAspectRatio;
                  offsetX = 0;
                  offsetY = (containerHeight - displayHeight) / 2;
                }

                const scaleX = displayWidth / tempImg.naturalWidth;
                const scaleY = displayHeight / tempImg.naturalHeight;

                const renderInfo = {
                  displayWidth,
                  displayHeight,
                  offsetX,
                  offsetY,
                  scaleX,
                  scaleY,
                  containerWidth,
                  containerHeight
                };

                console.log('Setting image render info:', renderInfo);
                setImageRenderInfo(renderInfo);

                // Log the final state
                console.log('Image initialization complete. Final state:', {
                  dimensions,
                  renderInfo,
                  imageInitialized: true
                });
              };
              tempImg.src = img.src;
            }}
          />
          {/* Bounding Box Overlay */}
          {showBoundingBoxes && anomalyResults.length > 0 && currentImageDimensions && imageRenderInfo && !isAnalyzing && (
            <div
              className={`absolute inset-0 overflow-hidden ${isEditMode && !isAddingContour ? 'pointer-events-auto' : 'pointer-events-none'}`}
              style={{
                transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`,
                transformOrigin: 'center center'
              }}
              onMouseDown={(e) => {
                // Let this bubble to the container so panning can start when
                // clicking empty overlay space in edit mode. Individual contour
                // elements/handles already call stopPropagation for their own drags.
              }}
              onClick={(e) => {
                // Deselect when clicking on empty overlay space (not on a contour)
                if (isEditMode && !isAddingContour) {
                  // If a contour or its label/handles was clicked, their handlers stopPropagation
                  // So reaching here means we clicked outside a contour → clear selection
                  if (selectedContourIndex !== null) {
                    setSelectedContourIndex(null);
                  }
                }
              }}
            >
              {anomalyResults.map((detection, index) => {
                const { bounding_box, class: anomalyClass, confidence } = detection;
                const { x, y, width, height } = bounding_box;

                // Filter by confidence threshold
                const isLowConfidence = (confidence * 100) < confidenceThreshold;
                if (isLowConfidence && !showLowConfidenceDetections) {
                  return null;
                }

                // Convert from center coordinates (pixels) to container coordinates
                // Roboflow returns center x,y coordinates in image pixel space
                const imageWidth = currentImageDimensions.width;
                const imageHeight = currentImageDimensions.height;

                // Convert to image coordinates (top-left)
                const imageLeft = x - width/2;
                const imageTop = y - height/2;

                // Scale to rendered image coordinates (without zoom)
                const renderedLeft = imageLeft * imageRenderInfo.scaleX;
                const renderedTop = imageTop * imageRenderInfo.scaleY;
                const renderedWidth = width * imageRenderInfo.scaleX;
                const renderedHeight = height * imageRenderInfo.scaleY;

                // Add offset to account for centering within the container
                const containerLeft = renderedLeft + imageRenderInfo.offsetX;
                const containerTop = renderedTop + imageRenderInfo.offsetY;

                // Convert to percentages of the actual container (base size, not zoomed)
                const leftPercent = (containerLeft / imageRenderInfo.containerWidth) * 100;
                const topPercent = (containerTop / imageRenderInfo.containerHeight) * 100;
                const widthPercent = (renderedWidth / imageRenderInfo.containerWidth) * 100;
                const heightPercent = (renderedHeight / imageRenderInfo.containerHeight) * 100;

                const isNormal = anomalyClass.toLowerCase().includes('normal');
                const severity = getAnomalySeverity(anomalyClass);

                // Adjust styling based on confidence and deleted state
                let boxColor, labelColor;
                const isDeleted = (detection.annotationType || '').toLowerCase() === 'deleted';
                if (isDeleted) {
                  boxColor = 'border-red-400/70 bg-transparent border-dashed opacity-60';
                  labelColor = 'bg-red-600 text-white';
                } else if (isLowConfidence) {
                  boxColor = 'border-gray-400 bg-gray-400/20 border-dashed';
                  labelColor = 'bg-gray-500 text-white';
                } else if (isNormal) {
                  boxColor = 'border-green-400 bg-green-400/20';
                  labelColor = 'bg-green-500 text-white';
                } else if (severity === 'critical') {
                  boxColor = 'border-red-400 bg-red-400/20';
                  labelColor = 'bg-red-500 text-white';
                } else {
                  boxColor = 'border-yellow-400 bg-yellow-400/20';
                  labelColor = 'bg-yellow-500 text-white';
                }

                // Always render the bounding box (let CSS handle clipping)
                // Border width can change (selected = 4px, default = 2px)
                const isSelected = isEditMode && selectedContourIndex === index;
                const borderPx = isSelected ? 4 : 2;
                // Size badges/buttons relative to contour edge width
                const circleSize = Math.max(18, borderPx * 7);
                const circleFontSize = Math.max(10, Math.round(circleSize * 0.45));
                const iconSize = Math.max(10, Math.round(circleSize * 0.5));

                return (
                  <div
                    key={detection.detection_id || index}
                    className={`absolute border-2 ${boxColor} shadow-lg transition-all duration-200 ${
                      isEditMode && !isAddingContour ? `${isDeleted ? 'cursor-default' : 'cursor-move hover:border-blue-400'} pointer-events-auto` : 'pointer-events-none'
                    } ${
                      isEditMode && selectedContourIndex === index
                        ? 'border-4 border-blue-500 bg-blue-500/10 shadow-xl'
                        : ''
                    }`}
                    style={{
                      left: `${leftPercent}%`,
                      top: `${topPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                    }}
                    onClick={(e) => {
                      if (isEditMode && !isAddingContour && !isDeleted) {
                        e.stopPropagation();
                        handleContourClick(index, e);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (isEditMode && !isAddingContour && !isDeleted) {
                        e.stopPropagation();
                        handleContourDragStart(index, e);
                      }
                    }}
                  >
                    {/* Contour Number Label (rounded badge), position depends on border width */}
                    <div
                      className={`absolute flex items-center justify-center font-extrabold rounded-full shadow-md whitespace-nowrap z-10 ${labelColor} ${
                        isEditMode && !isAddingContour && !isDeleted ? 'cursor-move hover:scale-110 pointer-events-auto' : 'pointer-events-none'
                      } transition-transform duration-200`}
                      style={{
                        width: `${circleSize}px`,
                        height: `${circleSize}px`,
                        top: `-${borderPx}px`,
                        left: `-${borderPx}px`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${circleFontSize}px`,
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        if (isEditMode && !isAddingContour) {
                          e.stopPropagation();
                          handleContourClick(index, e);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (isEditMode && !isAddingContour) {
                          e.stopPropagation();
                          handleContourDragStart(index, e);
                        }
                      }}
                    >
                      {typeof (detection as any).labelNumber === 'number' ? (detection as any).labelNumber : (index + 1)}
                    </div>

                    {/* Delete button (top-right), sized w.r.t. border width */}
                    {isEditMode && !isAddingContour && !isDeleted && (
                      <button
                        type="button"
                        title="Delete contour"
                        className="absolute rounded-full bg-red-600 text-white flex items-center justify-center shadow z-10 pointer-events-auto hover:bg-red-700"
                        style={{
                          width: `${circleSize}px`,
                          height: `${circleSize}px`,
                          top: `-${borderPx}px`,
                          right: `-${borderPx}px`,
                          transform: 'translate(50%, -50%)',
                          // Hide any existing text content and draw a white X via background SVG
                          fontSize: 0,
                          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' stroke='white' stroke-width='3' stroke-linecap='round'><line x1='6' y1='6' x2='18' y2='18'/><line x1='18' y1='6' x2='6' y2='18'/></svg>\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundSize: '60%'
                        }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleSoftDeleteContour(index, e); }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSoftDeleteContour(index, e); }}
                      >
                        ×
                      </button>
                    )}

                    {isEditMode && !isAddingContour && isDeleted && (
                      <button
                        type="button"
                        title="Restore contour"
                        className="absolute rounded-full bg-green-600 text-white flex items-center justify-center shadow z-10 pointer-events-auto hover:bg-green-700"
                        style={{
                          width: `${circleSize}px`,
                          height: `${circleSize}px`,
                          top: `-${borderPx}px`,
                          right: `-${borderPx}px`,
                          transform: 'translate(50%, -50%)',
                          fontSize: 0,
                          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundSize: '60%'
                        }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleRestoreContour(index, e); }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRestoreContour(index, e); }}
                      >
                        ↺
                      </button>
                    )}

                    {/* Resize Handles - Only show when in edit mode and contour is selected */}
                    {isEditMode && !isAddingContour && selectedContourIndex === index && (
                      <>
                        {/* Corner handles */}
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nw-resize -top-1.5 -left-1.5 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('nw', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-ne-resize -top-1.5 -right-1.5 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('ne', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-sw-resize -bottom-1.5 -left-1.5 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('sw', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize -bottom-1.5 -right-1.5 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('se', e);
                          }}
                        />

                        {/* Edge handles */}
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-n-resize -top-1.5 left-1/2 transform -translate-x-1/2 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('n', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-s-resize -bottom-1.5 left-1/2 transform -translate-x-1/2 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('s', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-w-resize -left-1.5 top-1/2 transform -translate-y-1/2 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('w', e);
                          }}
                        />
                        <div
                          className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full cursor-e-resize -right-1.5 top-1/2 transform -translate-y-1/2 z-20 hover:scale-125 transition-transform pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart('e', e);
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Drawing Overlay for New Contours */}
          {isAddingContour && isDrawing && drawingStart && drawingEnd && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/20 border-dashed shadow-lg pointer-events-none"
              style={{
                left: Math.min(drawingStart.x, drawingEnd.x),
                top: Math.min(drawingStart.y, drawingEnd.y),
                width: Math.abs(drawingEnd.x - drawingStart.x),
                height: Math.abs(drawingEnd.y - drawingStart.y),
              }}
            >
              <div className="absolute -top-8 left-0 px-3 py-1 text-xs font-bold rounded-md shadow-md bg-blue-600 text-white whitespace-nowrap">
                Drawing ({Math.round(Math.abs(drawingEnd.x - drawingStart.x))} × {Math.round(Math.abs(drawingEnd.y - drawingStart.y))})
              </div>
            </div>
          )}

          {/* Add Contour Mode Indicator */}
          {isAddingContour && !isDrawing && (
            <div className="absolute top-4 left-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-lg pointer-events-none z-10">
              Click and drag to draw a contour
            </div>
          )}

          {/* AI Analysis Progress Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
              <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">AI Analysis in Progress</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Analyzing thermal image for anomalies...
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${aiAnalysisProgress}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-600">{Math.round(aiAnalysisProgress)}% complete</div>
                  </div>
                  {reAnalysisError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {reAnalysisError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
        {caption}
      </span>
    </div>
  );

  const canShow = hasExistingImages && canShowComparison;

  return (
    <Layout title="Transformer">
      <div className="p-6">
        {/* Custom CSS for sliders */}
        <style>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: pointer;
          }

          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: pointer;
            border: none;
          }

          .slider::-webkit-slider-track {
            height: 8px;
            border-radius: 4px;
            background: #e5e7eb;
          }

          .slider::-moz-range-track {
            height: 8px;
            border-radius: 4px;
            background: #e5e7eb;
            border: none;
          }
        `}</style>

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
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  Completed
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

        {canShow ? (
          <div className="mt-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Thermal Image Comparison</h2>
              <div className="flex items-center gap-4">
                {/* Anomaly Detection Summary */}
                {anomalyDetectionRun && !isAnalyzing && (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const highConfidenceResults = anomalyResults.filter(detection => (detection.confidence * 100) >= confidenceThreshold);
                      const lowConfidenceResults = anomalyResults.filter(detection => (detection.confidence * 100) < confidenceThreshold);
                      const totalShown = showLowConfidenceDetections ? anomalyResults.length : highConfidenceResults.length;

                      if (totalShown > 0) {
                        return (
                          <>
                            <span className="text-sm text-gray-600">
                              {totalShown} error{totalShown === 1 ? '' : 's'} detected
                              {lowConfidenceResults.length > 0 && !showLowConfidenceDetections && (
                                <span className="text-gray-500 ml-1">
                                  (+{lowConfidenceResults.length} low confidence)
                                </span>
                              )}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                              className={showBoundingBoxes ? 'bg-primary/10 border-primary/30' : ''}
                            >
                              {showBoundingBoxes ? 'Hide' : 'Show'} Detections
                            </Button>
                          </>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">
                              No anomalies detected
                              {anomalyResults.length > 0 && (
                                <span className="text-gray-500 ml-1">
                                  (all below {confidenceThreshold}% confidence)
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}

                {/* AI Analysis Progress */}
                {isAnalyzing && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-primary font-medium">
                        Analyzing... {Math.round(aiAnalysisProgress)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Re-analysis Error */}
                {reAnalysisError && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">{reAnalysisError}</span>
                  </div>
                )}

                {/* Zoom and Settings Controls */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel >= 5}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetView} disabled={zoomLevel === 1 && panX === 0 && panY === 0}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSettingsOpen(true)}
                    className="gap-2 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 hover:text-blue-800"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunAIAnalysisAgain}
                    disabled={isAnalyzing || !currentUrl || currentLoading || currentError !== null}
                    className={`gap-2 ${isAnalyzing ? "bg-primary text-white border-primary" : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400 hover:text-green-800"}`}
                  >
                    <div className={isAnalyzing ? "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" : ""}>
                      {!isAnalyzing && <Bot className="h-5 w-5" />}
                    </div>
                    {isAnalyzing ? 'Analyzing...' : 'Run Again'}
                  </Button>

                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Baseline</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageBlock
                    src={baselineUrl}
                    alt="Baseline"
                    loading={baselineLoading}
                    error={baselineError}
                    caption={fmt(baselineTakenAt) || "1/8/2025 9:10:18 PM"}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Current</CardTitle>
                    {isAnalyzing ? (
                      <Badge variant="secondary" className="gap-2">
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </Badge>
                    ) : hasExistingImages && !currentLoading && !currentError && anomalyDetectionRun ? (
                      anomalyResults.length > 0 ? (
                        <Badge variant="destructive" className="gap-2">
                          <AlertTriangle className="h-3 w-3" />
                          {anomalyResults.length} Error{anomalyResults.length === 1 ? '' : 's'} Detected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-2 bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3" />
                          No Issues Detected
                        </Badge>
                      )
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg overflow-hidden">
                    <ZoomableImageBlock
                      src={currentUrl}
                      alt="Current"
                      loading={currentLoading}
                      error={currentError}
                      caption={fmt(currentTakenAt) || "5/7/2025 8:34:21 PM"}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Anomaly Detection Results */}
            {anomalyDetectionRun && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">AI Detection Results</h3>

                  {/* Edit Mode Controls */}
                  <div className="flex items-center gap-2">
                    {!isEditMode ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEnterEditMode}
                        className="gap-2 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 hover:text-blue-800"
                        disabled={isAnalyzing || !anomalyResults.length}
                      >
                        <UserRoundPen className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddContour}
                          className={`gap-2 transition-all duration-200 ${
                            isAddingContour
                              ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-md transform scale-105'
                              : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400 hover:text-green-800 hover:shadow-md hover:transform hover:scale-105 active:scale-95'
                          }`}
                          disabled={isAddingContour}
                        >
                          <Plus className="h-4 w-4" />
                          {isAddingContour ? 'Click & Drag to Draw' : 'Add Contour'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isAddingContour) {
                              handleCancelAddContour();
                            } else {
                              handleCancelEdit();
                            }
                          }}
                          className="gap-2 bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-800"
                        >
                          <X className="h-4 w-4" />
                          {isAddingContour ? 'Cancel Drawing' : 'Cancel'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleConfirmEdit}
                          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="h-4 w-4" />
                          Confirm
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  // Filter detections based on current threshold rules
                  const visibleDetections = anomalyResults.filter(detection => {
                    const isLowConfidence = (detection.confidence * 100) < confidenceThreshold;
                    // Only show high confidence detections, or low confidence if the toggle is enabled
                    return !isLowConfidence || showLowConfidenceDetections;
                  });
                  // Order errors consistently by their label number (fallback to confidence desc)
                  const orderedDetections = [...visibleDetections].sort((a: any, b: any) => {
                    const al = Number(a?.labelNumber);
                    const bl = Number(b?.labelNumber);
                    const aHas = Number.isFinite(al) && al > 0;
                    const bHas = Number.isFinite(bl) && bl > 0;
                    if (aHas && bHas) return al - bl;
                    if (aHas) return -1;
                    if (bHas) return 1;
                    // fallback: higher confidence first
                    const ac = Number(a?.confidence) || 0;
                    const bc = Number(b?.confidence) || 0;
                    return bc - ac;
                  });

                  return orderedDetections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {orderedDetections.map((detection, index) => {
                        const { class: anomalyClass, confidence, bounding_box } = detection;
                        const translatedClass = translateAnomalyClass(anomalyClass);
                        const severity = getAnomalySeverity(anomalyClass);
                        const isNormal = anomalyClass.toLowerCase().includes('normal');
                        const isLowConfidence = (confidence * 100) < confidenceThreshold;

                        // Adjust styling based on confidence level and deletion state
                        let cardColor, iconColor, iconBgColor, textExtra = '';
                        const isDeletedCard = (detection.annotationType || '').toLowerCase() === 'deleted';
                        if (isDeletedCard) {
                          cardColor = 'border-red-300 bg-red-50 opacity-80';
                          iconColor = 'text-red-600';
                          iconBgColor = 'bg-red-100';
                          textExtra = 'line-through';
                        } else if (isLowConfidence) {
                          cardColor = 'border-gray-300 bg-gray-50';
                          iconColor = 'text-gray-600';
                          iconBgColor = 'bg-gray-200';
                        } else if (isNormal) {
                          cardColor = 'border-green-200 bg-green-50';
                          iconColor = 'text-green-600';
                          iconBgColor = 'bg-green-100';
                        } else if (severity === 'critical') {
                          cardColor = 'border-red-200 bg-red-50';
                          iconColor = 'text-red-600';
                          iconBgColor = 'bg-red-100';
                        } else {
                          cardColor = 'border-yellow-200 bg-yellow-50';
                          iconColor = 'text-yellow-600';
                          iconBgColor = 'bg-yellow-100';
                        }

                        return (
                          <Card key={detection.detection_id || index} className={`${cardColor} ${isLowConfidence ? 'opacity-80' : ''}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBgColor}`}>
                                  {isNormal ?
                                    <CheckCircle className={`h-4 w-4 ${iconColor}`} /> :
                                    <ScanSearch className={`h-4 w-4 ${iconColor}`} />
                                  }
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className={`font-medium text-gray-900 ${textExtra}`}>
                                      Error {typeof (detection as any).labelNumber === 'number' ? (detection as any).labelNumber : (index + 1)}
                                    </h4>
                                    {isLowConfidence && (
                                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
                                        Low
                                      </Badge>
                                    )}
                                  </div>
                                  <p className={`text-sm text-gray-700 font-medium ${textExtra}`}>{translatedClass}</p>
                                  <p className="text-sm text-gray-600">
                                    Confidence: {Math.round(confidence * 100)}%
                                    {isLowConfidence && (
                                      <span className="text-gray-500 ml-1">(Below {confidenceThreshold}% threshold)</span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-gray-500">
                                        • Position: ({Math.round(bounding_box.x)}, {Math.round(bounding_box.y)}) px •
                                      Size: {Math.round(bounding_box.width)}×{Math.round(bounding_box.height)} px
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 mt-2">
                                    {(() => {
                                      const annotationType = detection.annotationType || 'Detected by AI';
                                      let badgeColor, iconComponent;

                                      // Determine the anomaly severity for "Detected by AI" color matching
                                      const severity = getAnomalySeverity(anomalyClass);
                                      const isNormal = anomalyClass.toLowerCase().includes('normal');

                                      switch (annotationType) {
                                        case 'Manual':
                                          badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                                          iconComponent = <Plus className="h-3 w-3" />;
                                          break;
                                        case 'Edited':
                                          badgeColor = 'bg-cyan-100 text-cyan-800 border-cyan-200';
                                          iconComponent = <Edit3 className="h-3 w-3" />;
                                          break;
                                        case 'Deleted':
                                          badgeColor = 'bg-red-100 text-red-800 border-red-200';
                                          iconComponent = <X className="h-3 w-3" />;
                                          break;
                                        default: // 'Detected by AI'
                                          // Match the color to the anomaly severity
                                          if (isNormal) {
                                            badgeColor = 'bg-green-100 text-green-800 border-green-200';
                                          } else if (severity === 'critical') {
                                            badgeColor = 'bg-red-100 text-red-800 border-red-200';
                                          } else {
                                            badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                          }
                                          iconComponent = <Zap className="h-3 w-3" />;
                                      }

                                      return (
                                        <Badge variant="outline" className={`text-xs ${badgeColor} flex items-center gap-1`}>
                                          {iconComponent}
                                          {annotationType}
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    // Show when no visible anomalies (all filtered out or none detected)
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-green-900 text-lg">
                              {anomalyResults.length > 0 ? 'No High-Confidence Anomalies' : 'No Anomalies Detected'}
                            </h4>
                            <p className="text-green-700 mt-1">
                              {anomalyResults.length > 0
                                ? `All ${anomalyResults.length} detected anomal${anomalyResults.length === 1 ? 'y is' : 'ies are'} below the ${confidenceThreshold}% confidence threshold.`
                                : 'AI analysis completed successfully. The thermal image shows normal operation with no potential faults detected.'
                              }
                            </p>
                            <p className="text-green-600 text-sm mt-2">
                              {anomalyResults.length > 0
                                ? 'Consider lowering the confidence threshold or enabling low-confidence detections to review these findings.'
                                : 'The transformer appears to be operating within normal thermal parameters.'
                              }
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}

            {/* Error Logging and Notes Section */}
            <div className="mt-8 space-y-6">
              {/* Weather Condition */}
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weather">Weather Condition</Label>
                  <Select defaultValue="sunny">
                    <SelectTrigger className="w-48">
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


              </div>

              {/* Errors Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Errors added by users</CardTitle>
                </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  // List only manually added errors, but keep their Error N numbers
                  // consistent with the AI Detection Results section numbering.
                  const manual = (anomalyResults || []).filter((d) => (d.annotationType === 'Manual'));
                  if (!manual.length) {
                    return (
                      <div className="text-sm text-muted-foreground">No errors added by users yet.</div>
                    );
                  }

                  // Compute the same visibility/filter as AI list
                  const visibleDetections = (anomalyResults || []).filter((det) => {
                    const isLow = (det.confidence * 100) < confidenceThreshold;
                    return !isLow || showLowConfidenceDetections;
                  });

                  const numberFor = (det: any) => {
                    if (typeof det?.labelNumber === 'number') return det.labelNumber;
                    const id = det.detection_id;
                    let idx = -1;
                    if (id != null) idx = visibleDetections.findIndex(v => v.detection_id === id);
                    if (idx < 0) idx = visibleDetections.findIndex(v => v === det);
                    if (idx < 0) idx = (anomalyResults || []).findIndex(v => (v.detection_id && v.detection_id === id) || v === det);
                    return idx >= 0 ? (idx + 1) : 0;
                  };

                  return manual.map((d, idx) => {
                    const n = numberFor(d) || (idx + 1);
                    const noteText = (typeof d.note === 'string' && d.note.trim().length > 0)
                      ? d.note.trim()
                      : undefined;
                    return (
                      <div key={d.detection_id || idx} className="flex w-full items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                        <Badge className="bg-red-500 text-white shrink-0">Error {n}</Badge>
                        <div className="flex-1 min-w-0 text-sm text-gray-700">
                          <span className="text-gray-600">
                            {formatTimestamp(d.createdAt)} - {d.createdBy || currentUser}
                          </span>
                          {noteText && (
                            <span className="ml-2 text-gray-800 break-words">Note: {noteText}</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
              </Card>

              {/* Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <textarea
                      placeholder="Type here to add notes..."
                      className="w-full min-h-[120px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{new Date().toLocaleDateString()} - {currentUser}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                          Confirm
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Fallback content if somehow both images aren't present but we didn't redirect
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Thermal Image</CardTitle>
              </CardHeader>

              {!isUploading && !uploadComplete && (
                <CardContent className="space-y-6">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="mx-auto w-full max-h-80 object-contain rounded-md border"
                    />
                  )}

                  <div>
                    <Badge className="mb-2 bg-warning text-warning-foreground">Pending</Badge>
                    <p className="text-sm text-muted-foreground">
                      Upload a maintenance image of the transformer to identify potential issues.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weather">Weather Condition</Label>
                    <Select defaultValue="sunny">
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

                  <Button className="w-full gap-2" size="lg" onClick={handlePickFile}>
                    <Upload className="h-4 w-4" />
                    Upload maintenance image
                  </Button>

                  <div className="space-y-4">
                    <h3 className="font-medium">Progress</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-warning p-1">
                          <Upload className="h-3 w-3 text-warning-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Thermal Image Upload</div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                        <Badge className="bg-warning text-warning-foreground">Pending</Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-1">
                          <div className="h-3 w-3"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-muted-foreground">AI Analysis</div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-1">
                          <div className="h-3 w-3"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-muted-foreground">Thermal Image Review</div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}

              {isUploading && (
                <CardContent className="space-y-6">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="mx-auto w-full max-h-80 object-contain rounded-md border"
                    />
                  )}

                  <div className="text-center space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Image uploading.</h3>
                      <p className="text-sm text-muted-foreground">
                        Maintenance image is being uploaded and reviewed.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <div className="text-sm text-muted-foreground">{uploadProgress}%</div>
                    </div>

                    <Button variant="outline" onClick={handleCancelUpload}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              )}

              {uploadComplete && !isUploading && (
                <CardContent className="space-y-6">
                  {currentUrl && (
                    <img
                      src={currentUrl}
                      alt="Uploaded preview"
                      className="mx-auto w-full max-h-80 object-contain rounded-md border"
                    />
                  )}

                  <div className="text-center space-y-4">
                    <CheckCircle className="h-16 w-16 text-success mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium">Upload Complete</h3>
                      <p className="text-sm text-muted-foreground">
                        The maintenance image has been uploaded successfully.
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg text-gray-900">Detection Thresholds</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Confidence Threshold Section */}
              <div>
                <h3 className="text-base font-medium mb-2">AI Confidence Threshold</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Minimum confidence level (%) required to show anomaly detections.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="95"
                      step="5"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="w-16 text-right">
                      <span className="text-sm font-medium">{confidenceThreshold}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Permissive (10%)</span>
                    <span>Strict (95%)</span>
                  </div>
                </div>
              </div>

              {/* Show Low Confidence Detections */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium">Show Low Confidence Detections</h3>
                  <p className="text-sm text-gray-600">Display detections below confidence threshold with different styling</p>
                </div>
                <Switch
                  checked={showLowConfidenceDetections}
                  onCheckedChange={setShowLowConfidenceDetections}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Current Settings Summary */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Current Settings</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>AI confidence: {confidenceThreshold}% minimum</div>
                  <div>Low confidence: {showLowConfidenceDetections ? 'Shown' : 'Hidden'}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to defaults
                    setConfidenceThreshold(50);
                    setShowLowConfidenceDetections(false);
                  }}
                  className="px-4"
                >
                  Reset to Defaults
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // Apply the settings (you can add actual logic here)
                      console.log('Applied settings:', {
                        confidenceThreshold,
                        showLowConfidenceDetections
                      });
                      setIsSettingsOpen(false);

                      // Optionally trigger re-analysis with new thresholds
                      // handleRunAIAnalysisAgain();
                    }}
                    className="px-6 bg-primary hover:bg-primary/90"
                  >
                    Apply Settings
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Contour Dialog */}
        <Dialog open={isNewContourDialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCancelNewContour();
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg text-gray-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Add New Contour
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Size Information */}
              {pendingContour && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Contour Size</h4>
                  <div className="text-xs text-blue-700">
                    {Math.round(pendingContour.width)} × {Math.round(pendingContour.height)} pixels
                  </div>
                </div>
              )}

              {/* Anomaly Type Selection */}
              <div>
                <Label htmlFor="contour-class" className="text-base font-medium mb-3 block">
                  Anomaly Type
                </Label>
                <Select value={newContourClass} onValueChange={setNewContourClass}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select anomaly type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="point_overload_yellow">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        Point Overload (Potential)
                      </div>
                    </SelectItem>
                    <SelectItem value="point_overload_red">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        Point Overload (Critical)
                      </div>
                    </SelectItem>
                    <SelectItem value="loose_joint_yellow">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        Loose Joint (Potential)
                      </div>
                    </SelectItem>
                    <SelectItem value="loose_joint_red">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        Loose Joint (Critical)
                      </div>
                    </SelectItem>
                    <SelectItem value="full_overload_red">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        Full Wire Overload
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes/Description */}
              <div>
                <Label htmlFor="contour-note" className="text-base font-medium mb-3 block">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="contour-note"
                  value={newContourNote}
                  onChange={(e) => setNewContourNote(e.target.value)}
                  placeholder="Add any additional notes about this anomaly..."
                  className="min-h-24 resize-none"
                />
              </div>

              {/* Preview of selected anomaly type */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-3">Preview</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Type:</span>
                    <span className="text-xs font-medium">{translateAnomalyClass(newContourClass)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Severity:</span>
                    <Badge
                      variant="secondary"
                      className={
                        getAnomalySeverity(newContourClass) === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {getAnomalySeverity(newContourClass) === 'critical' ? 'Critical' : 'Potential'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Confidence:</span>
                    <span className="text-xs font-medium text-green-600">100% (User-defined)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelNewContour}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmNewContour}
                  className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Confirm & Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default InspectionDetail;
