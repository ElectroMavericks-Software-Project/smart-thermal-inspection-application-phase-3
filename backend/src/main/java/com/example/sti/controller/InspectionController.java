package com.example.sti.controller;

import com.example.sti.dto.InspectionReq;
import com.example.sti.entity.Inspection;
import com.example.sti.entity.InspectionStatus;
import com.example.sti.entity.Transformer;
import com.example.sti.repo.InspectionRepository;
import com.example.sti.repo.ImageAssetRepository;
import com.example.sti.repo.InspectionAnnotationRepository;
import com.example.sti.repo.TransformerRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
// import java.nio.file.Path;

@RestController
@RequestMapping("/api")
public class InspectionController {

    private static final java.nio.file.Path MEDIA_ROOT = java.nio.file.Path.of("media").toAbsolutePath().normalize();

    private final TransformerRepository transformers;
    private final InspectionRepository inspections;
    private final ImageAssetRepository imageAssets;
    private final InspectionAnnotationRepository annotations;

    public InspectionController(TransformerRepository transformers,
                                InspectionRepository inspections,
                                ImageAssetRepository imageAssets,
                                InspectionAnnotationRepository annotations) {
        this.transformers = transformers;
        this.inspections = inspections;
        this.imageAssets = imageAssets;
        this.annotations = annotations;
    }

    /** Create a new inspection for a transformer (by transformerNo). */
    @PostMapping("/transformers/{no}/inspections")
    public ResponseEntity<?> create(@PathVariable String no,
                                    @Valid @RequestBody InspectionReq req) {

        Transformer t = transformers.findByTransformerNo(no).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();

        Inspection i = new Inspection();
        i.setTransformer(t);

        // inspectedAt: use provided or now()
        i.setInspectedAt(req.inspectedAt != null ? req.inspectedAt : Instant.now());

        // NEW: maintenance date
        i.setMaintenanceAt(req.maintenanceDate);

        // status: default IN_PROGRESS if not provided
        i.setStatus(req.status != null ? req.status : InspectionStatus.IN_PROGRESS);

        i.setNotes(req.notes);
        i.setStarred(Boolean.TRUE.equals(req.starred));

        Inspection saved = inspections.save(i);
        return ResponseEntity.ok(saved);
    }

    /** List inspections for a transformer (newest first). */
    @GetMapping("/transformers/{no}/inspections")
    public ResponseEntity<?> list(@PathVariable String no) {
        Transformer t = transformers.findByTransformerNo(no).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();

        List<Inspection> list = inspections.findByTransformerOrderByInspectedAtDesc(t);
        return ResponseEntity.ok(list);
    }

    /** Get single inspection by id. */
    @GetMapping("/inspections/{id}")
    public ResponseEntity<?> getOne(@PathVariable Long id) {
        return inspections.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Partial update (PATCH) of an inspection. */
    @PatchMapping("/inspections/{id}")
    public ResponseEntity<?> patch(@PathVariable Long id,
                                   @RequestBody Map<String, Object> body) {
        Inspection i = inspections.findById(id).orElse(null);
        if (i == null) return ResponseEntity.notFound().build();

        // status (case-insensitive)
        if (body.containsKey("status")) {
            InspectionStatus st = parseStatus(body.get("status"));
            if (st != null) i.setStatus(st);
        }

        if (body.containsKey("notes")) {
            i.setNotes(Objects.toString(body.get("notes"), null));
        }

        if (body.containsKey("starred")) {
            i.setStarred(Boolean.parseBoolean(String.valueOf(body.get("starred"))));
        }

        if (body.containsKey("inspectedAt")) {
            Instant ts = parseInstant(body.get("inspectedAt"));
            if (ts != null) i.setInspectedAt(ts);
        }

        // NEW: maintenanceDate (ISO-8601 string or null to clear)
        if (body.containsKey("maintenanceDate")) {
            Object v = body.get("maintenanceDate");
            if (v == null || String.valueOf(v).isBlank()) {
                i.setMaintenanceAt(null);
            } else {
                Instant ts = parseInstant(v);
                if (ts != null) i.setMaintenanceAt(ts);
            }
        }

        return ResponseEntity.ok(inspections.save(i));
    }

    /** Delete an inspection with all related data and files. */
    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/inspections/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Inspection inspection = inspections.findById(id).orElse(null);
        if (inspection == null) return ResponseEntity.notFound().build();

        // 1) Delete thermal image file if present
        try {
            String pathStr = inspection.getThermalImagePath();
            if (pathStr != null && !pathStr.isBlank()) {
                java.nio.file.Path absolute = resolveMediaAbsolute(pathStr);
                if (java.nio.file.Files.exists(absolute)) {
                    java.nio.file.Files.delete(absolute);
                }
                // try to delete parent dir if empty
                cleanupEmptyParent(absolute);
            }
        } catch (Exception e) {
            System.err.println("Warning: failed to delete thermal image for inspection " + id + ": " + e.getMessage());
        }

        // 2) Delete image assets (and their physical files)
        try {
            java.util.List<com.example.sti.entity.ImageAsset> assets = imageAssets.findByInspectionOrderByCapturedAtDesc(inspection);
            for (com.example.sti.entity.ImageAsset a : assets) {
                try {
                    String p = a.getPath();
                    if (p != null && !p.isBlank()) {
                        java.nio.file.Path ap = java.nio.file.Paths.get(p);
                        if (java.nio.file.Files.exists(ap)) {
                            java.nio.file.Files.delete(ap);
                        }
                        cleanupEmptyParent(ap);
                    }
                } catch (Exception ignoreFile) { /* ignore file errors */ }
            }
            // Remove DB rows
            imageAssets.deleteAll(assets);
        } catch (Exception e) {
            System.err.println("Warning: failed to delete image assets for inspection " + id + ": " + e.getMessage());
        }

        // 3) Delete annotations for this inspection
        try {
            annotations.deleteByInspectionId(id);
        } catch (Exception e) {
            System.err.println("Warning: failed to delete annotations for inspection " + id + ": " + e.getMessage());
        }

        // 4) Finally delete inspection row
        inspections.delete(inspection);
        return ResponseEntity.noContent().build();
    }

    /** Delete thermal image for an inspection. Also clears related annotations. */
    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/inspections/{id}/thermal-image")
    public ResponseEntity<?> deleteThermalImage(@PathVariable Long id) {
        Inspection inspection = inspections.findById(id).orElse(null);
        if (inspection == null) return ResponseEntity.notFound().build();
        
        // Only allow thermal image deletion for completed inspections
        if (inspection.getStatus() != InspectionStatus.COMPLETED) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Thermal image can only be deleted for completed inspections"));
        }
        
        // Get the thermal image path before clearing it
        String thermalImagePath = inspection.getThermalImagePath();
        
        // Delete the physical file if it exists
        if (thermalImagePath != null && !thermalImagePath.trim().isEmpty()) {
            try {
                java.nio.file.Path absoluteFilePath = resolveMediaAbsolute(thermalImagePath);
                
                System.out.println("Attempting to delete thermal image from: " + absoluteFilePath.toString());
                
                if (java.nio.file.Files.exists(absoluteFilePath)) {
                    java.nio.file.Files.delete(absoluteFilePath);
                    System.out.println("Successfully deleted thermal image file: " + absoluteFilePath.toString());
                    cleanupEmptyParent(absoluteFilePath);
                } else {
                    System.out.println("Thermal image file not found at: " + absoluteFilePath.toString());
                    
                    // Debug: List the parent directory contents to help troubleshooting
                    java.nio.file.Path parentDir = absoluteFilePath.getParent();
                    if (parentDir != null && java.nio.file.Files.exists(parentDir)) {
                        System.out.println("Parent directory exists. Contents:");
                        try (var stream = java.nio.file.Files.list(parentDir)) {
                            stream.forEach(path -> System.out.println("  - " + path.getFileName()));
                        }
                    } else {
                        System.out.println("Parent directory does not exist: " + parentDir);
                    }
                }
            } catch (Exception e) {
                System.err.println("Failed to delete thermal image file: " + thermalImagePath + " - " + e.getMessage());
                e.printStackTrace();
                // Continue with database update even if file deletion fails
            }
        }
        
        // Clear the thermal image path
        inspection.setThermalImagePath(null);
        
        // Update the status back to IN_PROGRESS since thermal image is removed
        inspection.setStatus(InspectionStatus.IN_PROGRESS);
        
        // Remove the maintenance date since inspection is back to in-progress
        inspection.setMaintenanceAt(null);
        
        // 4) Clear all annotations for this inspection since the source image is gone
        try { annotations.deleteByInspectionId(id); } catch (Exception ignore) {}

        inspections.save(inspection);
        
        return ResponseEntity.ok(Map.of(
            "message", "Thermal image and related annotations deleted. Status updated to IN_PROGRESS and maintenance date removed.",
            "inspectionId", id,
            "newStatus", "IN_PROGRESS"
        ));
    }

    // -------- helpers --------

    private static Instant parseInstant(Object v) {
        try {
            if (v == null) return null;
            String s = String.valueOf(v).trim();
            if (s.isEmpty()) return null;
            return Instant.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static InspectionStatus parseStatus(Object v) {
        if (v == null) return null;
        try {
            return InspectionStatus.valueOf(String.valueOf(v).trim().toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    // --- path helpers ---
    private static java.nio.file.Path resolveMediaAbsolute(String thermalImagePath) {
        if (thermalImagePath == null) return null;
        java.nio.file.Path absoluteFilePath;
        if (thermalImagePath.startsWith("media/")) {
            String relativePart = thermalImagePath.substring(6); // Remove "media/" prefix
            absoluteFilePath = MEDIA_ROOT.resolve(relativePart).normalize();
        } else {
            absoluteFilePath = MEDIA_ROOT.resolve(thermalImagePath).normalize();
        }
        return absoluteFilePath;
    }

    private static void cleanupEmptyParent(java.nio.file.Path file) {
        try {
            if (file == null) return;
            java.nio.file.Path dir = file.getParent();
            if (dir != null && java.nio.file.Files.isDirectory(dir)) {
                try (java.util.stream.Stream<java.nio.file.Path> s = java.nio.file.Files.list(dir)) {
                    if (s.findAny().isEmpty()) {
                        java.nio.file.Files.delete(dir);
                    }
                }
            }
        } catch (Exception ignore) { /* ignore cleanup issues */ }
    }
}
