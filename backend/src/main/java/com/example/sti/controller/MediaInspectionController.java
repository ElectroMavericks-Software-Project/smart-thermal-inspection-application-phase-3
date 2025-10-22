// src/main/java/com/example/sti/controller/MediaInspectionController.java
package com.example.sti.controller;

import org.springframework.http.ResponseEntity;
// import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.nio.file.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class MediaInspectionController {

    private static final List<String> EXTS = List.of("jpg", "jpeg", "png", "webp");

    @GetMapping("/get-inspection")
    public ResponseEntity<?> getInspection(
            @RequestParam("inspectionId") String inspectionId,
            @RequestParam(value = "transformerNo") String transformerNo) {

        Map<String, Object> out = new HashMap<>();

        // Resolve baseline: media/baseline/{no}.{ext}
        Path baseline = resolveFirstExisting(Path.of("media", "baseline"), transformerNo, EXTS);
        out.put("baselineImage", baseline != null ? toPublicUrl(baseline) : null);
        out.put("baselineTimestamp", baseline != null ? lastModified(baseline) : null);

        // Resolve current: media/inspections/{no}/{inspectionId}.{ext}
        Path current = resolveFirstExisting(Path.of("media", "inspections", transformerNo), inspectionId, EXTS);
        out.put("currentImage", current != null ? toPublicUrl(current) : null);
        out.put("currentTimestamp", current != null ? lastModified(current) : null);

        // Optional extras for your UI
        out.put("inspectionNo", tryParseLong(inspectionId));
        // Align with upload flow which marks inspection COMPLETED upon thermal image upload
        out.put("status", current != null ? "COMPLETED" : "PENDING");

        return ResponseEntity.ok(out);
    }

    // Finds the first file matching {name}.{ext} under dir
    private Path resolveFirstExisting(Path dir, String name, List<String> exts) {
        try {
            for (String ext : exts) {
                Path p = dir.resolve(name + "." + ext).toAbsolutePath().normalize();
                if (Files.exists(p) && Files.isRegularFile(p)) return p;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String toPublicUrl(Path absolutePath) {
        // Convert absolute ".../media/..." back to "/media/..."
        String norm = absolutePath.toString().replace('\\', '/');
        int idx = norm.lastIndexOf("/media/");
        String tail = (idx >= 0) ? norm.substring(idx + "/media".length()) : null;
        if (tail == null) return null;
        return "/media" + tail;
    }

    private Instant lastModified(Path p) {
        try {
            return Files.getLastModifiedTime(p).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    private Long tryParseLong(String s) {
        try { return Long.parseLong(s); } catch (Exception e) { return null; }
    }
}
