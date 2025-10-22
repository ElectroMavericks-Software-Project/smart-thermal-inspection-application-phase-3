package com.example.sti.repo;

import com.example.sti.entity.Transformer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TransformerRepository extends JpaRepository<Transformer, Long> {
    Optional<Transformer> findByTransformerNo(String transformerNo);
}
