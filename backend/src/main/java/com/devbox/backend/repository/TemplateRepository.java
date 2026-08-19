package com.devbox.backend.repository;

import com.devbox.backend.entity.Template;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateRepository extends JpaRepository<Template, String> {

    List<Template> findByActiveTrueOrderBySortOrderAsc();
}
