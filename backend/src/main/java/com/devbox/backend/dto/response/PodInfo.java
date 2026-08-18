package com.devbox.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class PodInfo {
    private String name;
    private String status;
    private String phase;
    private boolean ready;
    private int restartCount;
    private Instant createdAt;
    private String nodeName;
    private String containerImage;
}
