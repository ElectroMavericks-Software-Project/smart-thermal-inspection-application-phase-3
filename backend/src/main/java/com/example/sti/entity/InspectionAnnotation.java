package com.example.sti.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "inspection_annotations")
public class InspectionAnnotation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id", nullable = false)
    @JsonIgnore
    private Inspection inspection;

    @Column(name = "annotation_data", columnDefinition = "jsonb", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> annotationData;

    @Column(name = "annotation_type", length = 50, nullable = false)
    private String annotationType = "Detected by AI";

    @Column(name = "class_name", length = 100)
    private String className;

    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "bounding_box", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> boundingBox;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
        
        // Extract key fields from annotation data for indexing
        if (annotationData != null) {
            className = (String) annotationData.get("class");
            Object confObj = annotationData.get("confidence");
            if (confObj instanceof Number) {
                confidence = BigDecimal.valueOf(((Number) confObj).doubleValue());
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> bbox = (Map<String, Object>) annotationData.get("bounding_box");
            boundingBox = bbox;
            
            // Extract annotation type if present
            String type = (String) annotationData.get("annotationType");
            if (type != null) {
                annotationType = type;
            }
        }
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = Instant.now();
        
        // Re-extract fields in case annotation data was updated
        if (annotationData != null) {
            className = (String) annotationData.get("class");
            Object confObj = annotationData.get("confidence");
            if (confObj instanceof Number) {
                confidence = BigDecimal.valueOf(((Number) confObj).doubleValue());
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> bbox = (Map<String, Object>) annotationData.get("bounding_box");
            boundingBox = bbox;
            
            String type = (String) annotationData.get("annotationType");
            if (type != null) {
                annotationType = type;
            }
        }
    }

    // Getters and setters
    public Long getId() { return id; }

    public Inspection getInspection() { return inspection; }
    public void setInspection(Inspection inspection) { this.inspection = inspection; }

    public Map<String, Object> getAnnotationData() { return annotationData; }
    public void setAnnotationData(Map<String, Object> annotationData) { this.annotationData = annotationData; }

    public String getAnnotationType() { return annotationType; }
    public void setAnnotationType(String annotationType) { this.annotationType = annotationType; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }

    public Map<String, Object> getBoundingBox() { return boundingBox; }
    public void setBoundingBox(Map<String, Object> boundingBox) { this.boundingBox = boundingBox; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}