package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateApplicationRequest;
import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.UpdateApplicationRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ApplicationControllerTest {

    @Autowired MockMvc mvc;

    private final ObjectMapper mapper = new ObjectMapper();

    private static String workspaceId;
    private static String appId;
    private static Path tempDir;

    @BeforeAll
    static void setup(@Autowired MockMvc mvc) throws Exception {
        tempDir = Files.createTempDirectory("devbox-test-");
        Files.createFile(tempDir.resolve("Dockerfile"));

        ObjectMapper m = new ObjectMapper();
        var wsReq = new CreateWorkspaceRequest();
        wsReq.setName("app-test-workspace");

        MvcResult r = mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content(m.writeValueAsString(wsReq)))
                .andExpect(status().isCreated())
                .andReturn();
        workspaceId = m.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @AfterAll
    static void teardown(@Autowired MockMvc mvc) throws Exception {
        if (workspaceId != null) {
            mvc.perform(delete("/api/workspaces/{id}", workspaceId));
        }
        if (tempDir != null) {
            tempDir.resolve("Dockerfile").toFile().delete();
            tempDir.toFile().delete();
        }
    }

    // ── CREATE ────────────────────────────────────────────────────────────────

    @Test @Order(1)
    void createApplication_returnsCreated() throws Exception {
        var req = new CreateApplicationRequest();
        req.setName("my-app");
        req.setDescription("Test application");
        req.setSourcePath(tempDir.toString());
        req.setContainerPort(8080);
        req.setReplicas(1);

        MvcResult r = mvc.perform(post("/api/workspaces/{wsId}/applications", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("my-app"))
                .andExpect(jsonPath("$.deploymentStatus").value("NOT_DEPLOYED"))
                .andExpect(jsonPath("$.k8sDeploymentName").value("my-app"))
                .andExpect(jsonPath("$.k8sServiceName").value("my-app-svc"))
                .andReturn();

        appId = mapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @Test @Order(2)
    void createApplication_invalidName_returnsBadRequest() throws Exception {
        var req = new CreateApplicationRequest();
        req.setName("My App!!");
        req.setSourcePath(tempDir.toString());
        req.setContainerPort(8080);
        req.setReplicas(1);

        mvc.perform(post("/api/workspaces/{wsId}/applications", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test @Order(3)
    void createApplication_duplicateName_returnsConflict() throws Exception {
        var req = new CreateApplicationRequest();
        req.setName("my-app");
        req.setSourcePath(tempDir.toString());
        req.setContainerPort(8080);
        req.setReplicas(1);

        mvc.perform(post("/api/workspaces/{wsId}/applications", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isConflict());
    }

    @Test @Order(4)
    void createApplication_invalidPort_returnsBadRequest() throws Exception {
        var req = new CreateApplicationRequest();
        req.setName("port-test");
        req.setSourcePath(tempDir.toString());
        req.setContainerPort(99999);
        req.setReplicas(1);

        mvc.perform(post("/api/workspaces/{wsId}/applications", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test @Order(5)
    void createApplication_nonexistentSourcePath_returnsBadRequest() throws Exception {
        var req = new CreateApplicationRequest();
        req.setName("path-test");
        req.setSourcePath("/nonexistent/path/that/does/not/exist");
        req.setContainerPort(8080);
        req.setReplicas(1);

        mvc.perform(post("/api/workspaces/{wsId}/applications", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("does not exist")));
    }

    // ── READ ──────────────────────────────────────────────────────────────────

    @Test @Order(6)
    void listApplications_containsCreated() throws Exception {
        mvc.perform(get("/api/workspaces/{wsId}/applications", workspaceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'my-app')]").exists());
    }

    @Test @Order(7)
    void getApplication_byId_returnsCorrect() throws Exception {
        mvc.perform(get("/api/applications/{id}", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(appId))
                .andExpect(jsonPath("$.name").value("my-app"))
                .andExpect(jsonPath("$.workspaceId").value(workspaceId));
    }

    @Test @Order(8)
    void getApplication_unknownId_returnsNotFound() throws Exception {
        mvc.perform(get("/api/applications/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound());
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    @Test @Order(9)
    void updateApplication_changesDescription() throws Exception {
        var req = new UpdateApplicationRequest();
        req.setDescription("Updated description");

        mvc.perform(put("/api/applications/{id}", appId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Updated description"));
    }

    // ── STATUS ────────────────────────────────────────────────────────────────

    @Test @Order(10)
    void getStatus_notDeployed_returnsCorrectStatus() throws Exception {
        mvc.perform(get("/api/applications/{id}/status", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_DEPLOYED"));
    }

    // ── HEALTH ────────────────────────────────────────────────────────────────

    @Test @Order(11)
    void healthEndpoint_returnsUp() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @Test @Order(12)
    void deleteApplication_returnsNoContent() throws Exception {
        mvc.perform(delete("/api/applications/{id}", appId))
                .andExpect(status().isNoContent());
    }

    @Test @Order(13)
    void getApplication_afterDelete_returnsNotFound() throws Exception {
        mvc.perform(get("/api/applications/{id}", appId))
                .andExpect(status().isNotFound());
    }
}
