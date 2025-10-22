package com.example.sti.repo;

import com.example.sti.entity.ImageAsset;
import com.example.sti.entity.Inspection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImageAssetRepository extends JpaRepository<ImageAsset, Long> {
    List<ImageAsset> findByInspectionOrderByCapturedAtDesc(Inspection inspection);
}
