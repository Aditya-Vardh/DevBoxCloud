package com.devbox.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ScaleRequest {

    @NotNull(message = "Replicas count is required")
    @Min(value = 0, message = "Replicas must be 0 or greater")
    @Max(value = 50, message = "Replicas cannot exceed 50")
    private Integer replicas;
}
