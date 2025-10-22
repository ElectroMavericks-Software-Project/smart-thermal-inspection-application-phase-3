package com.example.sti.controller;

import com.example.sti.dto.TransformerReq;
import com.example.sti.entity.Transformer;
import com.example.sti.repo.TransformerRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/transformers")
public class TransformerController {

    private final TransformerRepository repo;

    public TransformerController(TransformerRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Transformer> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Transformer> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-no/{no}")
    public ResponseEntity<Transformer> getByNo(@PathVariable String no) {
        return repo.findByTransformerNo(no).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TransformerReq req) {
        if (repo.findByTransformerNo(req.getTransformerNo()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "TransformerNo already exists"));
        }
        Transformer t = new Transformer();
        t.setTransformerNo(req.getTransformerNo());
        t.setPoleNo(req.getPoleNo());
        t.setRegion(req.getRegion());
        t.setType(req.getType());
        t.setCapacity(req.getCapacity());
        t.setStarred(Boolean.TRUE.equals(req.getStarred()));
        t.setLocationDetails(req.getLocationDetails()); // NEW
        Transformer saved = repo.save(t);
        return ResponseEntity.created(URI.create("/api/transformers/" + saved.getId())).body(saved);
    }

    // Update by transformerNo shown in UI
    @PutMapping("/{no}")
    public ResponseEntity<?> update(@PathVariable String no, @RequestBody Map<String, Object> body) {
        Transformer t = repo.findByTransformerNo(no).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();

        if (body.containsKey("transformerNo")) {
            String newNo = Objects.toString(body.get("transformerNo"), "").trim();
            if (!newNo.isBlank()) t.setTransformerNo(newNo);
        }
        if (body.containsKey("poleNo")) t.setPoleNo(Objects.toString(body.get("poleNo"), null));
        if (body.containsKey("capacity")) t.setCapacity(Objects.toString(body.get("capacity"), null));
        if (body.containsKey("region")) t.setRegion(Objects.toString(body.get("region"), null));
        if (body.containsKey("type")) t.setType(Objects.toString(body.get("type"), null));
        if (body.containsKey("starred")) t.setStarred(Boolean.parseBoolean(String.valueOf(body.get("starred"))));
        if (body.containsKey("locationDetails")) t.setLocationDetails(Objects.toString(body.get("locationDetails"), null));

        return ResponseEntity.ok(repo.save(t));
    }

    @DeleteMapping("/{no}")
    public ResponseEntity<?> delete(@PathVariable String no) {
        return repo.findByTransformerNo(no).map(t -> {
            repo.delete(t);
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
