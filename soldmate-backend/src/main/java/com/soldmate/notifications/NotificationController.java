package com.soldmate.notifications;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * NotificationController: gestión de notificaciones persistidas por empresa.
 *
 * GET    /api/v1/notifications          → lista (max 50), ordenada por fecha desc
 * GET    /api/v1/notifications/unread-count → número de no leídas
 * PUT    /api/v1/notifications/{id}/read → marcar una como leída
 * PUT    /api/v1/notifications/read-all → marcar todas como leídas
 * POST   /api/v1/notifications          → crear nueva notificación (interna)
 */
@RestController
@RequestMapping("/api/v1/notifications")
@Transactional
public class NotificationController {

    private final JwtUtil jwtUtil;
    private final NotificationRepository notificationRepository;
    private final CompanyRepository companyRepository;

    public NotificationController(JwtUtil jwtUtil,
                                  NotificationRepository notificationRepository,
                                  CompanyRepository companyRepository) {
        this.jwtUtil = jwtUtil;
        this.notificationRepository = notificationRepository;
        this.companyRepository = companyRepository;
    }

    public record NotificationResponse(
        Long id, String type, String title, String body, boolean read, String createdAt
    ) {}

    public record CreateNotificationRequest(String type, String title, String body) {}

    // ─── GET /api/v1/notifications ────────────────────────────────────────────

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<NotificationResponse>> getAll(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<NotificationResponse> items = notificationRepository
            .findByCompanyIdOrderByCreatedAtDesc(companyId)
            .stream()
            .limit(50)
            .map(this::toResponse)
            .toList();
        return ResponseEntity.ok(items);
    }

    // ─── GET /api/v1/notifications/unread-count ───────────────────────────────

    @GetMapping("/unread-count")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Long>> unreadCount(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        long count = notificationRepository.countByCompanyIdAndReadAtIsNull(companyId);
        return ResponseEntity.ok(Map.of("unread", count));
    }

    // ─── PUT /api/v1/notifications/{id}/read ──────────────────────────────────

    @PutMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER')")
    public ResponseEntity<NotificationResponse> markRead(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        Notification n = notificationRepository.findByIdAndCompanyId(id, companyId)
            .orElseThrow(() -> new RuntimeException("Notificación no encontrada"));
        n.markRead();
        return ResponseEntity.ok(toResponse(notificationRepository.save(n)));
    }

    // ─── PUT /api/v1/notifications/read-all ──────────────────────────────────

    @PutMapping("/read-all")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER')")
    public ResponseEntity<Map<String, Integer>> markAllRead(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        int count = notificationRepository.markAllRead(companyId);
        return ResponseEntity.ok(Map.of("marked", count));
    }

    // ─── POST /api/v1/notifications ───────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<NotificationResponse> create(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody CreateNotificationRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));
        Notification n = new Notification(company, req.type(), req.title(), req.body());
        return ResponseEntity.ok(toResponse(notificationRepository.save(n)));
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
            n.getId(), n.getType(), n.getTitle(), n.getBody(),
            n.isRead(), n.getCreatedAt().toString()
        );
    }
}
