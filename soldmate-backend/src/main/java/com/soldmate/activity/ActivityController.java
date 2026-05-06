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
    private final IncidentRepository incidentRepository;

    public ActivityController(JwtUtil jwtUtil, IncidentRepository incidentRepository) {
        this.jwtUtil = jwtUtil;
        this.incidentRepository = incidentRepository;
    }

    public record ActivityItemResponse(
        Long   id,
        String type,
        String title,
        String status,
        String priority,
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

        List<ActivityItemResponse> items = incidentRepository
            .findByCompanyIdOrderByCreatedAtDesc(companyId)
            .stream()
            .limit(60)
            .map(this::toActivity)
            .toList();

        return ResponseEntity.ok(items);
    }

    /**
     * Extrae el companyId del JWT, ya sea del header Authorization o del SecurityContext
     * (cuando el JwtFilter ya lo inyectó).
     */
    private Long resolveCompanyId(String authHeader) {
        // Opción 1: header explícito con "Bearer <token>"
        if (authHeader != null && authHeader.startsWith("Bearer ") && authHeader.length() > 7) {
            try {
                return jwtUtil.extractCompanyId(authHeader.substring(7));
            } catch (Exception ignored) {
                // token malformado → intentamos el SecurityContext
            }
        }
        // Opción 2: el JwtFilter ya guardó el email en el SecurityContext;
        // recuperamos el companyId parseando el mismo token del contexto.
        // En este proyecto el SecurityContext almacena el email como "principal".
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String token) {
            try {
                return jwtUtil.extractCompanyId(token);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private ActivityItemResponse toActivity(Incident i) {
        String actorName   = "Usuario";
        String actorEmail  = null;
        String actorAvatar = null;

        if (i.getReportedBy() != null) {
            String first = i.getReportedBy().getFirstName();
            String last  = i.getReportedBy().getLastName();
            String full  = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
            actorName  = full.isBlank() ? i.getReportedBy().getEmail() : full;
            actorEmail = i.getReportedBy().getEmail();
            actorAvatar = i.getReportedBy().getAvatarUrl();
        }

        return new ActivityItemResponse(
            i.getId(),
            "INCIDENT",
            i.getTitle(),
            i.getStatus().name(),
            i.getPriority().name(),
            i.getCreatedAt().toString(),
            actorName,
            actorAvatar,
            actorEmail
        );
    }
}
