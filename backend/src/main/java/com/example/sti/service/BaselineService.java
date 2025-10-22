package com.example.sti.service;

import com.example.sti.entity.Transformer;
import com.example.sti.repo.TransformerRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.*;
import java.util.Locale;
import java.util.Optional;

@Service
public class BaselineService {

    private final TransformerRepository transformers;

    /**
     * Root folder to serve at /media/**
     * Final file path: <mediaBase>/baseline/<TransformerNo>.<ext>
     * Example: media/baseline/AZ-9990.jpg
     */
    @Value("${storage.local.media-base:media}")
    private String mediaBase;

    public BaselineService(TransformerRepository transformers) {
        this.transformers = transformers;
    }

    /**
     * Save a baseline image as <mediaBase>/baseline/<TransformerNo>.<ext>
     * - Creates directories if missing
     * - Determines extension from filename or MIME (defaults to "bin")
     * - If a Transformer row exists, stores the relative path into its baselinePath (if that field exists)
     * Returns the absolute Path of the saved file.
     */
    public Path saveBaseline(String transformerNo, MultipartFile file) throws Exception {
        return saveBaseline(transformerNo, file, "admin"); // Default uploader
    }

    /**
     * Save a baseline image with custom uploader name
     */
    public Path saveBaseline(String transformerNo, MultipartFile file, String uploaderName) throws Exception {
        if (transformerNo == null || transformerNo.isBlank()) {
            throw new IllegalArgumentException("transformerNo is required");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file is required");
        }

        // Look up transformer if present (DO NOT fail if not found)
        Optional<Transformer> maybe = transformers.findByTransformerNo(transformerNo);
        System.out.println("DEBUG: Looking for transformer: " + transformerNo);
        System.out.println("DEBUG: Transformer found: " + maybe.isPresent());

        // Build destination path
        Path base = Paths.get(mediaBase).toAbsolutePath();   // <project>/media
        Path dir  = base.resolve("baseline");                // <project>/media/baseline
        Files.createDirectories(dir);

        String ext = extensionFromFilename(file.getOriginalFilename())
                .or(() -> extensionFromMime(file.getContentType()))
                .orElse("bin");

        String safeNo = transformerNo;
        // remove everything after ","
        int commaIndex = safeNo.indexOf(',');
        if (commaIndex != -1) {
            safeNo = safeNo.substring(0, commaIndex);
        }
        Path dest = dir.resolve(safeNo + "." + ext);         // media/baseline/<no>.<ext>

        // Write (overwrite if exists)
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }

        // If we have a DB row AND the entity has baselinePath, store relative path there
        if (maybe.isPresent()) {
            String rel = "baseline/" + safeNo + "." + ext;   // relative path under /media/**
            Transformer t = maybe.get();
            
            System.out.println("DEBUG: Updating transformer metadata:");
            System.out.println("DEBUG: - baseline_path: " + rel);
            System.out.println("DEBUG: - baseline_uploader_name: " + uploaderName);
            
            // Set baseline path and metadata
            t.setBaselineImagePath(rel);
            t.setBaselineUploadedAt(java.time.Instant.now());
            t.setUploaderName(uploaderName != null && !uploaderName.isBlank() ? uploaderName : "admin");
            
            Transformer saved = transformers.save(t);
            System.out.println("DEBUG: Saved transformer with baseline_image_path: " + saved.getBaselineImagePath());
        } else {
            System.out.println("DEBUG: Transformer not found in database, skipping metadata update");
        }

        return dest; // controller can turn this into "/media/" + relativeFromMediaRoot(dest)
    }

    /** Convert an absolute path under <mediaBase> to a relative like "baseline/<file>" for use with /media/** */
    public String relativeFromMediaRoot(Path absolute) {
        Path base = Paths.get(mediaBase).toAbsolutePath();
        return base.relativize(absolute).toString().replace('\\', '/');
    }

    private static Optional<String> extensionFromFilename(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        String base = Paths.get(name).getFileName().toString();
        int dot = base.lastIndexOf('.');
        if (dot <= 0 || dot == base.length() - 1) return Optional.empty();
        return Optional.of(base.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    private static Optional<String> extensionFromMime(String mime) {
        if (mime == null || mime.isBlank()) return Optional.empty();
        return switch (mime.toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg", "image/pjpeg" -> Optional.of("jpg");
            case "image/png" -> Optional.of("png");
            case "image/webp" -> Optional.of("webp");
            case "image/gif" -> Optional.of("gif");
            case "image/bmp" -> Optional.of("bmp");
            case "image/tiff", "image/tif" -> Optional.of("tiff");
            case "image/heic" -> Optional.of("heic");
            case "image/heif" -> Optional.of("heif");
            default -> Optional.empty();
        };
    }

    public java.util.Optional<java.nio.file.Path> findBaselineFile(String transformerNo) {
        if (transformerNo == null || transformerNo.isBlank()) return java.util.Optional.empty();

        // Same normalization you used when saving: cut at the first comma
        String no = transformerNo;
        int comma = no.indexOf(',');
        if (comma != -1) no = no.substring(0, comma);

        java.nio.file.Path base = java.nio.file.Paths.get(mediaBase).toAbsolutePath();
        java.nio.file.Path baselineDir = base.resolve("baseline");

        // 1) If the DB has baselinePath, prefer that
        try {
            var maybe = transformers.findByTransformerNo(no);
            if (maybe.isPresent()) {
                var t = maybe.get();
                try {
                    // try getter first
                    String rel = null;
                    try {
                        var getter = t.getClass().getMethod("getBaselineImagePath");
                        Object val = getter.invoke(t);
                        if (val instanceof String s && !s.isBlank()) rel = s;
                    } catch (NoSuchMethodException ignored) {
                        var f = t.getClass().getDeclaredField("baselineImagePath");
                        f.setAccessible(true);
                        Object val = f.get(t);
                        if (val instanceof String s && !s.isBlank()) rel = s;
                    }
                    if (rel != null) {
                        var p = base.resolve(rel).normalize();
                        if (java.nio.file.Files.exists(p)) return java.util.Optional.of(p);
                    }
                } catch (ReflectiveOperationException ignored) {
                    // entity doesn't have baselineImagePath -> fall through
                }
            }
        } catch (Exception ignored) { }

        // 2) Otherwise, probe common image extensions for <no>.<ext>
        String[] exts = {"jpg","jpeg","png","webp","gif","bmp","tiff","tif","heic","heif"};
        for (String ext : exts) {
            var p = baselineDir.resolve(no + "." + ext);
            if (java.nio.file.Files.exists(p)) return java.util.Optional.of(p);
        }

        return java.util.Optional.empty();
    }

}
