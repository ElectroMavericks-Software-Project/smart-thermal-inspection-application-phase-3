package com.example.sti.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "image_assets")
public class ImageAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id")
    @JsonIgnore
    private Inspection inspection;

    @Column(nullable = false)
    private String filename;

    @Column(nullable = false)
    private String path;          // absolute or project-relative path on disk

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt = Instant.now();

    @Column(name = "meta_json", columnDefinition = "TEXT")
    private String metaJson;      // optional exif/extra info

    // getters & setters
    public Long getId() { return id; }
    public Inspection getInspection() { return inspection; }
    public void setInspection(Inspection inspection) { this.inspection = inspection; }
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public Instant getCapturedAt() { return capturedAt; }
    public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }
    public String getMetaJson() { return metaJson; }
    public void setMetaJson(String metaJson) { this.metaJson = metaJson; }
}
