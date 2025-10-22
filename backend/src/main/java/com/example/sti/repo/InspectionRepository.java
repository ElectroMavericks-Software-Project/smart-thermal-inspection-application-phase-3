package com.example.sti.repo;

import com.example.sti.entity.Inspection;
import com.example.sti.entity.Transformer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InspectionRepository extends JpaRepository<Inspection, Long> {
    List<Inspection> findByTransformerOrderByInspectedAtDesc(Transformer transformer);

    
    
}
