package com.example.sti.controller;

import com.example.sti.entity.Transformer;
import com.example.sti.repo.TransformerRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.Map;
// import java.util.Optional;

@RestController
@RequestMapping("/api")
public class AddTransformerController {

    private final TransformerRepository repo;

    public AddTransformerController(TransformerRepository repo) {
        this.repo = repo;
    }

    /**
     * Accepts the JSON used by your UI to create a transformer.
     * It supports either a POJO DTO with getters (getTransformerNo…)
     * or a Java record (transformerNo(), …). We read values via reflection
     * so you don’t get “field not visible” compile errors.
     *
     * POST /api/add_transformer
     */
    @PostMapping("/add_transformer")
    public ResponseEntity<?> add(@Valid @RequestBody Object req) {
        String transformerNo = firstString(req, "transformerNo");
        if (transformerNo == null || transformerNo.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "transformerNo is required"));
        }
        if (repo.findByTransformerNo(transformerNo).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "TransformerNo already exists"));
        }

        Transformer t = new Transformer();
        t.setTransformerNo(transformerNo);
        t.setPoleNo(firstString(req, "poleNo"));
        t.setRegion(firstString(req, "region"));
        t.setType(firstString(req, "type"));
        t.setCapacity(firstString(req, "capacity"));
        t.setStarred(Boolean.TRUE.equals(firstBoolean(req, "starred")));

        // Optional field: locationDetails (if your entity has it)
        String locationDetails = firstString(req, "locationDetails");
        if (locationDetails != null) {
            setIfPresent(t, "locationDetails", locationDetails);
        }

        Transformer saved = repo.save(t);
        return ResponseEntity.created(URI.create("/api/transformers/" + saved.getId())).body(saved);
    }

    /* ----------------- helpers (reflection-safe) ----------------- */

    private static String firstString(Object bean, String base) {
        Object v = call(bean, base);               // record accessor: base()
        if (v == null) v = call(bean, "get" + cap(base)); // POJO getter: getBase()
        if (v == null) v = readField(bean, base);  // public field fallback
        return (v instanceof String s) ? s : null;
    }

    private static Boolean firstBoolean(Object bean, String base) {
        Object v = call(bean, base);
        if (v == null) v = call(bean, "get" + cap(base));
        if (v == null) v = call(bean, "is" + cap(base));
        if (v == null) v = readField(bean, base);
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return Boolean.parseBoolean(s);
        return null;
    }

    private static Object call(Object bean, String method) {
        try {
            Method m = bean.getClass().getMethod(method);
            m.setAccessible(true);
            return m.invoke(bean);
        } catch (Exception ignore) { return null; }
    }

    private static Object readField(Object bean, String name) {
        try {
            Field f = bean.getClass().getDeclaredField(name);
            f.setAccessible(true);
            return f.get(bean);
        } catch (Exception ignore) { return null; }
    }

    private static String cap(String s) {
        return (s == null || s.isEmpty()) ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** set field if it exists (no hard dependency on a setter/getter) */
    private static void setIfPresent(Object bean, String field, Object value) {
        // try setter first
        try {
            Method m = bean.getClass().getMethod("set" + cap(field), value.getClass());
            m.setAccessible(true);
            m.invoke(bean, value);
            return;
        } catch (Exception ignore) { /* try field */ }

        try {
            Field f = bean.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(bean, value);
        } catch (Exception ignore) { /* field absent; safe to skip */ }
    }
}
