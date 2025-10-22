package com.example.sti.controller;

import com.example.sti.service.BaselineService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BaselineUploadController {

    private final BaselineService baseline;

    public BaselineUploadController(BaselineService baseline) {
        this.baseline = baseline;
    }

    // POST /api/upload_baseline_transformer?transformerNo=AZ-9990
    // form-data: file=<image> [, transformerNo, kind=BASELINE, uploaderName=<username>]
    @PostMapping(value = "/upload_baseline_transformer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadBaseline(
            @RequestParam(name = "transformerNo", required = false) String transformerNoQuery,
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "transformerNo", required = false) String transformerNoForm,
            @RequestParam(name = "kind", required = false) String kindIgnored,
            @RequestParam(name = "uploaderName", required = false) String uploaderName
    ) {
        try {
            String transformerNo = (transformerNoQuery != null && !transformerNoQuery.isBlank())
                    ? transformerNoQuery : transformerNoForm;

            System.out.println("DEBUG: Upload request - TransformerNo: " + transformerNoQuery + "," + transformerNoForm + ", UploaderName: " + uploaderName + ", FileType: " + file.getContentType());

            if (transformerNo == null || transformerNo.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "transformerNo is required"));
            }
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "file is required"));
            }

            // Use provided uploader name or default to "admin"
            String finalUploaderName = (uploaderName != null && !uploaderName.isBlank()) ? uploaderName : "admin";
            
            Path savedAbs = baseline.saveBaseline(transformerNo, file, finalUploaderName);
            String savedRel = baseline.relativeFromMediaRoot(savedAbs);

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "transformerNo", transformerNo,
                    "savedPath", savedRel,                // e.g. baseline/AZ-9990.jpg
                    "baselineUrl", "/media/" + savedRel,  // for the UI preview
                    "uploaderName", finalUploaderName
            ));
        } catch (IllegalArgumentException bad) {
            return ResponseEntity.status(404).body(Map.of("ok", false, "error", bad.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "ok", false, "error", ex.getClass().getSimpleName() + ": " + ex.getMessage()));
        }
    }

    @GetMapping("/see_transformer_baseline")
    public ResponseEntity<?> seeBaseline(
            @RequestParam(value = "transformer_no", required = false) String transformerNoSnake,
            @RequestParam(value = "transformerNo", required = false) String transformerNoCamel) {
        try {
            String transformerNo = (transformerNoSnake != null && !transformerNoSnake.isBlank())
                    ? transformerNoSnake : transformerNoCamel;
            if (transformerNo == null || transformerNo.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "transformer number is required"));
            }
            return baseline.findBaselineFile(transformerNo)
                    .map(path -> {
                        // Guess content type
                        String mime = "application/octet-stream";
                        try {
                            String p = Files.probeContentType(path);
                            if (p != null) mime = p;
                        } catch (Exception ignore) {
                            // fallback by extension
                            String name = path.getFileName().toString().toLowerCase();
                            if (name.endsWith(".png"))  mime = "image/png";
                            else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
                            else if (name.endsWith(".webp")) mime = "image/webp";
                            else if (name.endsWith(".gif"))  mime = "image/gif";
                            else if (name.endsWith(".bmp"))  mime = "image/bmp";
                            else if (name.endsWith(".tif") || name.endsWith(".tiff")) mime = "image/tiff";
                            else if (name.endsWith(".heic")) mime = "image/heic";
                            else if (name.endsWith(".heif")) mime = "image/heif";
                        }

                        return ResponseEntity
                                .ok()
                                .header("Cache-Control", "no-cache")
                                .contentType(org.springframework.http.MediaType.parseMediaType(mime))
                                .body(new org.springframework.core.io.FileSystemResource(path));
                    })
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("ok", false, "error", ex.getMessage()));
        }
    }
}
