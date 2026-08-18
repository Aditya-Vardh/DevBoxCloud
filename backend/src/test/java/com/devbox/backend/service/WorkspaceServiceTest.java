package com.devbox.backend.service;

import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.UpdateWorkspaceRequest;
import com.devbox.backend.dto.response.WorkspaceResponse;
import com.devbox.backend.exception.ConflictException;
import com.devbox.backend.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class WorkspaceServiceTest {

    @Autowired WorkspaceService service;

    private CreateWorkspaceRequest makeReq(String name) {
        var r = new CreateWorkspaceRequest();
        r.setName(name);
        r.setDescription("desc for " + name);
        return r;
    }

    @Test void createAndRetrieve() {
        WorkspaceResponse ws = service.create(makeReq("svc-test-ws"));
        assertThat(ws.getId()).isNotNull();
        assertThat(ws.getName()).isEqualTo("svc-test-ws");

        WorkspaceResponse fetched = service.getById(ws.getId());
        assertThat(fetched.getName()).isEqualTo("svc-test-ws");
    }

    @Test void listContainsCreated() {
        service.create(makeReq("list-ws-a"));
        service.create(makeReq("list-ws-b"));

        List<WorkspaceResponse> all = service.listAll();
        assertThat(all).extracting(WorkspaceResponse::getName)
                .contains("list-ws-a", "list-ws-b");
    }

    @Test void duplicateName_throwsConflict() {
        service.create(makeReq("dup-ws"));
        assertThatThrownBy(() -> service.create(makeReq("dup-ws")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already exists");
    }

    @Test void updateWorkspace_changesFields() {
        WorkspaceResponse ws = service.create(makeReq("update-ws"));

        var req = new UpdateWorkspaceRequest();
        req.setName("update-ws-renamed");
        req.setDescription("new description");

        WorkspaceResponse updated = service.update(ws.getId(), req);
        assertThat(updated.getName()).isEqualTo("update-ws-renamed");
        assertThat(updated.getDescription()).isEqualTo("new description");
    }

    @Test void deleteWorkspace_thenNotFound() {
        WorkspaceResponse ws = service.create(makeReq("delete-ws"));
        service.delete(ws.getId());

        assertThatThrownBy(() -> service.getById(ws.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void getById_unknownId_throwsNotFound() {
        assertThatThrownBy(() -> service.getById(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
