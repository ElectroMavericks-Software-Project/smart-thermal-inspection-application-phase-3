package com.example.sti.service;

import com.example.sti.entity.ImageAsset;
import com.example.sti.entity.Inspection;
import com.example.sti.repo.ImageAssetRepository;
import com.example.sti.repo.InspectionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;

@Service
public class StorageService {

    private final ImageAssetRepository images;
    private final InspectionRepository inspections;

    @Value("${storage.local.base-path:storage}")
    private String baseDirProp;

    public StorageService(ImageAssetRepository images, InspectionRepository inspections) {
        this.images = images;
        this.inspections = inspections;
    }

    public ImageAsset storeInspectionImage(Long inspectionId, MultipartFile file) throws IOException {
        Inspection ins = inspections.findById(inspectionId)
                .orElseThrow(() -> new IllegalArgumentException("Inspection not found: " + inspectionId));

        // Use an ABSOLUTE base path to avoid Tomcat temp resolution issues
        Path baseRoot = Paths.get(baseDirProp).toAbsolutePath();
        Path dir = baseRoot.resolve(Paths.get("inspections", String.valueOf(inspectionId)));
        Files.createDirectories(dir);

        String original = file.getOriginalFilename();              // may be null
        String safeName = sanitizeFilename(original);

        Path dest = dir.resolve(safeName);

        // Use NIO copy (not MultipartFile#transferTo) to avoid servlet-relative behavior
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }

        ImageAsset asset = new ImageAsset();
        asset.setInspection(ins);
        asset.setFilename(safeName);
        asset.setPath(dest.toString());      // absolute path saved
        asset.setCapturedAt(Instant.now());
        return images.save(asset);
    }

    /** Safe filename: last path segment only, control chars removed, whitelist [a-zA-Z0-9._-] */
    private static String sanitizeFilename(String name) {
        String base = (name == null || name.isBlank()) ? "image.bin" : name;
        // keep only the last path segment (prevents ".." or "C:\...")
        base = Paths.get(base).getFileName().toString();
        // replace path separators / control chars
        base = base.replace('\\', '_').replace('/', '_')
                   .replaceAll("[\\p{Cntrl}]", "_");
        // whitelist allowed chars
        String safe = base.replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.isBlank() ? "image.bin" : safe;
    }
}
