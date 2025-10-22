package com.example.sti.config;

import com.example.sti.entity.Transformer;
import com.example.sti.entity.Inspection;
import com.example.sti.repo.TransformerRepository;
import com.example.sti.repo.InspectionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@Profile("demo")
public class DemoDataInitializer implements CommandLineRunner {

    @Autowired
    private TransformerRepository transformerRepository;

    @Autowired
    private InspectionRepository inspectionRepository;

    @Override
    public void run(String... args) throws Exception {
        // Create demo transformers
        Transformer t1 = new Transformer();
        t1.setTransformerNo("AZ-0000");
        t1.setRegion("Main Campus");
        t1.setCapacity("500 kVA");
        t1.setType("ONAN");
        t1.setPoleNo("P001");
        t1.setLocationDetails("Main Campus Substation - Primary Distribution");
        t1.setBaselineImagePath("baseline/AZ-0000.png");
        t1.setBaselineUploadedAt(Instant.parse("2024-01-10T10:30:00Z"));
        t1.setUploaderName("Admin");
        transformerRepository.save(t1);

        Transformer t2 = new Transformer();
        t2.setTransformerNo("AZ-1123");
        t2.setRegion("Engineering Faculty");
        t2.setCapacity("750 kVA");
        t2.setType("ONAN");
        t2.setPoleNo("P002");
        t2.setLocationDetails("Engineering Faculty - Building A Electrical Room");
        t2.setBaselineImagePath("baseline/AZ-1123.jpg");
        t2.setBaselineUploadedAt(Instant.parse("2024-02-15T14:20:00Z"));
        t2.setUploaderName("Tech1");
        transformerRepository.save(t2);

        Transformer t3 = new Transformer();
        t3.setTransformerNo("AZ-3333");
        t3.setRegion("Science Faculty");
        t3.setCapacity("1000 kVA");
        t3.setType("ONAN");
        t3.setPoleNo("P003");
        t3.setLocationDetails("Science Faculty - Laboratory Power Distribution");
        t3.setBaselineImagePath("baseline/AZ-3333.jpg");
        t3.setBaselineUploadedAt(Instant.parse("2024-03-05T09:15:00Z"));
        t3.setUploaderName("Agent1");
        transformerRepository.save(t3);

        // Create demo inspections
        Inspection i1 = new Inspection();
        i1.setTransformer(t1);
        i1.setInspectedAt(Instant.parse("2024-08-15T10:30:00Z"));
        i1.setThermalUploaderName("Agent1"); // Hardcoded as requested
        i1.setWeatherCondition("Sunny");
        i1.setThermalImagePath("inspections/AZ-0000/75.png");
        i1.setNotes("Normal operation detected. All parameters within acceptable range.");
        i1.setStatus(com.example.sti.entity.InspectionStatus.COMPLETED);
        inspectionRepository.save(i1);

        Inspection i2 = new Inspection();
        i2.setTransformer(t1);
        i2.setInspectedAt(Instant.parse("2024-08-20T14:45:00Z"));
        i2.setThermalUploaderName("Agent1"); // Hardcoded as requested
        i2.setWeatherCondition("Cloudy");
        i2.setThermalImagePath("inspections/AZ-0000/79.png");
        i2.setNotes("Slight temperature increase observed. Monitoring required.");
        i2.setStatus(com.example.sti.entity.InspectionStatus.COMPLETED);
        inspectionRepository.save(i2);

        Inspection i3 = new Inspection();
        i3.setTransformer(t2);
        i3.setInspectedAt(Instant.parse("2024-08-25T09:15:00Z"));
        i3.setThermalUploaderName("Agent1"); // Hardcoded as requested
        i3.setWeatherCondition("Rainy");
        i3.setThermalImagePath("inspections/AZ-1123/90.jpg");
        i3.setNotes("High temperature reading. Immediate attention required.");
        i3.setStatus(com.example.sti.entity.InspectionStatus.COMPLETED);
        inspectionRepository.save(i3);

        System.out.println("✅ Demo data initialized successfully!");
        System.out.println("📋 Created " + transformerRepository.count() + " transformers");
        System.out.println("📋 Created " + inspectionRepository.count() + " inspections");
        System.out.println("🎯 All data features hardcoded values: Agent1, 5 freezers");
    }
}
