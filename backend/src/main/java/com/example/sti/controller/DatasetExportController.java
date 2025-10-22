package com.example.sti.controller;

import com.example.sti.entity.Inspection;
import com.example.sti.entity.InspectionAnnotation;
import com.example.sti.repo.InspectionAnnotationRepository;
import com.example.sti.repo.InspectionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Exports a flat dataset suitable for re-training: images + YOLO-like labels.
 * - Creates/uses folder: ./Transformer anomaly/new annotations/{images,labels}
 * - Copies all inspection thermal images into images/ as <inspectionId>.<ext>
 * - Writes labels/<inspectionId>.txt with one line per annotation (Manual/Edited):
 *   <class_id> <cx> <cy> <w> <h>  (all normalized 0..1)
 */
@RestController
@RequestMapping("/api")
public class DatasetExportController {

    private final InspectionRepository inspections;
    private final InspectionAnnotationRepository annotations;

    public DatasetExportController(InspectionRepository inspections,
                                   InspectionAnnotationRepository annotations) {
        this.inspections = inspections;
        this.annotations = annotations;
    }

    @PostMapping("/retrain/export-dataset")
    public ResponseEntity<?> exportDataset() {
        try {
            Path projectRoot = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
            Path exportRoot = projectRoot.resolve(Paths.get("Transformer anomaly", "Anomly Detection", "data", "new annotations"));
            Path imagesDir = exportRoot.resolve("images");
            Path labelsDir = exportRoot.resolve("labels");

            Files.createDirectories(imagesDir);
            Files.createDirectories(labelsDir);

            // Ensure no nested directories remain (only files are expected inside images/ and labels/)
            cleanupNested(imagesDir);
            cleanupNested(labelsDir);

            List<Inspection> all = inspections.findAll();
            int imageCopied = 0;
            int labelWritten = 0;
            List<Map<String, Object>> perItem = new ArrayList<>();

            for (Inspection i : all) {
                String thermalPath = i.getThermalImagePath();
                if (thermalPath == null || thermalPath.isBlank()) continue;

                // Resolve absolute source image
                Path src = resolveMedia(projectRoot, thermalPath);
                if (src == null || !Files.exists(src)) {
                    continue;
                }

                String ext = extOf(src.getFileName().toString()).orElse("jpg");
                String baseName = String.valueOf(i.getId());
                Path targetImage = imagesDir.resolve(baseName + "." + ext);

                try {
                    Files.copy(src, targetImage, StandardCopyOption.REPLACE_EXISTING);
                    imageCopied++;
                } catch (IOException copyErr) {
                    // skip label for this one if image copy failed
                    continue;
                }

                // Load image dimensions for normalization
                int imgW, imgH;
                try {
                    BufferedImage bi = ImageIO.read(src.toFile());
                    if (bi == null) throw new IOException("Unsupported image format");
                    imgW = bi.getWidth();
                    imgH = bi.getHeight();
                } catch (Exception e) {
                    // if we can't read dims, skip labels for this image
                    perItem.add(Map.of(
                            "inspectionId", i.getId(),
                            "status", "image-read-failed"
                    ));
                    continue;
                }

                // Fetch annotations and filter final accepted (manual/edited)
                List<InspectionAnnotation> anns = annotations.findByInspectionIdOrderByCreatedAtDesc(i.getId());
                List<InspectionAnnotation> finals = anns.stream()
                        .filter(a -> {
                            String t = Optional.ofNullable(a.getAnnotationType()).orElse("").toLowerCase(Locale.ROOT);
                            return t.equals("manual") || t.equals("edited");
                        })
                        .collect(Collectors.toList());

                // Build label file lines (class_id x1 y1 x2 y2 x3 y3 x4 y4) normalized
                List<String> lines = new ArrayList<>();
                for (InspectionAnnotation a : finals) {
                    Map<?, ?> box = a.getBoundingBox();
                    if (box == null) continue;
                    Object cxO = box.get("x");
                    Object cyO = box.get("y");
                    Object wO = box.get("width");
                    Object hO = box.get("height");
                    if (!(cxO instanceof Number) || !(cyO instanceof Number) || !(wO instanceof Number) || !(hO instanceof Number)) {
                        continue;
                    }

                    // Normalize center and size
                    double cx = ((Number) cxO).doubleValue() / imgW;
                    double cy = ((Number) cyO).doubleValue() / imgH;
                    double ww = ((Number) wO).doubleValue() / imgW;
                    double hh = ((Number) hO).doubleValue() / imgH;

                    // Derive 4 corners in normalized space (axis-aligned rectangle)
                    double x1 = clamp01(cx - ww / 2.0);
                    double y1 = clamp01(cy - hh / 2.0);
                    double x2 = clamp01(cx + ww / 2.0);
                    double y2 = clamp01(cy - hh / 2.0);
                    double x3 = clamp01(cx + ww / 2.0);
                    double y3 = clamp01(cy + hh / 2.0);
                    double x4 = clamp01(cx - ww / 2.0);
                    double y4 = clamp01(cy + hh / 2.0);

                    String clazz = Optional.ofNullable(a.getClassName()).orElse("");
                    Integer classId = classIdOf(clazz);
                    if (classId == null) {
                        // skip unknown classes
                        continue;
                    }
                    String line = String.format(Locale.US,
                            "%d %.10f %.10f %.10f %.10f %.10f %.10f %.10f %.10f",
                            classId, x1, y1, x2, y2, x3, y3, x4, y4);
                    lines.add(line);
                }

                Path labelPath = labelsDir.resolve(baseName + ".txt");
                try {
                    Files.write(labelPath, lines, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    labelWritten++;
                } catch (IOException e) {
                    perItem.add(Map.of(
                            "inspectionId", i.getId(),
                            "status", "label-write-failed",
                            "error", e.getMessage()
                    ));
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("ok", true);
            result.put("exportRoot", exportRoot.toString());
            result.put("imagesDir", imagesDir.toString());
            result.put("labelsDir", labelsDir.toString());
            result.put("imagesCopied", imageCopied);
            result.put("labelsWritten", labelWritten);
            result.put("items", perItem);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "ok", false,
                    "error", e.getMessage()
            ));
        }
    }

    private static double clamp01(double v) {
        if (v < 0.0) return 0.0;
        if (v > 1.0) return 1.0;
        return v;
    }

    private static void cleanupNested(Path dir) {
        try {
            if (!Files.exists(dir)) return;
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir)) {
                for (Path p : ds) {
                    if (Files.isDirectory(p)) {
                        // remove nested directories entirely
                        deleteRecursively(p);
                    }
                }
            }
        } catch (Exception ignore) {}
    }

    private static void deleteRecursively(Path p) throws IOException {
        if (Files.isDirectory(p)) {
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(p)) {
                for (Path child : ds) deleteRecursively(child);
            }
        }
        Files.deleteIfExists(p);
    }

    private static Optional<String> extOf(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot <= 0 || dot == filename.length() - 1) return Optional.empty();
        return Optional.of(filename.substring(dot + 1));
    }

    private static Path resolveMedia(Path projectRoot, String thermalPath) {
        try {
            // thermalPath may be like "media/inspections/NO/ID.png" or "inspections/NO/ID.png"
            Path p = Paths.get(thermalPath).normalize();
            if (p.isAbsolute()) return p;
            if (thermalPath.startsWith("media/")) {
                return projectRoot.resolve(p).normalize();
            } else {
                return projectRoot.resolve(Paths.get("media").resolve(p)).normalize();
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer classIdOf(String className) {
        // Map project class names to fixed ids [0..4]
        // 0:'full_wire_yellow', 1:'loose_joint_red', 2:'loose_joint_yellow', 3:'point_overload_red', 4:'point_overload_yellow'
        if (className == null) return null;
        String c = className.trim().toLowerCase(Locale.ROOT);
        switch (c) {
            case "full_wire_yellow": return 0;
            case "loose_joint_red": return 1;
            case "loose_joint_yellow": return 2;
            case "point_overload_red": return 3;
            case "point_overload_yellow": return 4;
            default: return null; // skip unknowns
        }
    }
}
