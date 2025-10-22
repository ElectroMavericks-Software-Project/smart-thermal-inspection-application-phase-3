package com.example.sti.repo;

import com.example.sti.entity.Inspection;
import com.example.sti.entity.InspectionAnnotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InspectionAnnotationRepository extends JpaRepository<InspectionAnnotation, Long> {
    
    /**
     * Find all annotations for a specific inspection, ordered by creation time
     */
    List<InspectionAnnotation> findByInspectionOrderByCreatedAtDesc(Inspection inspection);
    
    /**
     * Find all annotations for a specific inspection by ID
     */
    @Query("SELECT a FROM InspectionAnnotation a WHERE a.inspection.id = :inspectionId ORDER BY a.createdAt DESC")
    List<InspectionAnnotation> findByInspectionIdOrderByCreatedAtDesc(@Param("inspectionId") Long inspectionId);
    
    /**
     * Find annotations by type for a specific inspection
     */
    @Query("SELECT a FROM InspectionAnnotation a WHERE a.inspection.id = :inspectionId AND a.annotationType = :type ORDER BY a.createdAt DESC")
    List<InspectionAnnotation> findByInspectionIdAndAnnotationType(@Param("inspectionId") Long inspectionId, @Param("type") String annotationType);
    
    /**
     * Find annotations by class name for a specific inspection
     */
    @Query("SELECT a FROM InspectionAnnotation a WHERE a.inspection.id = :inspectionId AND a.className = :className ORDER BY a.createdAt DESC")
    List<InspectionAnnotation> findByInspectionIdAndClassName(@Param("inspectionId") Long inspectionId, @Param("className") String className);
    
    /**
     * Count annotations by type for a specific inspection
     */
    @Query("SELECT COUNT(a) FROM InspectionAnnotation a WHERE a.inspection.id = :inspectionId AND a.annotationType = :type")
    long countByInspectionIdAndAnnotationType(@Param("inspectionId") Long inspectionId, @Param("type") String annotationType);
    
    /**
     * Delete all annotations for a specific inspection (used when replacing all annotations)
     */
    void deleteByInspection(Inspection inspection);
    
    /**
     * Delete all annotations for a specific inspection by ID
     */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM InspectionAnnotation a WHERE a.inspection.id = :inspectionId")
    void deleteByInspectionId(@Param("inspectionId") Long inspectionId);
}
