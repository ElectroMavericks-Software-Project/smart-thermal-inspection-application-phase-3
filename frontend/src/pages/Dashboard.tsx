import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Search, Star, Filter, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { log } from "console";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const user = localStorage.getItem("user");

type Row = {
  id: string;         // shown as Transformer No (mapped from backend.transformerNo)
  poleNo: string;
  capacity?: string;
  region: string;
  type: string;
  starred: boolean;
  locationDetails?: string;
};

const initialRows: Row[] = [];

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    idOriginal: "",
    transformerNo: "",
    poleNo: "",
    capacity: "",
    region: "",
    type: "",
    locationDetails: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();

  // Add form
  const [region, setRegion] = useState("");
  const [transformerNo, setTransformerNo] = useState("");
  const [poleNo, setPoleNo] = useState("");
  const [capacity, setCapacity] = useState("");
  const [type, setType] = useState("");
  const [locationDetails, setLocationDetails] = useState("");

  // Toast passthrough
  useEffect(() => {
    const state = location.state as { toast?: { title: string; description?: string; variant?: "destructive" } } | null;
    if (state?.toast) {
      toast(state.toast);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, toast, location.pathname]);

  // Load table
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`${API_BASE}/api/transformers`, { signal: ctl.signal })
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        if (!ct.includes("application/json")) throw new Error("Non-JSON response");
        const body = await res.json();
        const list = Array.isArray(body) ? body : body?.content ?? [];
        const mapped: Row[] = list.map((x: any, i: number) => ({
          id: String(x.transformerNo ?? x.id ?? `T-${i + 1}`),
          poleNo: x.poleNo ?? "-",
          capacity: x.capacity ?? "-",
          region: x.region ?? "Unknown",
          type: x.type ?? "-",
          starred: Boolean(x.starred),
          locationDetails: x.locationDetails ?? "",
        }));
        if (mapped.length) setRows(mapped);
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "API error", description: String(e.message || e), variant: "destructive" });
      });
    return () => ctl.abort();
  }, [toast]);

  const toggleStar = async (id: string) => {
    // Optimistically update UI first
    const targetRow = rows.find(r => r.id === id);
    if (!targetRow) return;
    
    const newStarredState = !targetRow.starred;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, starred: newStarredState } : r)));
    
    // Persist to backend
    try {
      const response = await fetch(`${API_BASE}/api/transformers/${encodeURIComponent(id)}`, {
        method: 'PUT',
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
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, starred: targetRow.starred } : r)));
      toast({
        title: "Error",
        description: "Failed to update star status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const filtered = rows.filter((r) => {
    const s = searchTerm.toLowerCase();
    const okSearch = r.id.toLowerCase().includes(s) || r.poleNo.toLowerCase().includes(s);
    const okRegion = selectedRegion === "all" || r.region === selectedRegion;
    const okType = selectedType === "all" || r.type === selectedType;
    const okStarred = !showStarredOnly || r.starred;
    return okSearch && okRegion && okType && okStarred;
  }).sort((a, b) => {
    // Sort starred transformers to the top
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return 0; // Keep original order for items with same star status
  });

  const handleView = (id: string) => navigate(`/transformer/${encodeURIComponent(id)}`);

  // Create → navigate to baseline screen; that screen will POST /api/add_transformer
  const handleConfirmAdd = () => {
    if (!region || !transformerNo || !type) {
      toast({ title: "Missing required fields", description: "Please fill Region, Transformer No, and Type.", variant: "destructive" });
      return;
    }
    const tempId = transformerNo || `TMP-${Date.now()}`;
    const created = {
      id: tempId,
      transformerNo,
      poleNo,
      capacity,
      region,
      type,
      locationDetails,
      starred: false,
      createdAt: new Date().toISOString(),
    };
    setIsAddDialogOpen(false);
    navigate(`/add_transformer?id=${encodeURIComponent(tempId)}`, { state: { transformer: created } });
    setRegion(""); setTransformerNo(""); setPoleNo(""); setCapacity(""); setType(""); setLocationDetails("");
  };

  /* ---------------- edit flow ---------------- */

  const openEdit = (r: Row) => {
    setEditForm({
      idOriginal: r.id,
      transformerNo: r.id,
      poleNo: r.poleNo ?? "",
      capacity: r.capacity ?? "",
      region: r.region ?? "",
      type: r.type ?? "",
      locationDetails: r.locationDetails ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.region || !editForm.transformerNo || !editForm.type) {
      toast({ title: "Missing required fields", description: "Please fill Region, Transformer No, and Type.", variant: "destructive" });
      return;
    }
    if (editForm.transformerNo !== editForm.idOriginal && rows.some((r) => r.id === editForm.transformerNo)) {
      toast({ title: "Duplicate Transformer No", description: "Another entry already uses this Transformer No.", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/transformers/${encodeURIComponent(editForm.idOriginal)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transformerNo: editForm.transformerNo,
          poleNo: editForm.poleNo,
          capacity: editForm.capacity,
          region: editForm.region,
          type: editForm.type,
          locationDetails: editForm.locationDetails,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();

      setRows((prev) =>
        prev.map((r) =>
          r.id === editForm.idOriginal
            ? {
                ...r,
                id: updated.transformerNo ?? editForm.transformerNo,
                poleNo: updated.poleNo ?? editForm.poleNo,
                capacity: updated.capacity ?? editForm.capacity,
                region: updated.region ?? editForm.region,
                type: updated.type ?? editForm.type,
                locationDetails: updated.locationDetails ?? editForm.locationDetails,
              }
            : r
        )
      );

      setIsEditDialogOpen(false);
      toast({ title: "Saved" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Save failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const deleteEdit = async () => {
    if (!window.confirm("Delete this transformer?")) return;
    try {
      console.log("Attempting to delete transformer:", editForm.idOriginal);
      const res = await fetch(`${API_BASE}/api/transformers/${encodeURIComponent(editForm.idOriginal)}`, { method: "DELETE" });
      console.log("Delete response status:", res.status, res.statusText);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      console.log("Delete successful, updating local state");
      // Remove from local state
      setRows((prev) => prev.filter((r) => r.id !== editForm.idOriginal));
      setIsEditDialogOpen(false);
      toast({ title: "Transformer deleted successfully" });
    } catch (e: any) {
      console.error("Delete error:", e);
      toast({ title: "Delete failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  /* ---------------- render ---------------- */

  return (
    <Layout title="Transformers">
      <div className="relative min-h-screen">
        <div aria-hidden className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/dashboard_bg.svg')" }} />
        <div className="relative p-6 space-y-6 bg-background/70 backdrop-blur-sm">
          {/* header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Transformers
              </Badge>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Add Transformer</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Add Transformer</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Nugegoda">Nugegoda</SelectItem>
                          <SelectItem value="Maharagama">Maharagama</SelectItem>
                          <SelectItem value="Colombo">Colombo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Transformer No</Label>
                      <Input value={transformerNo} onChange={(e) => setTransformerNo(e.target.value)} placeholder="Transformer No" />
                    </div>

                    <div className="space-y-2">
                      <Label>Pole No</Label>
                      <Input value={poleNo} onChange={(e) => setPoleNo(e.target.value)} placeholder="Pole No" />
                    </div>

                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" />
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bulk">Bulk</SelectItem>
                          <SelectItem value="Distribution">Distribution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Location Details</Label>
                      <Textarea className="resize-none" value={locationDetails} onChange={(e) => setLocationDetails(e.target.value)} placeholder="Location Details" />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button className="flex-1" onClick={handleConfirmAdd}>Confirm</Button>
                      <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" className="gap-2">Transformers</Button>
              <Button variant="ghost" className="gap-2" onClick={() => navigate("/inspections")}>Inspections</Button>
            </div>
          </div>

          {/* filters */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>By Transformer No.</Label>
              <Select>
                <SelectTrigger className="w-40"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search Transformer" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <Button 
              variant={showStarredOnly ? "default" : "outline"} 
              size="icon" 
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              title={showStarredOnly ? "Show all transformers" : "Show only starred transformers"}
            >
              <Star className={`h-4 w-4 ${showStarredOnly ? "fill-current" : ""}`} />
            </Button>

            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Regions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="Nugegoda">Nugegoda</SelectItem>
                <SelectItem value="Maharagama">Maharagama</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Bulk">Bulk</SelectItem>
                <SelectItem value="Distribution">Distribution</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" className="gap-2" onClick={() => {
              setSearchTerm("");
              setSelectedRegion("all");
              setSelectedType("all");
              setShowStarredOnly(false);
            }}>
              <Filter className="h-4 w-4" />Reset Filters
            </Button>
          </div>

          {/* table */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b bg-muted/30 px-6 py-3">
                <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2"><span>Transformer No.</span></div>
                  <div>Pole No.</div>
                  <div>Region</div>
                  <div>Type</div>
                  <div></div>
                  <div></div>
                </div>
              </div>

              <div className="divide-y">
                {filtered.map((r) => (
                  <div key={r.id} className="grid grid-cols-6 gap-4 px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="cursor-pointer" onClick={() => toggleStar(r.id)}>
                        {r.starred ? <Star className="h-4 w-4 fill-primary text-primary" /> : <Star className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <span className="font-medium">{r.id}</span>
                    </div>
                    <div className="text-muted-foreground">{r.poleNo}</div>
                    <div className="text-muted-foreground">{r.region}</div>
                    <div className="text-muted-foreground">{r.type}</div>
                    <div></div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />Edit
                      </Button>
                      <Button size="sm" onClick={() => handleView(r.id)}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* demo pagination */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm">&lt;</Button>
            {[1,2,3,4,5,6].map((p) => (
              <Button key={p} variant={p===1 ? "default" : "outline"} size="sm" className="h-8 w-8">{p}</Button>
            ))}
            <span className="px-2 text-sm text-muted-foreground">...</span>
            <Button variant="outline" size="sm" className="h-8 w-8">56</Button>
            <Button variant="outline" size="sm">&gt;</Button>
          </div>
        </div>
      </div>

      {/* EDIT DIALOG */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Transformer</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={editForm.region} onValueChange={(v) => setEditForm((s) => ({ ...s, region: v }))}>
                <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nugegoda">Nugegoda</SelectItem>
                  <SelectItem value="Maharagama">Maharagama</SelectItem>
                  <SelectItem value="Colombo">Colombo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transformer No</Label>
              <Input value={editForm.transformerNo} onChange={(e) => setEditForm((s) => ({ ...s, transformerNo: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Pole No</Label>
              <Input value={editForm.poleNo} onChange={(e) => setEditForm((s) => ({ ...s, poleNo: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input value={editForm.capacity} onChange={(e) => setEditForm((s) => ({ ...s, capacity: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm((s) => ({ ...s, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bulk">Bulk</SelectItem>
                  <SelectItem value="Distribution">Distribution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location Details</Label>
              <Textarea className="resize-none" value={editForm.locationDetails} onChange={(e) => setEditForm((s) => ({ ...s, locationDetails: e.target.value }))} placeholder="Location Details" />
            </div>

            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={saveEdit}>Save</Button>
              <Button variant="destructive" className="flex-1 gap-1" onClick={deleteEdit}><Trash2 className="h-4 w-4" />Delete</Button>
              <Button variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
