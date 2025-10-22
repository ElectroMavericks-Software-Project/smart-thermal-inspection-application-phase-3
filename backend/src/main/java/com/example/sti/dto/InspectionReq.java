package com.example.sti.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import com.example.sti.entity.InspectionStatus;

public class InspectionReq {
    // Optional: when not provided, backend sets now()
    public Instant inspectedAt;

    // NEW
    public Instant maintenanceDate;  // JSON: "maintenanceDate"

    @NotNull
    public InspectionStatus status;

    public String notes;
    public Boolean starred;
}
