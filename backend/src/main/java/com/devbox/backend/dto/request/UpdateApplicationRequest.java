package com.devbox.backend.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateApplicationRequest {

    @Size(max = 500)
    private String description;

    private String sourcePath;

    @Min(1) @Max(65535)
    private Integer containerPort;

    @Min(0) @Max(50)
    private Integer replicas;
}
