package com.devbox.backend.service;

import com.devbox.backend.dto.response.TemplateResponse;
import com.devbox.backend.entity.Template;
import com.devbox.backend.exception.ResourceNotFoundException;
import com.devbox.backend.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateService {

    private final TemplateRepository templateRepository;

    public List<TemplateResponse> listActive() {
        return templateRepository.findByActiveTrueOrderBySortOrderAsc()
                .stream()
                .map(TemplateResponse::from)
                .collect(Collectors.toList());
    }

    public TemplateResponse getById(String id) {
        return TemplateResponse.from(findOrThrow(id));
    }

    public Template findOrThrow(String id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template", id));
    }
}
