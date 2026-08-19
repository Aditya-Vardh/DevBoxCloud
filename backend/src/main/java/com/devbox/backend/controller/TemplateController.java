package com.devbox.backend.controller;

import com.devbox.backend.dto.response.TemplateResponse;
import com.devbox.backend.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    /** GET /api/templates — list all active templates */
    @GetMapping
    public ResponseEntity<List<TemplateResponse>> listActive() {
        return ResponseEntity.ok(templateService.listActive());
    }

    /** GET /api/templates/:id */
    @GetMapping("/{id}")
    public ResponseEntity<TemplateResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(templateService.getById(id));
    }
}
