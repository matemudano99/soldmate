package com.soldmate.incidents;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * IncidentController: endpoints del módulo de incidencias.
 *
 * GET    /api/v1/incidents              → lista todas las incidencias
 * GET    /api/v1/incidents?status=OPEN  → filtra por estado
 * POST   /api/v1/incidents              → crea incidencia sin foto (JSON)
 * POST   /api/v1/incidents/with-photo   → crea incidencia con foto (multipart)
 * PATCH  /api/v1/incidents/{id}/status  → cambia el estado de una incidencia
 * GET    /api/v1/incidents/stats        → estadísticas para el dashboard
 */
@RestController
@RequestMapping("/api/v1/incidents")
public class IncidentController {

    private final IncidentService incidentService;
    private final JwtUtil         jwtUtil;

    public IncidentController(IncidentService incidentService, JwtUtil jwtUtil) {
        this.incidentService = incidentService;
        this.jwtUtil         = jwtUtil;
    }

    // ─── Formato de fecha para la respuesta JSON ──────────────────────────────
    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record IncidentResponse(
        Long   id,
        String title,
        String description,
        String photoUrl,
        String status,
        String priority,
        String createdAt,
        String reportedBy   // email del usuario que reportó
    ) {
        public static IncidentResponse from(Incident i) {
            return new IncidentResponse(
                i.getId(),
                i.getTitle(),
                i.getDescription(),
                i.getPhotoUrl(),
                i.getStatus().name(),
                i.getPriority().name(),
                i.getCreatedAt().format(DATE_FMT),
                i.getReportedBy() != null ? i.getReportedBy().getEmail() : null
            );
        }
    }

    /** Estadísticas del dashboard: cuántas incidencias por estado. */
    public record IncidentStats(
        long total,
        long open,
        long inProgress,
        long closed,
        long activeTotal  // open + in_progress
    ) {}

    public record CreateIncidentRequest(
        @NotBlank String title,
        String description,
        @NotNull Incident.Priority priority
    ) {}

    public record UpdateStatusRequest(
        @NotNull Incident.Status status
    ) {}

    public record UpdateIncidentRequest(
        @NotBlank String title,
        String description,
        @NotNull Incident.Priority priority
    ) {}

    // ─── Endpoints ───────────────────────────────────────────────────────────

    /**
     * GET /api/v1/incidents
     * GET /api/v1/incidents?status=OPEN
     */
    @GetMapping
    public ResponseEntity<List<IncidentResponse>> getIncidents(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) Incident.Status status
    ) {
        Long companyId = extractCompanyId(authHeader);

        List<Incident> incidents = status != null
            ? incidentService.getByStatus(companyId, status)
            : incidentService.getAllByCompany(companyId);

        List<IncidentResponse> response = incidents.stream()
            .map(IncidentResponse::from)
            .toList();

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/incidents/stats
     * Devuelve contadores para los KPIs del dashboard.
     */
    @GetMapping("/stats")
    public ResponseEntity<IncidentStats> getStats(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<Incident> all = incidentService.getAllByCompany(companyId);

        long open       = all.stream().filter(i -> i.getStatus() == Incident.Status.OPEN).count();
        long inProgress = all.stream().filter(i -> i.getStatus() == Incident.Status.IN_PROGRESS).count();
        long closed     = all.stream().filter(i -> i.getStatus() == Incident.Status.CLOSED).count();

        return ResponseEntity.ok(new IncidentStats(
            all.size(), open, inProgress, closed, open + inProgress
        ));
    }

    /**
     * GET /api/v1/incidents/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncident(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        return incidentService.getByCompanyAndId(companyId, id)
            .map(IncidentResponse::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/v1/incidents
     * Crea una incidencia sin foto (JSON).
     */
    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody CreateIncidentRequest req
    ) {
        Long   companyId   = extractCompanyId(authHeader);
        String reportedBy  = extractEmail(authHeader);

        if (req.title() == null || req.title().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        Incident incident = incidentService.create(
            companyId, reportedBy,
            req.title(), req.description(),
            req.priority() != null ? req.priority() : Incident.Priority.MEDIUM
        );

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(IncidentResponse.from(incident));
    }

    /**
     * POST /api/v1/incidents/with-photo
     * Crea una incidencia con foto (multipart/form-data).
     *
     * MediaType.MULTIPART_FORM_DATA_VALUE: indica que esperamos
     * un formulario con múltiples partes (texto + archivo).
     */
    @PostMapping(value = "/with-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createIncidentWithPhoto(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam("title")       String title,
        @RequestParam(value = "description", required = false) String description,
        @RequestParam("priority")    Incident.Priority priority,
        @RequestParam("photo")       MultipartFile photo
    ) {
        Long   companyId  = extractCompanyId(authHeader);
        String reportedBy = extractEmail(authHeader);

        // Validamos que sea una imagen (no un PDF o ejecutable)
        String contentType = photo.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest()
                .body("Solo se permiten archivos de imagen");
        }

        // Límite de 5 MB por foto
        if (photo.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest()
                .body("La imagen no puede superar 5 MB");
        }

        try {
            Incident incident = incidentService.createWithPhoto(
                companyId, reportedBy, title, description, priority, photo
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(IncidentResponse.from(incident));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error al subir la imagen: " + e.getMessage());
        } catch (RuntimeException e) {
            // p. ej. error HTTP de Supabase (403 RLS, bucket inexistente, clave inválida)
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body("Almacenamiento: " + e.getMessage());
        }
    }

    /**
     * PATCH /api/v1/incidents/{id}/status
     * Cambia el estado: OPEN → IN_PROGRESS → CLOSED.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<IncidentResponse> updateStatus(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody UpdateStatusRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);

        try {
            Incident updated = incidentService.updateStatus(companyId, id, req.status());
            return ResponseEntity.ok(IncidentResponse.from(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<IncidentResponse> updateIncident(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody UpdateIncidentRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            Incident updated = incidentService.updateIncident(
                companyId,
                id,
                req.title(),
                req.description(),
                req.priority()
            );
            return ResponseEntity.ok(IncidentResponse.from(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteIncident(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            incidentService.deleteIncident(companyId, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }

    private String extractEmail(String authHeader) {
        return jwtUtil.extractEmail(authHeader.substring(7));
    }
}
