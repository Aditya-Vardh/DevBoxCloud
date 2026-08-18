package com.devbox.backend.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ServiceInfo {
    private String name;
    private String type;
    private String clusterIp;
    private int port;
    private int targetPort;
    private Integer nodePort;
    /** Accessible URL for Minikube NodePort services */
    private String accessUrl;
}
