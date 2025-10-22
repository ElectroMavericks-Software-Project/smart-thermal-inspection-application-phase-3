import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Star, Filter, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

type InspectionRow = {
  transformerNo: string;
  inspectionNo: string;      // zero-padded string e.g. "000000008"
  inspectedDate: string;     // already formatted by backend
  maintenanceDate: string;   // already formatted or "-"
  status: "In Progress" | "Pending" | "Completed" | "Needs Review" | string;
  starred: boolean;
  inspectedAtIso?: string | null;
  maintenanceAtIso?: string | null;
  notes?: string;  // May not be available in table view, will fetch if needed
};

const getStatusBadge = (status: string) => {
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

const Inspections = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data state
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | InspectionRow["status"]>("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // Add Inspection dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [tNo, setTNo] = useState("");
  const [branch, setBranch] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  // Edit Inspection dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<InspectionRow | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDateStr, setEditDateStr] = useState("");
  const [editTimeStr, setEditTimeStr] = useState("");
  const [editMaintDateStr, setEditMaintDateStr] = useState("");
  const [editMaintTimeStr, setEditMaintTimeStr] = useState("");

  // Build unique transformer numbers for dropdown
  const transformerOptions = useMemo(
    () => Array.from(new Set(inspections.map(r => r.transformerNo))).sort(),
    [inspections]
  );

  // When dialog opens and no selection yet, default to first transformer if available
  useEffect(() => {
    if (isAddDialogOpen && !tNo && transformerOptions.length > 0) {
      setTNo(transformerOptions[0]);
    }
  }, [isAddDialogOpen, tNo, transformerOptions]);

  // Fetcher extracted so we can reuse after creating an inspection
  const fetchInspections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/get-inspection-table`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InspectionRow[] = await res.json();
      setInspections(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load inspections");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchInspections();
      } catch {
        /* handled in fetchInspections */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Toggle star with backend persistence
  const toggleStar = async (transformerNo: string, inspectionNo: string) => {
    // Find the target inspection
    const targetInspection = inspections.find(
      item => item.transformerNo === transformerNo && item.inspectionNo === inspectionNo
    );
    if (!targetInspection) return;

    const newStarredState = !targetInspection.starred;
    
    // Optimistically update UI first
    setInspections(prev =>
      prev.map(item => 
        item.transformerNo === transformerNo && item.inspectionNo === inspectionNo
          ? { ...item, starred: newStarredState }
          : item
      )
    );

    // Persist to backend
    try {
      const numericId = parseInt(inspectionNo, 10);
      const response = await fetch(`${API_BASE}/api/inspections/${numericId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ starred: newStarredState }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update star status: ${response.status}`);
      }
      
      // Success - no need to update UI again since we did optimistic update
    } catch (error) {
      console.error('Error updating star status:', error);
      // Revert optimistic update on error
      setInspections(prev =>
        prev.map(item => 
          item.transformerNo === transformerNo && item.inspectionNo === inspectionNo
            ? { ...item, starred: targetInspection.starred }
            : item
        )
      );
      alert('Failed to update star status. Please try again.');
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedFilter("all");
    setSortDirection("asc");
    setShowStarredOnly(false);
  };

  // Combine date and time to ISO string; returns null if date missing
  const toIsoFromDateTime = (dateS: string, timeS: string): string | null => {
    if (!dateS) return null;
    const t = timeS && /^\d{2}:\d{2}/.test(timeS) ? timeS : "00:00";
    const dt = new Date(`${dateS}T${t}`);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  // Confirm create inspection
  const handleConfirmNewInspection = async () => {
    if (!tNo) {
      alert("Please select a transformer number.");
      return;
    }

    const when = toIsoFromDateTime(dateStr, timeStr) ?? new Date().toISOString();

    const payload = {
      inspectedAt: when,
      maintenanceDate: null,
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
        let details = "";
        try {
          const data = await res.json();
          details = data?.message || JSON.stringify(data);
        } catch {
          details = await res.text();
        }
        throw new Error(`HTTP ${res.status}${details ? ` – ${details}` : ""}`);
      }

      // Success: close dialog, reset fields, refresh table
      setIsAddDialogOpen(false);
      setBranch("");
      setDateStr("");
      setTimeStr("");
      await fetchInspections();
    } catch (e: any) {
      alert(`Create failed: ${e?.message ?? "Unknown error"}`);
    }
  };

  // Open edit dialog for an inspection
  const openEditInspection = async (inspection: InspectionRow) => {
    try {
      // Fetch full inspection details to get notes and other fields
      // inspectionNo is zero-padded; backend expects numeric id
      const numericId = parseInt(inspection.inspectionNo, 10);
      const res = await fetch(`${API_BASE}/api/inspections/${numericId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch inspection details: ${res.status}`);
      }
      const fullInspection = await res.json();
      
      setEditingInspection(inspection);
      
      // Extract date/time from inspectedDate (format: "2024-11-24 10:00:00")
      if (inspection.inspectedDate) {
        const [datePart, timePart] = inspection.inspectedDate.split(' ');
        setEditDateStr(datePart || "");
        setEditTimeStr(timePart?.substring(0, 5) || ""); // HH:MM
      } else {
        setEditDateStr("");
        setEditTimeStr("");
      }
      
      setEditNotes(fullInspection.notes || "");
      
      // Extract maintenance date/time if available
      if (inspection.maintenanceDate && inspection.maintenanceDate !== "N/A") {
        const [maintDatePart, maintTimePart] = inspection.maintenanceDate.split(' ');
        setEditMaintDateStr(maintDatePart || "");
        setEditMaintTimeStr(maintTimePart?.substring(0, 5) || "");
      } else {
        setEditMaintDateStr("");
        setEditMaintTimeStr("");
      }
      
      setIsEditDialogOpen(true);
    } catch (e: any) {
      toast({
        title: "Error",
        description: `Failed to load inspection details: ${e?.message ?? "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // Save inspection edits
  const saveInspectionEdit = async () => {
    if (!editingInspection) return;
    
    try {
      // Combine date + time for inspected date
      let inspectedDate = "";
      if (editDateStr) {
        inspectedDate = editTimeStr ? `${editDateStr} ${editTimeStr}:00` : `${editDateStr} 00:00:00`;
      }
      
      // Combine date + time for maintenance date (optional)
      let maintenanceDate = null;
      if (editMaintDateStr) {
        maintenanceDate = editMaintTimeStr ? `${editMaintDateStr} ${editMaintTimeStr}:00` : `${editMaintDateStr} 00:00:00`;
      }
      
      const payload: any = {
        notes: editNotes,
        inspectedDate,
        maintenanceDate
      };
      
      const res = await fetch(`${API_BASE}/api/inspections/${editingInspection.inspectionNo}`, {
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
      
      toast({
        title: "Success",
        description: "Inspection updated successfully",
      });
      
      setIsEditDialogOpen(false);
      setEditingInspection(null);
      await fetchInspections();
      
    } catch (e: any) {
      toast({
        title: "Error",
        description: `Update failed: ${e?.message ?? "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // Delete inspection
  const deleteInspection = async () => {
    if (!editingInspection) return;
    
    if (!confirm(`Are you sure you want to delete inspection ${editingInspection.inspectionNo}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/inspections/${editingInspection.inspectionNo}`, {
        method: "DELETE",
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
      
      // Clean up localStorage anomaly results
      const anomalyResultsKey = `anomaly_results_${editingInspection.transformerNo}_${editingInspection.inspectionNo}`;
      localStorage.removeItem(anomalyResultsKey);
      console.log(`Cleaned up anomaly results: ${anomalyResultsKey}`);
      
      toast({
        title: "Success",
        description: "Inspection deleted successfully",
      });
      
      setIsEditDialogOpen(false);
      setEditingInspection(null);
      await fetchInspections();
      
    } catch (e: any) {
      toast({
        title: "Error",
        description: `Delete failed: ${e?.message ?? "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // Derived filtered + sorted rows
  const filteredInspections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = inspections.filter(row => {
      const matchesSearch =
        row.transformerNo.toLowerCase().includes(term) ||
        row.inspectionNo.toLowerCase().includes(term);
      const matchesFilter = selectedFilter === "all" || row.status === selectedFilter;
      const matchesStarFilter = !showStarredOnly || row.starred;
      return matchesSearch && matchesFilter && matchesStarFilter;
    });
    rows.sort((a, b) => {
      // Sort starred inspections to the top first
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      // Then sort by transformer number
      const cmp = a.transformerNo.localeCompare(b.transformerNo, undefined, { numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [inspections, searchTerm, selectedFilter, sortDirection, showStarredOnly]);

  // Navigate to details using transformerNo + numeric id from padded string
  const goToView = (row: InspectionRow) => {
    const numericId = parseInt(row.inspectionNo, 10);
    navigate(`/transformer/${row.transformerNo}/inspection/${numericId}`);
  };

  return (
    <Layout title="Transformer > All Inspections">
      <div className="relative min-h-screen">
        <div aria-hidden className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/dashboard_bg.svg')" }} />
        <div className="relative p-6 space-y-6 bg-background/70 backdrop-blur-sm">
          {/* Header Section */}
          <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="gap-2">
              <span className="h-2 w-2 rounded-full bg-primary"></span>
              Inspections
            </Badge>

            {/* Add Inspection Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                    <Select value={tNo} onValueChange={setTNo}>
                      <SelectTrigger id="transformerNo">
                        <SelectValue placeholder="Select Transformer" />
                      </SelectTrigger>
                      <SelectContent>
                        {transformerOptions.map(no => (
                          <SelectItem key={no} value={no}>
                            {no}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Button className="flex-1" onClick={handleConfirmNewInspection} disabled={!tNo}>
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Inspection Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Inspection {editingInspection?.inspectionNo}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editNotes">Notes</Label>
                  <Textarea
                    id="editNotes"
                    placeholder="Inspection notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editDate">Date of inspection</Label>
                    <Input
                      id="editDate"
                      type="date"
                      value={editDateStr}
                      onChange={(e) => setEditDateStr(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editTime">Time</Label>
                    <Input
                      id="editTime"
                      type="time"
                      value={editTimeStr}
                      onChange={(e) => setEditTimeStr(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editMaintDate">Maintenance Date</Label>
                    <Input
                      id="editMaintDate"
                      type="date"
                      value={editMaintDateStr}
                      onChange={(e) => setEditMaintDateStr(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editMaintTime">Maintenance Time</Label>
                    <Input
                      id="editMaintTime"
                      type="time"
                      value={editMaintTimeStr}
                      onChange={(e) => setEditMaintTimeStr(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={saveInspectionEdit}>
                    Save Changes
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
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/')}>
              Transformers
            </Button>
            <Button variant="outline" className="gap-2">
              Inspections
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>By Transformer No.</Label>
            <Select value={sortDirection} onValueChange={(v: "asc" | "desc") => setSortDirection(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Order" />
                <ChevronDown className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Transformer / Inspection No"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            variant={showStarredOnly ? "default" : "outline"}
            size="icon"
            title={showStarredOnly ? "Show all inspections" : "Show only starred inspections"}
            onClick={() => setShowStarredOnly(!showStarredOnly)}
          >
            <Star className={`h-4 w-4 ${showStarredOnly ? "fill-current" : ""}`} />
          </Button>

          <Select
            value={selectedFilter}
            onValueChange={(v) => setSelectedFilter(v as any)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Needs Review">Needs Review</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" className="gap-2" onClick={resetFilters}>
            <Filter className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="text-sm text-muted-foreground px-1 pb-4">Loading inspections…</div>
        )}
        {error && (
          <div className="text-sm text-red-600 px-1 pb-4">{error}</div>
        )}

        {/* Table */}
        {!loading && !error && (
          <Card>
            <CardContent className="p-0">
              <div className="border-b bg-muted/30 px-6 py-3">
                <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Transformer No.</span>
                  </div>
                  <div>Inspection No</div>
                  <div>Inspected Date</div>
                  <div>Maintenance Date</div>
                  <div>Status</div>
                  <div></div>
                </div>
              </div>
              <div className="divide-y">
                {filteredInspections.map((row, index) => (
                    <div key={`${row.transformerNo}-${row.inspectionNo}-${index}`} className="grid grid-cols-6 gap-4 px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="cursor-pointer" onClick={() => toggleStar(row.transformerNo, row.inspectionNo)}>
                          {row.starred ? (
                            <Star className="h-4 w-4 fill-primary text-primary" />
                          ) : (
                            <Star className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium">{row.transformerNo}</span>
                      </div>
                      <div className="text-muted-foreground">{row.inspectionNo}</div>
                      <div className="text-muted-foreground">{row.inspectedDate}</div>
                      <div className="text-muted-foreground">{row.maintenanceDate}</div>
                      <div>{getStatusBadge(row.status)}</div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1" 
                          onClick={() => openEditInspection(row)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => goToView(row)}>View</Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination placeholder (static) */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm">&lt;</Button>
          {[1, 2, 3, 4, 5, 6].map((page) => (
            <Button key={page} variant={page === 1 ? "default" : "outline"} size="sm" className="h-8 w-8">
              {page}
            </Button>
          ))}
          <span className="px-2 text-sm text-muted-foreground">...</span>
          <Button variant="outline" size="sm" className="h-8 w-8">56</Button>
          <Button variant="outline" size="sm">&gt;</Button>
        </div>
        </div>
      </div>
    </Layout>
  );
};

export default Inspections;
