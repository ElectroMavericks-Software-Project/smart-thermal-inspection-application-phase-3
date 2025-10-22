package com.example.sti.controller;

import com.example.sti.entity.Inspection;
import com.example.sti.entity.InspectionAnnotation;
import com.example.sti.repo.InspectionRepository;
import com.example.sti.repo.InspectionAnnotationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.io.*;

@RestController
@RequestMapping("/api")
public class AiAnalysisController {

    @Autowired
    private InspectionRepository inspectionRepository;
    
    @Autowired
    private InspectionAnnotationRepository annotationRepository;

    @PostMapping("/test-python-model")
    public ResponseEntity<Map<String, Object>> testPythonModel() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Test Python model with backend test image
            String testImagePath = "test_image.png";
            List<Map<String, Object>> detections = callPythonModel(testImagePath);
            
            response.put("success", true);
            response.put("message", "Python model test completed");
            response.put("detections", detections);
            response.put("detectionCount", detections.size());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("detections", new ArrayList<>());
        }
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/analyze-thermal-image")
    public ResponseEntity<Map<String, Object>> analyzeThermalImage(
            @RequestParam("thermalImage") MultipartFile imageFile,
            @RequestParam("transformerId") String transformerId,
            @RequestParam("inspectionId") String inspectionId) {
        
        System.out.println("Starting AI analysis for transformer: " + transformerId + ", inspection: " + inspectionId);
        System.out.println("Image file: " + imageFile.getOriginalFilename() + " (" + imageFile.getSize() + " bytes)");
        
        List<Map<String, Object>> detections;
        
        try {
            // Process image with Python model (primary and only method)
            detections = processImageWithPythonModel(imageFile, transformerId);
            
            if (detections.isEmpty()) {
                System.out.println("Python model returned no detections - this is a valid result");
            } else {
                System.out.println("Successfully processed image with " + detections.size() + " detections");
            }
        } catch (Exception error) {
            System.err.println("Python model failed: " + error.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "AI analysis failed: " + error.getMessage());
            errorResponse.put("detections", new ArrayList<>());
            return ResponseEntity.status(500).body(errorResponse);
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("detections", detections);
        response.put("transformerId", transformerId);
        response.put("inspectionId", inspectionId);
        response.put("analysisTimestamp", new Date().getTime());
        response.put("imageFileName", imageFile.getOriginalFilename());
        
        System.out.println("AI analysis completed successfully with " + detections.size() + " detections");
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/save-annotations")
    @Transactional
    public ResponseEntity<Map<String, Object>> saveAnnotations(@RequestBody Map<String, Object> request) {
        System.out.println("Received annotation save request: " + request);
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            String transformerId = (String) request.get("transformerId");
            String inspectionIdStr = (String) request.get("inspectionId");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> annotations = (List<Map<String, Object>>) request.get("annotations");
            String timestamp = (String) request.get("timestamp");
            
            System.out.println("Saving annotations for transformer: " + transformerId + 
                              ", inspection: " + inspectionIdStr + 
                              ", count: " + annotations.size());
            
            // Find the inspection
            Long inspectionId;
            try {
                inspectionId = Long.parseLong(inspectionIdStr);
            } catch (NumberFormatException e) {
                response.put("success", false);
                response.put("error", "Invalid inspection ID format");
                return ResponseEntity.badRequest().body(response);
            }
            
            Optional<Inspection> inspectionOpt = inspectionRepository.findById(inspectionId);
            if (!inspectionOpt.isPresent()) {
                response.put("success", false);
                response.put("error", "Inspection not found with ID: " + inspectionId);
                return ResponseEntity.notFound().build();
            }
            
            Inspection inspection = inspectionOpt.get();
            
            // Clear existing annotations for this inspection (replace all)
            annotationRepository.deleteByInspectionId(inspectionId);
            System.out.println("Cleared existing annotations for inspection: " + inspectionId);
            
            // Save each annotation
            List<InspectionAnnotation> savedAnnotations = new ArrayList<>();
            for (int i = 0; i < annotations.size(); i++) {
                Map<String, Object> annotationData = annotations.get(i);
                String annotationType = (String) annotationData.getOrDefault("annotationType", "Detected by AI");
                String className = (String) annotationData.get("class");
                String note = (String) annotationData.get("note");
                
                System.out.println("Saving annotation " + (i+1) + ": " + className + " (" + annotationType + ")");
                
                // Create new annotation entity
                InspectionAnnotation annotation = new InspectionAnnotation();
                annotation.setInspection(inspection);
                annotation.setAnnotationData(annotationData);
                annotation.setAnnotationType(annotationType);

                // Determine creator: prefer per-annotation payload, fallback to a sensible default
                String createdBy = null;
                try {
                    Object cb = annotationData.get("createdBy");
                    if (cb != null) createdBy = String.valueOf(cb);
                } catch (Exception ignore) { /* ignore */ }
                if (createdBy == null || createdBy.trim().isEmpty()) {
                    createdBy = "system";
                }
                annotation.setCreatedBy(createdBy);

                if (note != null && !note.trim().isEmpty()) {
                    annotation.setNotes(note);
                }
                
                savedAnnotations.add(annotationRepository.save(annotation));
            }
            
            System.out.println("Successfully saved " + savedAnnotations.size() + " annotations to database");
            
            response.put("success", true);
            response.put("message", "Annotations saved successfully to database");
            response.put("annotationCount", savedAnnotations.size());
            response.put("timestamp", timestamp);
            response.put("inspectionId", inspectionId);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("Error saving annotations: " + e.getMessage());
            e.printStackTrace();
            
            response.put("success", false);
            response.put("error", "Failed to save annotations: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
    
    @GetMapping("/get-annotations/{inspectionId}")
    public ResponseEntity<Map<String, Object>> getAnnotations(@PathVariable Long inspectionId) {
        System.out.println("Retrieving annotations for inspection: " + inspectionId);
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find the inspection
            Optional<Inspection> inspectionOpt = inspectionRepository.findById(inspectionId);
            if (!inspectionOpt.isPresent()) {
                response.put("success", false);
                response.put("error", "Inspection not found with ID: " + inspectionId);
                return ResponseEntity.notFound().build();
            }
            
            // Get all annotations for this inspection
            List<InspectionAnnotation> annotations = annotationRepository.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
            
            // Convert to the format expected by the frontend
            List<Map<String, Object>> annotationData = new ArrayList<>();
            for (InspectionAnnotation annotation : annotations) {
                annotationData.add(annotation.getAnnotationData());
            }
            
            // Count by type for statistics
            long aiDetected = annotationRepository.countByInspectionIdAndAnnotationType(inspectionId, "Detected by AI");
            long edited = annotationRepository.countByInspectionIdAndAnnotationType(inspectionId, "Edited");
            long manual = annotationRepository.countByInspectionIdAndAnnotationType(inspectionId, "Manual");
            
            response.put("success", true);
            response.put("detections", annotationData);
            response.put("annotationCount", annotations.size());
            response.put("statistics", Map.of(
                "aiDetected", aiDetected,
                "edited", edited,
                "manual", manual
            ));
            response.put("inspectionId", inspectionId);
            
            System.out.println("Retrieved " + annotations.size() + " annotations for inspection " + inspectionId);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("Error retrieving annotations: " + e.getMessage());
            e.printStackTrace();
            
            response.put("success", false);
            response.put("error", "Failed to retrieve annotations: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
    
    private List<Map<String, Object>> processImageWithPythonModel(MultipartFile imageFile, String transformerId) {
        try {
            // Save uploaded file to temporary location
            String tempDir = System.getProperty("java.io.tmpdir");
            String fileName = "temp_" + System.currentTimeMillis() + "_" + imageFile.getOriginalFilename();
            File tempFile = new File(tempDir, fileName);
            imageFile.transferTo(tempFile);
            
            System.out.println("=== IMAGE PROCESSING DEBUG ===");
            System.out.println("Original filename: " + imageFile.getOriginalFilename());
            System.out.println("File size: " + imageFile.getSize() + " bytes");
            System.out.println("Temp file path: " + tempFile.getAbsolutePath());
            System.out.println("Temp file exists: " + tempFile.exists());
            System.out.println("Temp file size: " + tempFile.length() + " bytes");
            
            // Call Python model
            List<Map<String, Object>> detections = callPythonModel(tempFile.getAbsolutePath());
            
            System.out.println("Analysis completed with " + detections.size() + " detections");
            System.out.println("=== END IMAGE PROCESSING DEBUG ===");
            
            // Clean up temporary file
            boolean deleted = tempFile.delete();
            if (!deleted) {
                System.out.println("Warning: Could not delete temporary file: " + tempFile.getAbsolutePath());
            }
            
            return detections;
            
        } catch (Exception e) {
            System.err.println("Error processing image with Python model: " + e.getMessage());
            e.printStackTrace();
            // Return empty list if model fails
            return new ArrayList<>();
        }
    }
    
    private List<Map<String, Object>> callPythonModel(String imagePath) {
        try {
            // Build command to execute Python script
            String projectRoot = System.getProperty("user.dir");
            String pythonScript = projectRoot + "\\Transformer anomaly\\model_api.py";
            
            System.out.println("=== PYTHON MODEL DEBUG ===");
            System.out.println("Calling Python model with image: " + imagePath);
            System.out.println("Python script path: " + pythonScript);
            System.out.println("Current working directory: " + projectRoot);
            
            // Check if the Python script exists
            File scriptFile = new File(pythonScript);
            if (!scriptFile.exists()) {
                System.err.println("Python script not found at: " + pythonScript);
                throw new RuntimeException("Python script not found");
            }
            
            // Check if image exists
            File imageFile = new File(imagePath);
            if (!imageFile.exists()) {
                System.err.println("Image file not found at: " + imagePath);
                // Try relative path from backend directory
                String relativePath = projectRoot + "\\" + imagePath;
                imageFile = new File(relativePath);
                if (imageFile.exists()) {
                    imagePath = relativePath;
                    System.out.println("Found image at relative path: " + imagePath);
                } else {
                    System.err.println("Image not found at relative path either: " + relativePath);
                    throw new RuntimeException("Image file not found");
                }
            }
            
            ProcessBuilder pb = new ProcessBuilder("python", pythonScript, imagePath);
            pb.directory(new File(projectRoot));
            
            System.out.println("Executing command: python " + pythonScript + " " + imagePath);
            Process process = pb.start();
            
            // Read the output from Python script
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            // Read any errors
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
            StringBuilder errorOutput = new StringBuilder();
            while ((line = errorReader.readLine()) != null) {
                errorOutput.append(line).append("\n");
            }
            
            int exitCode = process.waitFor();
            
            if (exitCode != 0) {
                System.err.println("Python script failed with exit code: " + exitCode);
                System.err.println("Error output: " + errorOutput.toString());
                throw new RuntimeException("Python script execution failed");
            }
            
            // Extract JSON from Python output - filter out debug messages
            String fullOutput = output.toString().trim();
            System.out.println("Raw Python output: '" + fullOutput + "'");
            
            // Find the JSON array in the output (starts with '[' and ends with ']')
            String jsonResponse = extractJsonFromOutput(fullOutput);
            
            if (jsonResponse == null || jsonResponse.isEmpty() || jsonResponse.equals("[]")) {
                System.out.println("No valid JSON found in Python output");
                throw new RuntimeException("Python model returned no valid detections");
            }
            
            // Convert JSON string to List<Map<String, Object>>
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, Object>> detections = mapper.readValue(jsonResponse, 
                new TypeReference<List<Map<String, Object>>>() {});
            
            System.out.println("Python model returned " + detections.size() + " detections");
            System.out.println("=== END PYTHON MODEL DEBUG ===");
            return detections;
            
        } catch (Exception e) {
            System.err.println("Error calling Python model: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Python model execution failed: " + e.getMessage(), e);
        }
    }
    
    private String extractJsonFromOutput(String output) {
        // Find the first '[' and last ']' to extract the JSON array
        int jsonStart = output.indexOf('[');
        int jsonEnd = output.lastIndexOf(']');
        
        if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart) {
            String jsonPart = output.substring(jsonStart, jsonEnd + 1);
            System.out.println("Extracted JSON: " + jsonPart);
            return jsonPart;
        }
        
        System.err.println("Could not find valid JSON array in output");
        return null;
    }

}
