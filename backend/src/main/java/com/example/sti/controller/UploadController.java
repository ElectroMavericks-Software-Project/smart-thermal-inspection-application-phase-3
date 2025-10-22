package com.example.sti.controller;

import com.example.sti.entity.ImageAsset;
// import com.example.sti.entity.Inspection;
import com.example.sti.repo.ImageAssetRepository;
import com.example.sti.repo.InspectionRepository;
import com.example.sti.service.StorageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api")
public class UploadController {

    private final StorageService storageService;
    private final ImageAssetRepository images;
    private final InspectionRepository inspections;

    public UploadController(StorageService storageService, ImageAssetRepository images, InspectionRepository inspections) {
        this.storageService = storageService;
        this.images = images;
        this.inspections = inspections;
    }

    @PostMapping(value = "/inspections/{inspectionId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImageAsset upload(@PathVariable Long inspectionId, @RequestPart("file") MultipartFile file) throws IOException {
        return storageService.storeInspectionImage(inspectionId, file);
    }

    @GetMapping("/inspections/{inspectionId}/images")
    public ResponseEntity<List<ImageAsset>> list(@PathVariable Long inspectionId) {
        return inspections.findById(inspectionId)
                .map(ins -> ResponseEntity.ok(images.findByInspectionOrderByCapturedAtDesc(ins)))
                .orElse(ResponseEntity.notFound().build());
    }
}
