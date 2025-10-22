package com.example.sti.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
// import java.time.Instant;

@Entity
@Table(name = "inspections")
public class Inspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK -> transformers.id (NOT NULL)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transformer_id", nullable = false)
    @JsonIgnore
    private Transformer transformer;

    @Column(name = "inspected_at", nullable = false)
    private Instant inspectedAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 255)
    private InspectionStatus status = InspectionStatus.IN_PROGRESS;

    @Column(name = "notes", length = 2000)
    private String notes;

    @Column(name = "starred", nullable = false)
    private boolean starred = false;

    private Instant maintenanceAt;

    @Column(name = "thermal_uploader_name", length = 255)
    private String thermalUploaderName;

    @Column(name = "weather_condition", length = 50)
    private String weatherCondition;

    @Column(name = "thermal_image_path", length = 500)
    private String thermalImagePath;

    // getters/setters
    public Instant getMaintenanceAt() { return maintenanceAt; }
    public void setMaintenanceAt(Instant maintenanceAt) { this.maintenanceAt = maintenanceAt; }

    // --- getters & setters ---

    public Long getId() { return id; }

    public Transformer getTransformer() { return transformer; }
    public void setTransformer(Transformer transformer) { this.transformer = transformer; }

    public Instant getInspectedAt() { return inspectedAt; }
    public void setInspectedAt(Instant inspectedAt) { this.inspectedAt = inspectedAt; }

    public InspectionStatus getStatus() { return status; }
    public void setStatus(InspectionStatus status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public boolean isStarred() { return starred; }
    public void setStarred(boolean starred) { this.starred = starred; }

    public String getThermalUploaderName() { return thermalUploaderName; }
    public void setThermalUploaderName(String thermalUploaderName) { this.thermalUploaderName = thermalUploaderName; }

    public String getWeatherCondition() { return weatherCondition; }
    public void setWeatherCondition(String weatherCondition) { this.weatherCondition = weatherCondition; }

    public String getThermalImagePath() { return thermalImagePath; }
    public void setThermalImagePath(String thermalImagePath) { this.thermalImagePath = thermalImagePath; }
}
