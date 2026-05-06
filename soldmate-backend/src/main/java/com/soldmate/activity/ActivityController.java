package com.soldmate.activity;

import com.soldmate.auth.JwtUtil;
import com.soldmate.incidents.Incident;
import com.soldmate.incidents.IncidentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * ActivityController: feed de actividad reciente para el dashboard.
 *
 * GET /api/v1/activity → últimas 60 actividades de la empresa ordenadas por fecha desc.
 *
 * Correcciones aplicadas:
 *  1. @Transactional(readOnly = true) — necesario para que Hibernate mantenga
 *     la sesión abierta y evite LazyInitializationException al serializar `uploadedBy`.
 *     (La query de IncidentRepository ya usa JOIN FETCH, pero la anotación es buena práctica.)
 *  2. Extracción del companyId a través del SecurityContext cuando no se recibe
 *     header explícito (compatibilidad con autenticación por cookie/filtro).
 *  3. Manejo defensivo del prefijo "Bearer " para evitar StringIndexOutOfBoundsException.
 */
@RestController
@RequestMapping("/api/v1/activity")
@Transactional(readOnly = true)
public class ActivityController {

    private final JwtUtil jwtUtil;
    private final ActivityLogRepository activityLogRepository;

    public ActivityController(JwtUtil jwtUtil, ActivityLogRepository activityLogRepository) {
        this.jwtUtil = jwtUtil;
        this.activityLogRepository = activityLogRepository;
    }

    public record ActivityItemResponse(
        Long   id,
        String type,
        String title,
        String status,    // Map action here
        String priority,  // Optional or map entity_type here if we want colors
        String createdAt,
        String actorName,
        String actorAvatarUrl,
        String actorEmail
    ) {}

    @GetMapping
    public ResponseEntity<List<ActivityItemResponse>> getActivity(
        @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Long companyId = resolveCompanyId(authHeader);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }

        List<ActivityItemResponse> items = activityLogRepository
            .findByCompanyIdOrderByCreatedAtDesc(companyId)
            .stream()
            .limit(60)
            .map(this::toActivity)
            .toList();

        return ResponseEntity.ok(items);
    }

    private Long resolveCompanyId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ") && authHeader.length() > 7) {
            try { return jwtUtil.extractCompanyId(authHeader.substring(7)); } catch (Exception ignored) {}
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String token) {
            try { return jwtUtil.extractCompanyId(token); } catch (Exception ignored) {}
        }
        return null;
    }

    private ActivityItemResponse toActivity(ActivityLog a) {
        String avatarUrl = null;
        if (a.getActor() != null) {
            avatarUrl = a.getActor().getAvatarUrl();
        }
        
        // El frontend espera "type" = "INCIDENT", "DOCUMENT", etc. para el ícono.
        // Espera "status" para el estado. Nosotros lo usaremos para la acción.
        return new ActivityItemResponse(
            a.getId(),
            a.getEntityType(),
            a.getTitle(),
            a.getAction(),
            "NORMAL", // Ya no dependemos de priority para logs genéricos
            a.getCreatedAt().toString(),
            a.getActorName(),
            avatarUrl,
            a.getActorEmail()
        );
    }
}
