// src/main/java/com/example/sti/controller/MediaUploadController.java
package com.example.sti.controller;

import com.example.sti.repo.InspectionRepository;
import com.example.sti.entity.InspectionStatus;
// import org.apache.commons.io.FilenameUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
// import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.*;
import java.time.Instant;
import java.util.Map;
import java.util.Set;



@RestController
@RequestMapping("/api")
@CrossOrigin // adjust origins if needed
public class MediaUploadController {

    private static final Path MEDIA_ROOT = Path.of("media").toAbsolutePath().normalize();
    private static final Set<String> ALLOWED_EXTS = Set.of("jpg", "jpeg", "png", "webp");

    private final InspectionRepository inspectionRepository;

    public MediaUploadController(InspectionRepository inspectionRepository) {
        this.inspectionRepository = inspectionRepository;
    }

    /**
     * Route expected by your current frontend:
     * POST /api/upload-thermal-image?transformer_id={no}&inspection_no={id}
     * Body: multipart/form-data with "file"
     */
    @PostMapping(
        value = "/upload-thermal-image",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<?> uploadThermalImageQueryParams(
            @RequestParam("transformer_id") String transformerNo,
            @RequestParam("inspection_no") String inspectionId,
            @RequestParam(value = "uploaderName", required = false) String uploaderName,
            @RequestParam(value = "weatherCondition", required = false) String weatherCondition,
            @RequestPart("file") MultipartFile file) {
        return handleUpload(transformerNo, inspectionId, uploaderName, weatherCondition, file);
    }

    /**
     * Alternative RESTful route (kept for flexibility):
     * POST /api/transformers/{no}/inspections/{inspectionId}/upload-current
     */
    @PostMapping(
        value = "/transformers/{no}/inspections/{inspectionId}/upload-current",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<?> uploadThermalImagePathParams(
            @PathVariable("no") String transformerNo,
            @PathVariable("inspectionId") String inspectionId,
            @RequestParam(value = "uploaderName", required = false) String uploaderName,
            @RequestParam(value = "weatherCondition", required = false) String weatherCondition,
            @RequestPart("file") MultipartFile file) {
        return handleUpload(transformerNo, inspectionId, uploaderName, weatherCondition, file);
    }

    /**
     * Shared upload logic.
     */
    private ResponseEntity<?> handleUpload(String transformerNo, String inspectionId, String uploaderName, String weatherCondition, MultipartFile file) {
        try {
            if (!StringUtils.hasText(transformerNo) || !StringUtils.hasText(inspectionId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing transformer or inspection id"));
            }
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "file is required"));
            }

            // Derive extension from filename or content-type
            String ext = safeExt(file);
            if (!ALLOWED_EXTS.contains(ext.toLowerCase())) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Unsupported file type",
                    "allowed", ALLOWED_EXTS
                ));
            }

            // Ensure directory exists: media/inspections/{transformerNo}
            Path dir = MEDIA_ROOT.resolve(Path.of("inspections", safeName(transformerNo))).normalize();
            Files.createDirectories(dir);

            // Save as media/inspections/{transformerNo}/{inspectionId}.{ext}
            String fname = safeName(inspectionId) + "." + ext;
            Path target = dir.resolve(fname).normalize();

            // Overwrite if exists
            Files.write(target, file.getBytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            // Create relative path for database storage
            String relativePath = "media/inspections/" + safeName(transformerNo) + "/" + fname;

            // Update inspection record with all new fields
            try {
                Long inspectionIdLong = Long.parseLong(inspectionId);
                inspectionRepository.findById(inspectionIdLong).ifPresent(inspection -> {
                    // Set thermal uploader name
                    if (StringUtils.hasText(uploaderName)) {
                        inspection.setThermalUploaderName(uploaderName);
                    }
                    
                    // Set weather condition
                    if (StringUtils.hasText(weatherCondition)) {
                        inspection.setWeatherCondition(weatherCondition);
                    }
                    
                    // Set thermal image path
                    inspection.setThermalImagePath(relativePath);
                    
                    // Update status to COMPLETED when thermal image is uploaded
                    inspection.setStatus(InspectionStatus.COMPLETED);
                    
                    // Set maintenance date to current timestamp (when thermal image was uploaded)
                    inspection.setMaintenanceAt(Instant.now());
                    
                    inspectionRepository.save(inspection);
                });
            } catch (NumberFormatException e) {
                // Log but don't fail the upload if inspection ID parsing fails
                System.err.println("Could not parse inspection ID for inspection update: " + inspectionId);
            }

            String publicUrl = "/media/inspections/" + safeName(transformerNo) + "/" + fname;
            Instant uploadTimestamp = Instant.now();

            return ResponseEntity.ok(Map.of(
                "ok", true,
                "currentImage", publicUrl,
                "currentTimestamp", uploadTimestamp.toString(),
                "uploaderName", uploaderName != null ? uploaderName : "unknown",
                "weatherCondition", weatherCondition != null ? weatherCondition : "unknown",
                "thermalImagePath", relativePath,
                "status", "COMPLETED",
                "maintenanceDate", uploadTimestamp.toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "Upload failed",
                "details", e.getMessage()
            ));
        }
    }

    /**
     * Pick a safe extension using filename first, then content-type.
     */
    private String safeExt(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name != null && name.contains(".")) {
            return name.substring(name.lastIndexOf('.') + 1).toLowerCase();
        }
        return "jpg"; // default
    }


    /**
     * Basic filename safety: keep letters, digits, dash, underscore.
     */
    private String safeName(String s) {
        return s.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
