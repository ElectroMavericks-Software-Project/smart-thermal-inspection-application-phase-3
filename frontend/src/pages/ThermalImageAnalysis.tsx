import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ZoomIn, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";

const ThermalImageAnalysis = () => {
  const { id, inspectionId } = useParams();
  const navigate = useNavigate();
  const [annotationTools, setAnnotationTools] = useState(true);

  return (
    <Layout title="Transformer">
      <div className="p-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-4 gap-2" 
          onClick={() => navigate(`/transformer/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transformer
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-4">
            <Badge variant="secondary" className="gap-2">
              <span className="h-2 w-2 rounded-full bg-primary"></span>
              {inspectionId}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: Mon(21), May, 2023 12:55pm
            </span>
            <Badge variant="outline" className="gap-2">
              <span className="h-2 w-2 rounded-full bg-success"></span>
              Inspection in progress
            </Badge>
          </div>
          
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Transformer No</div>
              <div className="font-medium">AZ-8370</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Pole No</div>
              <div className="font-medium">EN-122-A</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Branch</div>
              <div className="font-medium">Nugegoda</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Inspected By</div>
              <div className="font-medium">A-110</div>
            </div>
          </div>
        </div>

        {/* Analysis Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Thermal Image Comparison</CardTitle>
              <Button variant="outline" size="icon">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Baseline Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Baseline</Badge>
                  </div>
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/80 via-primary/70 to-primary/80 rounded-lg relative overflow-hidden">
                    {/* Thermal image placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/30 to-cyan-400/40"></div>
                    <div className="absolute bottom-4 left-4 text-white text-xs">1/6/2025 9:10:08 PM</div>
                  </div>
                </div>

                {/* Current Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Current</Badge>
                  </div>
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/80 via-primary/70 to-primary/80 rounded-lg relative overflow-hidden">
                    {/* Thermal image placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/30 to-cyan-400/40"></div>
                    <div className="absolute bottom-4 left-4 text-white text-xs">5/7/2025 8:34:21 PM</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="annotation-tools" className="text-sm font-medium">
                    Annotation Tools
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable tools to mark and annotate thermal anomalies
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Switch 
                    id="annotation-tools"
                    checked={annotationTools}
                    onCheckedChange={setAnnotationTools}
                  />
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm font-medium">Analysis Pending</span>
                </div>
                <div className="text-2xl font-bold text-gray-500">--</div>
                <div className="text-xs text-muted-foreground">Run AI analysis to detect issues</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm font-medium">Analysis Pending</span>
                </div>
                <div className="text-2xl font-bold text-gray-500">--</div>
                <div className="text-xs text-muted-foreground">Upload thermal images first</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm font-medium">Analysis Pending</span>
                </div>
                <div className="text-2xl font-bold text-gray-500">--</div>
                <div className="text-xs text-muted-foreground">Comparison will be generated</div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" />
                Analysis Summary & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-600 mb-2">No Analysis Available</h4>
                <p className="text-sm text-muted-foreground">
                  Upload thermal images and run AI analysis to generate recommendations and detect potential issues.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Next Steps:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Upload baseline thermal image</li>
                  <li>• Upload current thermal image</li>
                  <li>• Run AI analysis to detect anomalies</li>
                  <li>• Review generated recommendations</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" disabled>Generate Maintenance Report</Button>
                <Button variant="outline" disabled>Schedule Maintenance</Button>
                <Button variant="outline" disabled>Export Analysis</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ThermalImageAnalysis;