package com.example.sti.controller;

import com.example.sti.entity.Transformer;
import com.example.sti.repo.TransformerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class TransformerBaselineController {

    private final TransformerRepository transformerRepository;

    public TransformerBaselineController(TransformerRepository transformerRepository) {
        this.transformerRepository = transformerRepository;
    }

    /**
     * Get baseline image information for a transformer
     * Expected by frontend: GET /api/transformers/{id}/baseline
     */
    @GetMapping("/transformers/{id}/baseline")
    public ResponseEntity<?> getTransformerBaseline(@PathVariable("id") String transformerId) {
        try {
            // Try to find by transformer number first, then by ID
            Transformer transformer = transformerRepository.findByTransformerNo(transformerId)
                .or(() -> {
                    try {
                        Long id = Long.parseLong(transformerId);
                        return transformerRepository.findById(id);
                    } catch (NumberFormatException e) {
                        return java.util.Optional.empty();
                    }
                })
                .orElse(null);

            if (transformer == null) {
                return ResponseEntity.notFound().build();
            }

            // Check if transformer has baseline image
            String baselineImagePath = transformer.getBaselineImagePath();
            if (baselineImagePath == null || baselineImagePath.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            // Normalize to public URL under /media/** regardless of DB value
            String p = baselineImagePath;
            if (p.startsWith("/")) p = p.substring(1);
            String publicUrl = p.startsWith("media/") ? "/" + p : "/media/" + p;

            Map<String, Object> response = Map.of(
                "url", publicUrl,
                "uploadedAt", transformer.getBaselineUploadedAt() != null ?
                    transformer.getBaselineUploadedAt().toString() : null,
                "uploaderName", transformer.getUploaderName() != null ?
                    transformer.getUploaderName() : "unknown"
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "Failed to get baseline image",
                "details", e.getMessage()
            ));
        }
    }
}
