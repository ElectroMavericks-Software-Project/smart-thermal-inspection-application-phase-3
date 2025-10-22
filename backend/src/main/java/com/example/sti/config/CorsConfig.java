package com.example.sti.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        // API calls from your frontend (8081 / 5173) to backend (8080)
        registry.addMapping("/api/**")
                .allowedOrigins(
                        "http://localhost:8081",
                        "http://127.0.0.1:8081",
                        "http://localhost:5173",
                        "http://127.0.0.1:5173"
                )
                .allowedMethods("GET","POST","PUT","PATCH","DELETE","OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Location","Content-Type")
                .allowCredentials(true)
                .maxAge(3600);

        // (Optional) if you fetch /media/** via fetch/XHR. <img> tags don’t need CORS.
        registry.addMapping("/media/**")
                .allowedOrigins(
                        "http://localhost:8081",
                        "http://127.0.0.1:8081",
                        "http://localhost:5173",
                        "http://127.0.0.1:5173"
                )
                .allowedMethods("GET","HEAD","OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
