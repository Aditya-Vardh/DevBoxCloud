package com.devbox.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class KubernetesException extends RuntimeException {

    public KubernetesException(String message) {
        super(message);
    }

    public KubernetesException(String message, Throwable cause) {
        super(message, cause);
    }
}
