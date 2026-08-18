package com.devbox.backend.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class K8sNameUtilTest {

    @Test void sanitize_lowercaseSafe() {
        assertThat(K8sNameUtil.sanitize("my-app")).isEqualTo("my-app");
    }

    @Test void sanitize_convertsUppercase() {
        assertThat(K8sNameUtil.sanitize("MyApp")).isEqualTo("myapp");
    }

    @Test void sanitize_replacesSpacesWithHyphens() {
        assertThat(K8sNameUtil.sanitize("my app")).isEqualTo("my-app");
    }

    @Test void sanitize_stripsLeadingTrailingHyphens() {
        assertThat(K8sNameUtil.sanitize("--myapp--")).isEqualTo("myapp");
    }

    @Test void sanitize_truncatesTo63() {
        String longName = "a".repeat(100);
        assertThat(K8sNameUtil.sanitize(longName)).hasSize(63);
    }

    @Test void sanitize_emptyInput_throwsException() {
        assertThatThrownBy(() -> K8sNameUtil.sanitize(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void sanitize_nullInput_throwsException() {
        assertThatThrownBy(() -> K8sNameUtil.sanitize(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void deploymentName_equalsAppName() {
        assertThat(K8sNameUtil.deploymentName("myapp")).isEqualTo("myapp");
    }

    @Test void serviceName_hasSuffix() {
        assertThat(K8sNameUtil.serviceName("myapp")).isEqualTo("myapp-svc");
    }

    @Test void imageName_hasDevboxPrefix() {
        assertThat(K8sNameUtil.imageName("myapp")).isEqualTo("devbox/myapp:latest");
    }
}
