import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Star, ArrowLeft, Pencil, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

type InspectionRow = {
  id: string;
  inspectedDate: string;
  maintenanceDate?: string | null;
  status: string; // backend sends IN_PROGRESS / COMPLETED / NEEDS_REVIEW
  starred: boolean;
  notes?: string | null;
};

type TransformerFull = {
  transformerNo: string;
  poleNo?: string;
  region?: string;
  inspectedBy?: string;
  capacity?: string;
  type?: string;
  numFreezers?: number;
  lastInspectedAt?: string;
};

// --- NEW: pretty date formatter ---
// Example output: "Mon (21), May, 2023 12.55pm"
function formatNice(ts?: string | null) {
  if (!ts) return "—";
  if (ts === "—" || ts === "-") return "—";
  
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    console.warn("Invalid date format:", ts);
    return "—";
  }

  const wk = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  const month = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ][d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;

  return `${wk} (${day}), ${month}, ${year} ${h}.${m}${ampm}`;
}

const TransformerDetail = () => {
  const { id } = useParams(); // transformerNo from URL (e.g., AZ-1649)
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAddInspectionOpen, setIsAddInspectionOpen] = useState(false);

  // Edit inspection dialog
  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);
  const [editInspection, setEditInspection] = useState({
    id: "",
    dateStr: "",
    timeStr: "",
    maintenanceDateStr: "",
    maintenanceTimeStr: "",
    status: "IN_PROGRESS",
    notes: "",
  });

  // fetched data
  const [transformer, setTransformer] = useState<TransformerFull | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  // New-inspection dialog fields
  const [branch, setBranch] = useState("");
  const [dateStr, setDateStr] = useState(""); // HTML date input: YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(""); // HTML time input: HH:mm

  const tNo = useMemo(() => (id ? decodeURIComponent(id) : ""), [id]);

  // Build ISO string from date (YYYY-MM-DD) + time (HH:mm)
  function toIsoFromDateTime(ymd: string, hhmm?: string) {
    if (!ymd) return undefined;
    const [yyyy, mm, dd] = ymd.split("-").map((s) => parseInt(s, 10));
    const [hh, min] =
      hhmm && hhmm.includes(":") ? hhmm.split(":").map((s) => parseInt(s, 10)) : [0, 0];
    if (!yyyy || !mm || !dd) return undefined;
    const d = new Date(yyyy, mm - 1, dd, hh || 0, min || 0);
    return d.toISOString();
  }

  // Extract date and time from ISO string
  function extractDateTimeFromIso(isoString?: string | null) {
    if (!isoString) return { dateStr: "", timeStr: "" };
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { dateStr: "", timeStr: "" };
    
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().slice(0, 5); // HH:mm
    return { dateStr, timeStr };
  }

  async function loadTransformerDetail(idOrNo: string) {
    const url = `${API_BASE}/api/get-transformer-data?id=${encodeURIComponent(idOrNo)}`;
    setLoading(true);
    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!contentType.includes("application/json")) throw new Error("Non-JSON response");
      const body = await res.json();

      const tf: TransformerFull = body?.transformer ?? {};
      const list: InspectionRow[] = Array.isArray(body?.inspections) ? body.inspections : [];

      setTransformer({
        transformerNo: tf.transformerNo || idOrNo,
        poleNo: tf.poleNo ?? "-",
        region: tf.region ?? "-",
        inspectedBy: "Agent1", // Hardcoded as requested
        capacity: tf.capacity ?? "—",
        type: tf.type ?? "—",
        numFreezers: 5, // Hardcoded as requested
        lastInspectedAt: tf.lastInspectedAt || list[0]?.inspectedDate || "—",
      });

      const mappedInspections = list.map((x, i) => {
        // Debug logging
        console.log(`Inspection ${x.id}:`, {
          inspectedDate: x.inspectedDate,
          maintenanceDate: x.maintenanceDate,
          status: x.status
        });
        
        return {
          id: String(x.id ?? `INS-${i + 1}`),
          inspectedDate: x.inspectedDate ?? "—",
          maintenanceDate: x.maintenanceDate ?? "—",
          status: x.status ?? "IN_PROGRESS", // Keep raw backend status
          starred: Boolean(x.starred),
          notes: x.notes ?? null,
        };
      });

      // Sort inspections: those without maintenance date first, then those with maintenance date
      const sortedInspections = mappedInspections.sort((a, b) => {
        const aHasMaintenance = a.maintenanceDate && a.maintenanceDate !== "—" && a.maintenanceDate !== "-";
        const bHasMaintenance = b.maintenanceDate && b.maintenanceDate !== "—" && b.maintenanceDate !== "-";
        
        // Validate maintenance dates are after inspection dates
        if (aHasMaintenance && a.inspectedDate !== "—") {
          const inspectedDate = new Date(a.inspectedDate);
          const maintenanceDate = new Date(a.maintenanceDate!);
          if (!isNaN(inspectedDate.getTime()) && !isNaN(maintenanceDate.getTime())) {
            if (maintenanceDate.getTime() < inspectedDate.getTime()) {
              console.warn(`Invalid date order for inspection ${a.id}: maintenance (${a.maintenanceDate}) before inspection (${a.inspectedDate})`);
            }
          }
        }
        
        // If one has maintenance date and other doesn't, put the one without maintenance first
        if (aHasMaintenance && !bHasMaintenance) return 1;  // a goes to bottom
        if (!aHasMaintenance && bHasMaintenance) return -1; // a goes to top
        
        // If both have same maintenance status, sort by inspected date (newest first)
        if (a.inspectedDate && b.inspectedDate && a.inspectedDate !== "—" && b.inspectedDate !== "—") {
          const dateA = new Date(a.inspectedDate);
          const dateB = new Date(b.inspectedDate);
          return dateB.getTime() - dateA.getTime(); // Newest first
        }
        
        return 0;
      });

      setInspections(sortedInspections);
      setErr(null);
    } catch (e: any) {
      console.error("[get-transformer-data] error:", e);
      setErr(e?.message ?? "Failed to load transformer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tNo) loadTransformerDetail(tNo);
  }, [tNo]);

  const prettyStatus = (raw: string) => {
    switch ((raw || "").toUpperCase()) {
      case "IN_PROGRESS":
        return "In Progress";
      case "COMPLETED":
        return "Completed";
      case "NEEDS_REVIEW":
        return "Needs Review";
      default:
        return raw || "Pending";
    }
  };

  const getStatusBadge = (raw: string) => {
    const status = prettyStatus(raw);
    switch (status) {
      case "In Progress":
        return <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200">In Progress</Badge>;
      case "Pending":
        return <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">Pending</Badge>;
      case "Completed":
        return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case "Needs Review":
        return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">Needs Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewInspection = (inspection: InspectionRow) => {
    // If inspection is IN_PROGRESS, redirect to thermal image upload page
    if (inspection.status === "IN_PROGRESS") {
      navigate(`/transformer/${encodeURIComponent(tNo)}/inspection/${inspection.id}/thermal-upload`);
    } else {
      // For completed inspections, go to inspection detail page
      navigate(`/transformer/${encodeURIComponent(tNo)}/inspection/${inspection.id}`);
    }
  };

  // Star toggle with API persistence
  const toggleStar = async (rowId: string) => {
    try {
      // Find the current inspection to get its starred status
      const currentInspection = inspections.find(r => r.id === rowId);
      if (!currentInspection) return;

      const newStarredStatus = !currentInspection.starred;

      // Update UI optimistically
      setInspections((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, starred: newStarredStatus } : r))
      );

      // Persist to database
      const res = await fetch(`${API_BASE}/api/inspections/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: newStarredStatus }),
      });

      if (!res.ok) {
        // Revert UI changes if API call fails
        setInspections((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, starred: currentInspection.starred } : r))
        );
        
        toast({
          title: "Failed to update star status",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Toggle star error:", error);
      
      // Revert UI changes on error
      const currentInspection = inspections.find(r => r.id === rowId);
      if (currentInspection) {
        setInspections((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, starred: currentInspection.starred } : r))
        );
      }
      
      toast({
        title: "Failed to update star status",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Open edit dialog for inspection
  const openEditInspection = (inspection: InspectionRow) => {
    const inspectedDateTime = extractDateTimeFromIso(inspection.inspectedDate);
    const maintenanceDateTime = extractDateTimeFromIso(inspection.maintenanceDate);
    
    setEditInspection({
      id: inspection.id,
      dateStr: inspectedDateTime.dateStr,
      timeStr: inspectedDateTime.timeStr,
      maintenanceDateStr: maintenanceDateTime.dateStr,
      maintenanceTimeStr: maintenanceDateTime.timeStr,
      status: inspection.status || "IN_PROGRESS", // Use raw backend status
      notes: inspection.notes || "",
    });
    setIsEditInspectionOpen(true);
  };

  // Save inspection edits
  const saveInspectionEdit = async () => {
    if (!editInspection.id) {
      toast({ title: "Missing inspection ID", variant: "destructive" });
      return;
    }

    try {
      const inspectedAt = toIsoFromDateTime(editInspection.dateStr, editInspection.timeStr);
      const maintenanceAt = editInspection.maintenanceDateStr 
        ? toIsoFromDateTime(editInspection.maintenanceDateStr, editInspection.maintenanceTimeStr)
        : null;

      const payload = {
        inspectedAt,
        maintenanceDate: maintenanceAt, // Backend expects maintenanceDate
        notes: editInspection.notes?.trim() || null,
      };

      const res = await fetch(`${API_BASE}/api/inspections/${editInspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let details = "";
        try {
          const data = await res.json();
          details = data?.message || JSON.stringify(data);
        } catch {
          details = await res.text();
        }
        throw new Error(`HTTP ${res.status}${details ? ` – ${details}` : ""}`);
      }

      toast({ title: "Inspection updated successfully" });
      setIsEditInspectionOpen(false);
      
      // Reset edit form
      setEditInspection({
        id: "",
        dateStr: "",
        timeStr: "",
        maintenanceDateStr: "",
        maintenanceTimeStr: "",
        status: "IN_PROGRESS",
        notes: "",
      });
      
      // Reload data
      await loadTransformerDetail(tNo);
    } catch (e: any) {
      console.error("[update inspection] error:", e);
      toast({
        title: "Update failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Delete inspection
  const deleteInspection = async () => {
    if (!editInspection.id) return;
    
    if (!window.confirm("Delete this inspection? This action cannot be undone.")) return;

    try {
      const res = await fetch(`${API_BASE}/api/inspections/${editInspection.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // Clean up localStorage anomaly results
      const anomalyResultsKey = `anomaly_results_${tNo}_${editInspection.id}`;
      localStorage.removeItem(anomalyResultsKey);
      console.log(`Cleaned up anomaly results: ${anomalyResultsKey}`);

      toast({ title: "Inspection deleted successfully" });
      setIsEditInspectionOpen(false);
      
      // Reset edit form
      setEditInspection({
        id: "",
        dateStr: "",
        timeStr: "",
        maintenanceDateStr: "",
        maintenanceTimeStr: "",
        status: "IN_PROGRESS",
        notes: "",
      });
      
      // Reload data
      await loadTransformerDetail(tNo);
    } catch (e: any) {
      console.error("Delete inspection error:", e);
      toast({
        title: "Delete failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Delete thermal image for completed inspections
  const deleteThermalImage = async () => {
    if (!editInspection.id) return;
    
    if (!window.confirm("Delete the thermal image for this inspection? This action cannot be undone.")) return;

    try {
      const res = await fetch(`${API_BASE}/api/inspections/${editInspection.id}/thermal-image`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // Clean up localStorage anomaly results when thermal image is deleted
      const anomalyResultsKey = `anomaly_results_${tNo}_${editInspection.id}`;
      localStorage.removeItem(anomalyResultsKey);
      console.log(`Cleaned up anomaly results after thermal image deletion: ${anomalyResultsKey}`);

      toast({ title: "Thermal image deleted successfully" });
      
      // Reload data to reflect changes
      await loadTransformerDetail(tNo);
    } catch (e: any) {
      console.error("Delete thermal image error:", e);
      toast({
        title: "Delete thermal image failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

const handleConfirmNewInspection = async () => {
  if (!tNo) {
    toast({ title: "Missing transformer number", variant: "destructive" });
    return;
  }

  // Always send inspectedAt; default to now when inputs are empty
  const when = toIsoFromDateTime(dateStr, timeStr) ?? new Date().toISOString();

  const payload = {
    inspectedAt: when,     // required by backend
    maintenanceDate: null, // align with backend DTO
    status: "IN_PROGRESS",
    notes: branch?.trim() || null,
    starred: false,
  };

  try {
    const res = await fetch(
      `${API_BASE}/api/transformers/${encodeURIComponent(tNo)}/inspections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      // show server error details if any
      let details = "";
      try {
        const data = await res.json();
        details = data?.message || JSON.stringify(data);
      } catch {
        details = await res.text();
      }
      throw new Error(`HTTP ${res.status}${details ? ` – ${details}` : ""}`);
    }

    await res.json();
    toast({ title: "Inspection created" });

    // reset + reload
    setIsAddInspectionOpen(false);
    setBranch("");
    setDateStr("");
    setTimeStr("");
    await loadTransformerDetail(tNo);
  } catch (e: any) {
    console.error("[create inspection] payload:", payload, "error:", e);
    toast({
      title: "Create failed",
      description: e?.message ?? "Unknown error",
      variant: "destructive",
    });
  }
};


  return (
    <Layout title="Transformer">
      <div className="relative min-h-screen">
        <div aria-hidden className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/dashboard_bg.svg')" }} />
        <div className="relative p-6 space-y-6 bg-background/70 backdrop-blur-sm">
          {/* Back Button */}
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Loading / Error */}
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {err && !loading && <div className="text-sm text-red-600">Error: {err}</div>}

        {/* Transformer Info Header */}
        {transformer && !loading && !err && (
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-4">
              <Badge variant="secondary" className="gap-2">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                {transformer.transformerNo}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {/* CHANGED: formatted display */}
                Last Inspected Date: {formatNice(transformer.lastInspectedAt)}
              </span>
            </div>

            {/* Details Grid - Left Aligned */}
            <div className="flex items-center justify-between gap-6">
              {/* Left Side - Details Grid */}
              <div className="grid grid-cols-4 gap-3 w-auto">
                <div className="bg-gray-50 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformer.transformerNo}</div>
                  <div className="text-xs font-medium text-gray-700">Transformer No.</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformer.poleNo}</div>
                  <div className="text-xs font-medium text-gray-700">Pole No.</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformer.region}</div>
                  <div className="text-xs font-medium text-gray-700">Branch</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-gray-800">{transformer.inspectedBy}</div>
                  <div className="text-xs font-medium text-gray-700">Inspected By</div>
                </div>
              </div>
            </div>

            {/* Additional Details - Left Aligned */}
            <div className="mt-4 flex items-center justify-between gap-6">
              {/* Left Side - Additional Details Grid */}
              <div className="grid grid-cols-3 gap-3 w-auto">
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-primary">{transformer.capacity ?? "—"}</div>
                  <div className="text-xs font-medium text-primary/70">Capacity</div>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-primary">{transformer.type ?? "—"}</div>
                  <div className="text-xs font-medium text-primary/70">Type</div>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-primary">{transformer.numFreezers}</div>
                  <div className="text-xs font-medium text-primary/70">No. of Freezers</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspections Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transformer Inspections</h2>

          <Dialog open={isAddInspectionOpen} onOpenChange={setIsAddInspectionOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Inspection
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New Inspection</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    placeholder="Branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transformerNo">Transformer No</Label>
                  <Input id="transformerNo" value={tNo} readOnly />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date of inspection</Label>
                    <Input
                      id="date"
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={timeStr}
                      onChange={(e) => setTimeStr(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={handleConfirmNewInspection}>
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsAddInspectionOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Inspections Table */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b bg-muted/30 px-6 py-3">
              <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Inspection No.</span>
                </div>
                <div>Inspected Date</div>
                <div>Maintenance Date</div>
                <div>Status</div>
                <div></div>
                <div></div>
              </div>
            </div>

            <div className="divide-y">
              {inspections.map((inspection) => (
                <div key={inspection.id} className="grid grid-cols-6 gap-4 px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      className="p-0.5"
                      onClick={() => toggleStar(inspection.id)}
                      title={inspection.starred ? "Unstar" : "Star"}
                    >
                      {inspection.starred ? (
                        <Star className="h-4 w-4 fill-primary text-primary" />
                      ) : (
                        <Star className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className="font-medium">{inspection.id}</span>
                  </div>
                  {/* CHANGED: formatted display */}
                  <div className="text-muted-foreground">
                    {formatNice(inspection.inspectedDate)}
                  </div>
                  <div className="text-muted-foreground">
                    {formatNice(inspection.maintenanceDate || undefined)}
                  </div>
                  <div>{getStatusBadge(inspection.status)}</div>
                  <div></div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1" 
                      onClick={() => openEditInspection(inspection)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => handleViewInspection(inspection)}>
                      View
                    </Button>
                  </div>
                </div>
              ))}

              {!loading && !err && inspections.length === 0 && (
                <div className="px-6 py-8 text-sm text-muted-foreground">No inspections found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination (static placeholder) */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm">
            &lt;
          </Button>
          {[1, 2, 3, 4, 5, 6].map((page) => (
            <Button
              key={page}
              variant={page === 1 ? "default" : "outline"}
              size="sm"
              className="h-8 w-8"
            >
              {page}
            </Button>
          ))}
          <span className="px-2 text-sm text-muted-foreground">...</span>
          <Button variant="outline" size="sm" className="h-8 w-8">
            56
          </Button>
          <Button variant="outline" size="sm">
            &gt;
          </Button>
        </div>

        {/* Edit Inspection Dialog */}
        <Dialog open={isEditInspectionOpen} onOpenChange={setIsEditInspectionOpen}>
          <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Edit Inspection #{editInspection.id}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  placeholder="Inspection notes"
                  value={editInspection.notes}
                  onChange={(e) => setEditInspection(prev => ({ ...prev, notes: e.target.value }))}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editDate">Inspected Date</Label>
                  <Input
                    id="editDate"
                    type="date"
                    value={editInspection.dateStr}
                    onChange={(e) => setEditInspection(prev => ({ ...prev, dateStr: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editTime">Inspected Time</Label>
                  <Input
                    id="editTime"
                    type="time"
                    value={editInspection.timeStr}
                    onChange={(e) => setEditInspection(prev => ({ ...prev, timeStr: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editMaintenanceDate">Maintenance Date</Label>
                  <Input
                    id="editMaintenanceDate"
                    type="date"
                    value={editInspection.maintenanceDateStr}
                    onChange={(e) => setEditInspection(prev => ({ ...prev, maintenanceDateStr: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMaintenanceTime">Maintenance Time</Label>
                  <Input
                    id="editMaintenanceTime"
                    type="time"
                    value={editInspection.maintenanceTimeStr}
                    onChange={(e) => setEditInspection(prev => ({ ...prev, maintenanceTimeStr: e.target.value }))}
                  />
                </div>
              </div>

              {/* Conditionally show Delete Thermal Image button for completed inspections */}
              {editInspection.status === "COMPLETED" && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-orange-900">Thermal Image Management</h4>
                      <p className="text-xs text-orange-700 mt-1">
                        Remove thermal image from this completed inspection
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-700" 
                      onClick={deleteThermalImage}
                    >
                      <Image className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={saveInspectionEdit}>
                  Save
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 gap-1" 
                  onClick={deleteInspection}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditInspectionOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </Layout>
  );
};

export default TransformerDetail;
