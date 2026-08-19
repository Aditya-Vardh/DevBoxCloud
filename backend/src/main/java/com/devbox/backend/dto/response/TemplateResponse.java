package com.devbox.backend.dto.response;

import com.devbox.backend.entity.Template;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TemplateResponse {

    private String id;
    private String displayName;
    private String description;
    private String image;
    private String category;
    private String icon;
    private String defaultCpu;
    private String maxCpu;
    private String defaultMemory;
    private String maxMemory;
    private String defaultStorage;
    private int containerPort;
    private String installedTools;
    private String startupCommand;
    private boolean active;
    private int sortOrder;

    public static TemplateResponse from(Template t) {
        return TemplateResponse.builder()
                .id(t.getId())
                .displayName(t.getDisplayName())
                .description(t.getDescription())
                .image(t.getImage())
                .category(t.getCategory())
                .icon(t.getIcon())
                .defaultCpu(t.getDefaultCpu())
                .maxCpu(t.getMaxCpu())
                .defaultMemory(t.getDefaultMemory())
                .maxMemory(t.getMaxMemory())
                .defaultStorage(t.getDefaultStorage())
                .containerPort(t.getContainerPort())
                .installedTools(t.getInstalledTools())
                .startupCommand(t.getStartupCommand())
                .active(t.isActive())
                .sortOrder(t.getSortOrder())
                .build();
    }
}
