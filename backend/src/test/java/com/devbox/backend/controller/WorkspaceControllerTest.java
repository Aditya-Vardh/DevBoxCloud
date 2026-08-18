package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.UpdateWorkspaceRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WorkspaceControllerTest {

    @Autowired MockMvc mvc;

    // Instantiate directly — not a Spring bean in Boot 4.x without Jackson starter
    private final ObjectMapper mapper = new ObjectMapper();

    private static String createdId;

    // ── CREATE ────────────────────────────────────────────────────────────────

    @Test @Order(1)
    void createWorkspace_returnsCreated() throws Exception {
        var req = new CreateWorkspaceRequest();
        req.setName("test-workspace");
        req.setDescription("Integration test workspace");

        MvcResult result = mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("test-workspace"))
                .andExpect(jsonPath("$.description").value("Integration test workspace"))
                .andReturn();

        var body = mapper.readTree(result.getResponse().getContentAsString());
        createdId = body.get("id").asText();
        assertThat(createdId).isNotBlank();
    }

    @Test @Order(2)
    void createWorkspace_duplicateName_returnsConflict() throws Exception {
        var req = new CreateWorkspaceRequest();
        req.setName("test-workspace");

        mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("already exists")));
    }

    @Test @Order(3)
    void createWorkspace_blankName_returnsBadRequest() throws Exception {
        var req = new CreateWorkspaceRequest();
        req.setName("  ");

        mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").exists());
    }

    @Test @Order(4)
    void createWorkspace_missingBody_returnsBadRequest() throws Exception {
        mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ── READ ──────────────────────────────────────────────────────────────────

    @Test @Order(5)
    void listWorkspaces_containsCreated() throws Exception {
        mvc.perform(get("/api/workspaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'test-workspace')]").exists());
    }

    @Test @Order(6)
    void getWorkspace_byId_returnsCorrect() throws Exception {
        mvc.perform(get("/api/workspaces/{id}", createdId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdId))
                .andExpect(jsonPath("$.name").value("test-workspace"));
    }

    @Test @Order(7)
    void getWorkspace_unknownId_returnsNotFound() throws Exception {
        mvc.perform(get("/api/workspaces/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound());
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    @Test @Order(8)
    void updateWorkspace_changesDescription() throws Exception {
        var req = new UpdateWorkspaceRequest();
        req.setDescription("Updated description");

        mvc.perform(put("/api/workspaces/{id}", createdId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Updated description"));
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @Test @Order(9)
    void deleteWorkspace_returnsNoContent() throws Exception {
        mvc.perform(delete("/api/workspaces/{id}", createdId))
                .andExpect(status().isNoContent());
    }

    @Test @Order(10)
    void deleteWorkspace_alreadyDeleted_returnsNotFound() throws Exception {
        mvc.perform(delete("/api/workspaces/{id}", createdId))
                .andExpect(status().isNotFound());
    }

    @Test @Order(11)
    void getWorkspace_afterDelete_returnsNotFound() throws Exception {
        mvc.perform(get("/api/workspaces/{id}", createdId))
                .andExpect(status().isNotFound());
    }
}
