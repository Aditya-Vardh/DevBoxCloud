package com.devbox.backend.controller;

import com.devbox.backend.service.SystemHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HealthController {

    private final SystemHealthService environmentService;

    /** Basic liveness: GET /api/health */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "UP");
        result.put("timestamp", Instant.now().toString());
        result.put("service", "devbox-backend");
        return ResponseEntity.ok(result);
    }

    /** Full dependency health: GET /api/health/dependencies */
    @GetMapping("/health/dependencies")
    public ResponseEntity<Map<String, Object>> dependencyHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "UP");
        result.put("timestamp", Instant.now().toString());
        result.put("dependencies", environmentService.checkAll());
        return ResponseEntity.ok(result);
    }
}

