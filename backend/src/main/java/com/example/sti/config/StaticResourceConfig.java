// src/main/java/com/example/sti/config/StaticResourceConfig.java
package com.example.sti.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.lang.NonNull;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        // Points /media/** URLs to the local ./media directory
        Path mediaDir = Paths.get("media").toAbsolutePath().normalize();
        registry.addResourceHandler("/media/**")
                .addResourceLocations("file:" + mediaDir.toString() + "/");
    }
}

