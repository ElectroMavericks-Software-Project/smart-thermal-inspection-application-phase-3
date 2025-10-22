import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const [exporting, setExporting] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const handleExportJson = async () => {
    setExporting(true);
    try {
      // 1) Fetch all inspections from the table
      const tableRes = await fetch(`${API_BASE}/api/get-inspection-table`);
      if (!tableRes.ok) throw new Error(`HTTP ${tableRes.status}`);
      const table: any[] = await tableRes.json();
      const ids: number[] = table
        .map(r => parseInt(r.inspectionNo, 10))
        .filter(n => Number.isFinite(n));

      // 2) For each id, fetch annotations and build the minimal object
      const results: any[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`${API_BASE}/api/get-annotations/${id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!data?.success) {
            results.push({ imageId: String(id), modelPredicted: { count: 0, items: [] }, finalAccepted: [], annotatorMetadata: { total: 0, annotators: [] } });
            continue;
          }
          const detections: any[] = Array.isArray(data.detections) ? data.detections : [];
          const modelPredicted = detections.filter(d => (d.annotationType || 'Detected by AI') === 'Detected by AI');
          const finalAccepted = detections.filter(d => {
            const t = String(d.annotationType || '').toLowerCase();
            return t === 'manual' || t === 'edited';
          });
          const counts = new Map<string, number>();
          for (const d of finalAccepted) {
            const u = (d.createdBy || 'unknown').toString();
            counts.set(u, (counts.get(u) || 0) + 1);
          }
          const annotators = Array.from(counts.entries()).map(([user, count]) => ({ user, count }));
          results.push({
            imageId: String(id),
            modelPredicted: {
              count: modelPredicted.length,
              items: modelPredicted.map(m => ({
                class: m.class,
                confidence: m.confidence,
                bbox: m.bounding_box,
                detection_id: m.detection_id
              }))
            },
            finalAccepted: finalAccepted.map(f => ({
              class: f.class,
              confidence: f.confidence,
              bbox: f.bounding_box,
              note: f.note || undefined,
              annotationType: f.annotationType || undefined,
              createdBy: f.createdBy || undefined,
              createdAt: f.createdAt || undefined
            })),
            annotatorMetadata: {
              total: finalAccepted.length,
              annotators
            }
          });
        } catch (e) {
          // Gracefully skip problematic ids
          results.push({ imageId: String(id), modelPredicted: { count: 0, items: [] }, finalAccepted: [], annotatorMetadata: { total: 0, annotators: [] } });
        }
      }

      // 3) Save as JSON array
      const filename = `annotations_all_${new Date().toISOString().slice(0,10)}.json`;
      const jsonStr = JSON.stringify(results, null, 2);
      // @ts-ignore
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        await writable.write(blob);
        await writable.close();
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      toast({ title: "Exported", description: `Saved ${results.length} inspections` });
    } catch (e: any) {
      console.error('Export JSON failed:', e);
      toast({ title: "Export failed", description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout title="Settings">
      <div className="p-6 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-muted-foreground">Name</span>
              <span className="col-span-2">{user?.name || "-"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-muted-foreground">Username</span>
              <span className="col-span-2">{user?.username || "-"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="col-span-2">{user?.email || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Annotations (JSON)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export edited/manual annotations for all inspections as a structured JSON file containing exactly:
              <br />
              <span className="font-medium">Image ID</span>, <span className="font-medium">Model-predicted anomalies</span>,
              <span className="font-medium"> Final accepted annotations</span>, and <span className="font-medium">Annotator metadata</span>.
            </p>
            <div>
              <Button onClick={handleExportJson} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export All as JSON'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This export excludes pure AI detections from the “Final accepted annotations” list and summarizes annotators
              who contributed edits or manual contours. One JSON file is generated with an array entry per inspection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Re-train the model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a flat dataset under <code>backend/Transformer anomaly/Anomly Detection/data/new annotations</code>
              with two subfolders <code>images/</code> and <code>labels/</code>.
            </p>
            <div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setExporting(true);
                    const res = await fetch(`${API_BASE}/api/retrain/export-dataset`, { method: 'POST' });
                    const data = await res.json();
                    if (res.ok && data?.ok) {
                      toast({
                        title: 'Dataset exported',
                        description: `Images: ${data.imagesCopied}, Labels: ${data.labelsWritten}`
                      });
                    } else {
                      throw new Error(data?.error || `HTTP ${res.status}`);
                    }
                  } catch (e: any) {
                    toast({ title: 'Export failed', description: e?.message || 'Unknown error', variant: 'destructive' });
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : 'Re-train the model'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Output folders: <code>Transformer anomaly/Anomly Detection/data/new annotations/images</code> and
              <code> Transformer anomaly/Anomly Detection/data/new annotations/labels</code> (flat; no nested directories).
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
