package com.devbox.backend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Instant;
import java.util.*;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // ── Validation errors ────────────────────────────────────────────────────

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {

        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        return buildError(HttpStatus.BAD_REQUEST, "Validation failed", fieldErrors, request);
    }

    // ── Domain exceptions ────────────────────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Object> handleNotFound(ResourceNotFoundException ex, WebRequest req) {
        return buildError(HttpStatus.NOT_FOUND, ex.getMessage(), null, req);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Object> handleConflict(ConflictException ex, WebRequest req) {
        return buildError(HttpStatus.CONFLICT, ex.getMessage(), null, req);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Object> handleBadRequest(BadRequestException ex, WebRequest req) {
        return buildError(HttpStatus.BAD_REQUEST, ex.getMessage(), null, req);
    }

    @ExceptionHandler(KubernetesException.class)
    public ResponseEntity<Object> handleKubernetes(KubernetesException ex, WebRequest req) {
        log.warn("Kubernetes error: {}", ex.getMessage());
        return buildError(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), null, req);
    }

    // ── Catch-all ────────────────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleAll(Exception ex, WebRequest req) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Check server logs.", null, req);
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private ResponseEntity<Object> buildError(HttpStatus status, String message,
                                               Map<String, String> fieldErrors,
                                               WebRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", request.getDescription(false).replace("uri=", ""));
        if (fieldErrors != null && !fieldErrors.isEmpty()) {
            body.put("fieldErrors", fieldErrors);
        }
        return new ResponseEntity<>(body, status);
    }
}
