package com.example.sti.controller;

import com.example.sti.service.TransformerDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TransformerDataController {

    private final TransformerDataService dataService;

    public TransformerDataController(TransformerDataService dataService) {
        this.dataService = dataService;
    }

    // NOTE: make sure NO OTHER controller maps GET /api/get-transformer-data
    @GetMapping("/get-transformer-data")
    public ResponseEntity<?> getTransformerData(@RequestParam("id") String idOrNo) {
        try {
            return ResponseEntity.ok(dataService.getTransformerData(idOrNo));
        } catch (RuntimeException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
