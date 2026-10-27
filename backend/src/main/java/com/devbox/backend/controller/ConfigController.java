package com.devbox.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ConfigController {

    @Value("${devbox.workspace.host:127.0.0.1}")
    private String workspaceHost;

    @Value("${server.port:8080}")
    private int serverPort;

    /**
     * Returns runtime configuration the frontend needs.
     * Used to build correct LAN-accessible invite URLs.
     */
    @GetMapping("/api/config")
    public Map<String, Object> config() {
        return Map.of(
            "workspaceHost", workspaceHost,
            "apiPort", serverPort
        );
    }
}
