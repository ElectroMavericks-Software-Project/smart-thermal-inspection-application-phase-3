package com.example.sti.service;

import com.example.sti.entity.Inspection;
import com.example.sti.entity.Transformer;
import com.example.sti.repo.InspectionRepository;
import com.example.sti.repo.TransformerRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TransformerDataService {

    private final TransformerRepository transformers;
    private final InspectionRepository inspections;

    public TransformerDataService(TransformerRepository transformers,
                                  InspectionRepository inspections) {
        this.transformers = transformers;
        this.inspections = inspections;
    }

    /**
     * Build the data blob used by the "View Transformer" page.
     * - Looks up transformer by transformerNo OR numeric id.
     * - Returns { transformer: {...}, inspections: [...] }
     * - Each inspection now includes "maintenanceDate".
     */
    public Map<String, Object> getTransformerData(String idOrNo) {
        Transformer t = transformers.findByTransformerNo(idOrNo)
                .or(() -> parseLong(idOrNo).flatMap(transformers::findById))
                .orElseThrow(() -> new RuntimeException("Transformer not found"));

        // newest first (repo method must exist)
        List<Inspection> list = inspections.findByTransformerOrderByInspectedAtDesc(t);

        // Map inspections → UI shape
        List<Map<String, Object>> mapped = list.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("inspectedDate", i.getInspectedAt() == null ? null : i.getInspectedAt().toString());
            // NEW: include maintenanceDate (ISO string or "-" if null to match UI fallback)
            m.put("maintenanceDate", i.getMaintenanceAt() == null ? "-" : i.getMaintenanceAt().toString());
            m.put("status", i.getStatus() == null ? null : i.getStatus().name());
            m.put("starred", i.isStarred());
            m.put("notes", i.getNotes() == null ? "" : i.getNotes());
            return m;
        }).toList();

        // Optional baseline URL the UI can render directly
        String baselineUrl = t.getBaselineImagePath() == null ? null : "/media/" + t.getBaselineImagePath();

        // For convenience, expose the latest inspectedAt (if any)
        String lastInspectedAt = (!list.isEmpty() && list.get(0).getInspectedAt() != null)
                ? list.get(0).getInspectedAt().toString()
                : null;

        Map<String, Object> transformer = new LinkedHashMap<>();
        transformer.put("transformerNo", t.getTransformerNo());
        transformer.put("poleNo", t.getPoleNo());
        transformer.put("region", t.getRegion());
        transformer.put("type", t.getType());
        transformer.put("capacity", t.getCapacity());
        transformer.put("starred", t.isStarred());
        transformer.put("createdAt", t.getCreatedAt() == null ? null : t.getCreatedAt().toString());
        transformer.put("baselineUrl", baselineUrl);
        transformer.put("lastInspectedAt", lastInspectedAt);

        return Map.of("transformer", transformer, "inspections", mapped);
    }

    private Optional<Long> parseLong(String s) {
        try {
            return Optional.of(Long.parseLong(s));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
