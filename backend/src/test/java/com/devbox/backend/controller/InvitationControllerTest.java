package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.CreateEnvironmentRequest;
import com.fasterxml.jackson.databind.JsonNode;
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
class InvitationControllerTest {

    @Autowired MockMvc mvc;
    private final ObjectMapper mapper = new ObjectMapper();

    private static String workspaceId;
    private static String environmentId;
    private static String invitationId;
    private static String invitationCode;

    @Test @Order(1)
    void setup_createWorkspaceAndEnvironment() throws Exception {
        // Create workspace
        var wsReq = new CreateWorkspaceRequest();
        wsReq.setName("inv-test-ws");
        MvcResult wsResult = mvc.perform(post("/api/workspaces")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(wsReq)))
                .andExpect(status().isCreated())
                .andReturn();
        workspaceId = mapper.readTree(wsResult.getResponse().getContentAsString()).get("id").asText();

        // Create environment (K8s not required — PROVISIONING state is fine)
        var envReq = new CreateEnvironmentRequest();
        envReq.setName("inv-test-env");
        envReq.setTemplateId("ubuntu");
        MvcResult envResult = mvc.perform(post("/api/workspaces/{wsId}/environments", workspaceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(envReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();
        environmentId = mapper.readTree(envResult.getResponse().getContentAsString()).get("id").asText();
        assertThat(environmentId).isNotBlank();
    }

    @Test @Order(2)
    void createInvitation_returnsCreatedWithCode() throws Exception {
        MvcResult result = mvc.perform(post("/api/environments/{id}/invitations", environmentId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expiresInHours\":24}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").exists())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.revoked").value(false))
                .andExpect(jsonPath("$.useCount").value(0))
                .andReturn();
        JsonNode body = mapper.readTree(result.getResponse().getContentAsString());
        invitationId   = body.get("id").asText();
        invitationCode = body.get("code").asText();
        assertThat(invitationCode).hasSize(32);
    }

    @Test @Order(3)
    void getInvitationInfo_returnsPublicInfo() throws Exception {
        mvc.perform(get("/api/invitations/info/{code}", invitationCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(invitationCode))
                .andExpect(jsonPath("$.environmentName").value("inv-test-env"))
                .andExpect(jsonPath("$.valid").value(true));
    }

    @Test @Order(4)
    void listInvitations_containsCreatedInvitation() throws Exception {
        mvc.perform(get("/api/environments/{id}/invitations", environmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", hasItem(invitationCode)));
    }

    @Test @Order(5)
    void redeemInvitation_incrementsUseCount() throws Exception {
        mvc.perform(post("/api/invitations/redeem/{code}", invitationCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(environmentId));

        // Check use count increased
        mvc.perform(get("/api/invitations/info/{code}", invitationCode))
                .andExpect(jsonPath("$.useCount").value(1));
    }

    @Test @Order(6)
    void revokeInvitation_marksAsRevoked() throws Exception {
        mvc.perform(delete("/api/invitations/{id}", invitationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revoked").value(true));
    }

    @Test @Order(7)
    void redeemRevokedInvitation_returns400() throws Exception {
        mvc.perform(post("/api/invitations/redeem/{code}", invitationCode))
                .andExpect(status().isBadRequest());
    }

    @Test @Order(8)
    void infoOnRevokedInvitation_showsNotValid() throws Exception {
        mvc.perform(get("/api/invitations/info/{code}", invitationCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revoked").value(true))
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test @Order(9)
    void invalidCode_returns404() throws Exception {
        mvc.perform(get("/api/invitations/info/nonexistentcode12345678901234"))
                .andExpect(status().isNotFound());
    }

    @Test @Order(10)
    void createInvitationWithMaxUses_rejectsAfterLimit() throws Exception {
        // Create a 1-use invitation
        MvcResult result = mvc.perform(post("/api/environments/{id}/invitations", environmentId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"maxUses\":1}"))
                .andExpect(status().isCreated())
                .andReturn();
        String oneUseCode = mapper.readTree(result.getResponse().getContentAsString()).get("code").asText();

        // Redeem once - succeeds
        mvc.perform(post("/api/invitations/redeem/{code}", oneUseCode))
                .andExpect(status().isOk());

        // Redeem again - rejected
        mvc.perform(post("/api/invitations/redeem/{code}", oneUseCode))
                .andExpect(status().isBadRequest());
    }

    @Test @Order(11)
    void configEndpoint_returnsWorkspaceHost() throws Exception {
        mvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspaceHost").exists())
                .andExpect(jsonPath("$.workspaceLanMode").exists())
                .andExpect(jsonPath("$.apiPort").value(8080));
    }

    @Test @Order(99)
    void cleanup_deleteEnvironmentAndWorkspace() throws Exception {
        mvc.perform(delete("/api/environments/{id}", environmentId))
                .andExpect(status().isNoContent());

        // Workspace deletion
        mvc.perform(delete("/api/workspaces/{id}", workspaceId))
                .andExpect(status().isNoContent());
    }
}
