package com.devbox.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.*;

@RestController
public class ConfigController {

    @Value("${devbox.workspace.host:127.0.0.1}")
    private String workspaceHostRaw;

    @Value("${server.port:8080}")
    private int serverPort;

    private String workspaceHost() {
        if (workspaceHostRaw == null || workspaceHostRaw.isBlank()) return "127.0.0.1";
        return workspaceHostRaw.trim();
    }

    @GetMapping("/api/config")
    public Map<String, Object> config() {
        String host = workspaceHost();
        boolean isLoopback = host.equals("127.0.0.1") || host.equalsIgnoreCase("localhost");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("workspaceHost",    host);
        result.put("workspaceLanMode", !isLoopback);
        result.put("apiPort",          serverPort);
        result.put("lanSetupInstruction",
                isLoopback
                ? "Set DEVBOX_WORKSPACE_HOST to your LAN IP and restart the backend to enable workspace access from other devices."
                : "LAN mode active — workspace terminal and desktop links are reachable on the local network.");
        return result;
    }

    /**
     * Returns the detected LAN IPv4 addresses of this machine.
     * Useful for finding the correct DEVBOX_WORKSPACE_HOST value.
     */
    @GetMapping("/api/config/lan-addresses")
    public Map<String, Object> lanAddresses() {
        List<String> addresses = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (!iface.isUp() || iface.isLoopback() || iface.isVirtual()) continue;
                Enumeration<InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr.isLoopbackAddress() || addr instanceof java.net.Inet6Address) continue;
                    String ip = addr.getHostAddress();
                    if (!ip.startsWith("192.168.144.") && !ip.startsWith("172.") ) {
                        addresses.add(ip);
                    }
                }
            }
        } catch (Exception ignored) {}
        String host = workspaceHost();
        return Map.of(
            "addresses",          addresses,
            "currentWorkspaceHost", host,
            "workspaceLanMode",   !host.equals("127.0.0.1") && !host.equalsIgnoreCase("localhost")
        );
    }
}
