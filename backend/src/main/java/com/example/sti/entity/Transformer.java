package com.example.sti.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
@Entity
@Table(name = "transformers")
public class Transformer {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transformer_no", unique = true, length = 255)
    private String transformerNo;

    @Column(name = "pole_no", length = 255)
    private String poleNo;

    @Column(length = 255)
    private String region;

    @Column(length = 255)
    private String type;

    @Column(length = 255)
    private String capacity;

    @Column(name = "baseline_image_path", length = 500)
    private String baselineImagePath;

    @Column(name = "baseline_uploaded_at")
    private Instant baselineUploadedAt;

    @Column(name = "uploader_name", length = 255)
    private String uploaderName;

    @Column(nullable = false)
    private boolean starred = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // NEW: store the free-text location details
    @Column(name = "location_details", length = 2000)
    private String locationDetails;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    @OneToMany(mappedBy = "transformer", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Inspection> inspections = new ArrayList<>();

    // --- getters / setters ---

    public Long getId() { return id; }

    public String getTransformerNo() { return transformerNo; }
    public void setTransformerNo(String transformerNo) { this.transformerNo = transformerNo; }

    public String getPoleNo() { return poleNo; }
    public void setPoleNo(String poleNo) { this.poleNo = poleNo; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCapacity() { return capacity; }
    public void setCapacity(String capacity) { this.capacity = capacity; }

    public String getBaselineImagePath() { return baselineImagePath; }
    public void setBaselineImagePath(String baselineImagePath) { this.baselineImagePath = baselineImagePath; }

    public Instant getBaselineUploadedAt() { return baselineUploadedAt; }
    public void setBaselineUploadedAt(Instant baselineUploadedAt) { this.baselineUploadedAt = baselineUploadedAt; }

    public String getUploaderName() { return uploaderName; }
    public void setUploaderName(String uploaderName) { this.uploaderName = uploaderName; }

    public boolean isStarred() { return starred; }
    public void setStarred(boolean starred) { this.starred = starred; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getLocationDetails() { return locationDetails; }
    public void setLocationDetails(String locationDetails) { this.locationDetails = locationDetails; }
}
