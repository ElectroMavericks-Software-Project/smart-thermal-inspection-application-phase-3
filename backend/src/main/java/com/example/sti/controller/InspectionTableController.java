// src/main/java/com/example/sti/controller/InspectionTableController.java
package com.example.sti.controller;

import com.example.sti.dto.InspectionTableRow;
import com.example.sti.entity.Inspection;
import com.example.sti.entity.InspectionStatus;
import com.example.sti.repo.InspectionRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api")
public class InspectionTableController {

    private final InspectionRepository inspections;

    public InspectionTableController(InspectionRepository inspections) {
        this.inspections = inspections;
    }

    /** GET /api/get-inspection-table */
    @GetMapping("/get-inspection-table")
    public ResponseEntity<List<InspectionTableRow>> getInspectionTable(
            @RequestParam(value = "tz", required = false, defaultValue = "Asia/Colombo") String tz
    ) {
        // Fetch all inspections, newest first
        List<Inspection> all = inspections.findAll(Sort.by(Sort.Direction.DESC, "inspectedAt"));

        // Display format for dates
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM, yyyy HH:mm", Locale.ENGLISH)
                .withZone(ZoneId.of(tz));

        List<InspectionTableRow> rows = new ArrayList<>(all.size());
        for (Inspection i : all) {
            InspectionTableRow r = new InspectionTableRow();

            // Transformer number (may be null if not loaded/linked)
            r.transformerNo = (i.getTransformer() != null) ? i.getTransformer().getTransformerNo() : null;

            // 9-digit display id (use the entity primary key only)
            if (i.getId() != null) {
                r.inspectionNo = pad9(i.getId());
            } else {
                r.inspectionNo = null;
            }

            // Timestamps + formatted strings
            Instant inspected = i.getInspectedAt();
            r.inspectedAtIso = inspected != null ? inspected.toString() : null;
            r.inspectedDate  = inspected != null ? fmt.format(inspected) : "-";

            Instant maint = i.getMaintenanceAt();
            r.maintenanceAtIso = maint != null ? maint.toString() : null;
            r.maintenanceDate  = maint != null ? fmt.format(maint) : "-";

            // Status pretty text
            r.status = prettyStatusCompat(i.getStatus());

            // Starred flag (supports getStarred() or isStarred())
            r.starred = starredBool(i);

            rows.add(r);
        }

        return ResponseEntity.ok(rows);
    }

    // Left-pad with zeros to 9 characters. Accepts numeric or string.
    private String pad9(Object n) {
        if (n == null) return null;
        try {
            long v = (n instanceof Number) ? ((Number) n).longValue() : Long.parseLong(String.valueOf(n));
            return String.format("%09d", v);
        } catch (Exception e) {
            String s = String.valueOf(n);
            return s.length() >= 9 ? s : String.format("%9s", s).replace(' ', '0');
        }
    }

    // Java 8 compatible pretty status
    private String prettyStatusCompat(InspectionStatus st) {
        if (st == null) return "Pending";
        switch (st) {
            case IN_PROGRESS: return "In Progress";
            case COMPLETED:   return "Completed";
            case NEEDS_REVIEW:return "Needs Review";
            default:          return st.name();
        }
    }

    // Try getStarred() first, then isStarred(); fallback false
    private boolean starredBool(Inspection i) {
        try {
            Method m = i.getClass().getMethod("getStarred");
            Object v = m.invoke(i);
            return v instanceof Boolean && (Boolean) v;
        } catch (Exception ignore) {
            try {
                Method m = i.getClass().getMethod("isStarred");
                Object v = m.invoke(i);
                return v instanceof Boolean && (Boolean) v;
            } catch (Exception ignore2) {
                return false;
            }
        }
    }
}
