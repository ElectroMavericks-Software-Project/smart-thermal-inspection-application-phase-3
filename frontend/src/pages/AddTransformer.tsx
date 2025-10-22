import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Upload, Image as ImageIcon, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ImageUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CREATE_URL = `${API_BASE}/api/transformers`;    // the controller we added
const UPLOAD_URL = `${API_BASE}/api/upload_baseline_transformer`;

type Transformer = {
  id?: number | string;
  transformerNo: string;
  poleNo?: string;
  region?: string;
  type?: string;
  capacity?: string;
  starred?: boolean;
};

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const MAX_MB = 20;

export default function AddTransformer() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get current user information
  const user = localStorage.getItem("user");
  const userData = user ? JSON.parse(user) : null;
  const uploaderName = userData?.username || userData?.email || "admin";

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // transformer from navigation state (preferred)
  const passedTransformer = (location.state as any)?.transformer as Transformer | undefined;

  // fallback: read from server using id in query (kept for robustness)
  const [transformer, setTransformer] = useState<Transformer | undefined>(passedTransformer);
  const [loadingTransformer, setLoadingTransformer] = useState<boolean>(!passedTransformer);
  const [creatingOnServer, setCreatingOnServer] = useState<boolean>(false);
  const [createdOnServer, setCreatedOnServer] = useState<boolean>(false);

  const idFromQuery = useMemo(() => searchParams.get("id"), [searchParams]);

  const SEE_BASELINE_URL = (no: string) =>
  `${API_BASE}/api/see_transformer_baseline?transformer_no=${encodeURIComponent(no)}`;

  useEffect(() => {
  // If the transformer already has a baseline on the server, try to show it.
  if (!transformer?.transformerNo) return;

  const url = SEE_BASELINE_URL(transformer.transformerNo);

    // We probe the endpoint; if it returns 200 OK, we point the <img> to it.
    // Cache-busting query avoids stale browser cache after uploads.
    fetch(url, { method: "GET" })
      .then((res) => {
        if (res.ok) {
          // Clean up any old blob preview
          if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(`${url}&t=${Date.now()}`);
          setDone(true); // Optional: mark as "done" if you want the UI to show completed
        }
        // Silently ignore 404s - this is expected for new transformers
      })
      .catch(() => {
        // If there's no baseline yet or the endpoint isn't ready, do nothing.
        // This silently handles network errors and 404s
      });
  }, [transformer?.transformerNo]);


  useEffect(() => {
    const fetchIfNeeded = async () => {
      if (!passedTransformer && idFromQuery) {
        setLoadingTransformer(true);
        try {
          const res = await fetch(`${API_BASE}/api/transformers/${idFromQuery}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setTransformer(data);
        } catch (err: any) {
          console.error(err);
          toast({
            title: "Transformer not found",
            description: "Could not load transformer details.",
            variant: "destructive",
          });
        } finally {
          setLoadingTransformer(false);
        }
      }
    };
    fetchIfNeeded();
  }, [API_BASE, idFromQuery, passedTransformer, toast]);

  // If we navigated here right after the popup, ensure it exists server-side.
  useEffect(() => {
    const createIfNeeded = async () => {
      if (passedTransformer && !createdOnServer) {
        try {
          setCreatingOnServer(true);
          const res = await fetch(CREATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(passedTransformer),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const saved = await res.json();
          setTransformer(saved);
          setCreatedOnServer(true);
        } catch (err: any) {
          toast({
            title: "Failed to save transformer",
            description: err?.message ?? "Unknown error",
            variant: "destructive",
          });
        } finally {
          setCreatingOnServer(false);
        }
      }
    };
    createIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewTransformer = (idOrNo?: string | number) => {
    if (!idOrNo) return;
    navigate(`/transformer/${encodeURIComponent(String(idOrNo))}`);
  };

  // cleanup preview object URLs
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validateFile = (f: File) => {
    if (!ACCEPTED_TYPES.has(f.type)) {
      toast({
        title: "Unsupported file",
        description: "Please select a PNG or JPG/JPEG.",
        variant: "destructive",
      });
      return false;
    }
    const sizeMb = f.size / (1024 ** 2);
    if (sizeMb > MAX_MB) {
      toast({
        title: "File too large",
        description: `Max size is ${MAX_MB} MB.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validateFile(f)) return;

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setProgress(0);
    setDone(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!validateFile(f)) return;

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setProgress(0);
    setDone(false);
  };

  const onUpload = async () => {
    if (!file || !transformer?.transformerNo) {
      toast({ title: "Missing data", description: "File or transformer number missing." });
      return;
    }

    setIsUploading(true);

    // Use raw XHR to track upload progress
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${UPLOAD_URL}?transformerNo=${encodeURIComponent(transformer.transformerNo)}`,
      true
    );

    xhr.responseType = "json";

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      setProgress(pct);
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        setDone(true);

        // Always show the server-rendered image via the preview endpoint
        if (transformer?.transformerNo) {
          if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
          const url = SEE_BASELINE_URL(transformer.transformerNo);
          setPreviewUrl(`${url}&t=${Date.now()}`); // cache-bust
        }

        toast({ title: "Baseline uploaded" });
      } else {
        toast({
          title: "Upload failed",
          description: `Server responded ${xhr.status}`,
          variant: "destructive",
        });
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      toast({
        title: "Network error",
        description: "Could not upload the image.",
        variant: "destructive",
      });
    };

    const fd = new FormData();
    fd.append("file", file);                   // IMPORTANT: match server @RequestPart("file")
    fd.append("kind", "BASELINE");             // accepted & ignored
    fd.append("uploaderName", uploaderName);   // Use actual logged-in user
    xhr.send(fd);
  };

  const onSkip = () => {
    // User wants to skip baseline for now
    handleViewTransformer(transformer?.transformerNo ?? transformer?.id);
  };

  if (loadingTransformer || creatingOnServer) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Preparing…</CardTitle>
            <CardDescription>Creating or loading the transformer on the server.</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={33} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageUp className="h-7 w-7" />
            Add Transformer - Baseline Image
          </CardTitle>

          {transformer && (
            <div className="text-sm text-muted-foreground space-y-2">
              <div>
                <span className="font-medium">Transformer {transformer.transformerNo}</span>{" "}
                {transformer?.type && <Badge variant="secondary">{transformer.type}</Badge>}
              </div>
              <div className="text-muted-foreground">
                {transformer?.region ? `Region: ${transformer.region}` : ""}{" "}
                {transformer?.poleNo ? `• Pole: ${transformer.poleNo}` : ""}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Dropzone */}
          {!done && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer hover:bg-muted/40 transition"
            onClick={onPickFile}
          >
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8" />
              <div className="text-base font-medium">
                {file ? "Ready to upload" : "Drop your baseline image here"}
              </div>
              <div className="text-sm text-muted-foreground">
                or click to choose a file (PNG/JPG/JPEG, ≤ {MAX_MB}MB)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>
          )}

          {/* Preview + progress */}
          {previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2 overflow-hidden rounded-xl border">
                <img
                  src={previewUrl}
                  alt="Baseline preview"
                  className="w-full h-full object-contain bg-muted"
                />
              </div>

              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {file
                    ? `${file.name} • ${
                        (file.size / 1024 ** 2) < 0.1
                          ? `${Math.round(file.size / 1024)} KB`
                          : `${(file.size / (1024 ** 2)).toFixed(2)} MB`
                      }`
                    : "Saved image"}
                </div>

                <Progress value={progress} />

                {done ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm">Upload complete (100%).</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {isUploading ? `${progress}% uploaded…` : "Ready to upload"}
                  </div>
                )}

                {!done ? (
                  <div className="flex gap-2 pt-2">
                    <Button className="w-full" onClick={onUpload} disabled={!file || isUploading || creatingOnServer}>
                      {isUploading ? "Uploading…" : "Upload Baseline"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      onClick={() =>
                        handleViewTransformer(transformer?.transformerNo ?? transformer?.id)
                      }
                    >
                      Next
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 gap-2"
                      onClick={() =>
                        handleViewTransformer(transformer?.transformerNo ?? transformer?.id)
                      }
                    >
                      View Transformer
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
              </div>
            </div>
          )}

          {!previewUrl && !done && (
            <div className="text-center text-muted-foreground">
              Please select a baseline image to continue.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
