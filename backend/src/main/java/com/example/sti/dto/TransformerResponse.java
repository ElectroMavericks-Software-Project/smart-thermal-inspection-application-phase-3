// dto/TransformerResponse.java
package com.example.sti.dto;

// Simple response DTO; nulls are allowed
public record TransformerResponse(
        Long id,
        String transformerNo,
        String poleNo,
        String region,
        String type,
        String capacity,
        boolean starred
) {}
