package com.soldmate.vacation;

import com.soldmate.auth.JwtUtil;
import com.soldmate.auth.User;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.notifications.NotificationWriterService;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Vacaciones: registro, listado y aprobación.
 * OWNER y MANAGER ven todas las solicitudes de la empresa y pueden aprobar/rechazar;
 * el resto solo ven (y crean) las propias.
 */
@RestController
@RequestMapping("/api/v1/vacations")
public class VacationController {

    private final VacationRequestRepository vacationRequestRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JwtUtil jwtUtil;
    private final NotificationWriterService notificationWriterService;

    public VacationController(VacationRequestRepository vacationRequestRepository,
                              UserRepository userRepository,
                              CompanyRepository companyRepository,
                              JwtUtil jwtUtil,
                              NotificationWriterService notificationWriterService) {
        this.vacationRequestRepository = vacationRequestRepository;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.jwtUtil = jwtUtil;
        this.notificationWriterService = notificationWriterService;
    }

    public record VacationResponse(
        Long id,
        Long userId,
        String userEmail,
        String userFullName,
        String startDate,
        String endDate,
        String notes,
        String status,
        String decidedBy,
        String decidedAt,
        String decisionNote,
        String createdAt
    ) {
        static VacationResponse from(VacationRequest v) {
            User u = v.getUser();
            String full = ((u.getFirstName() != null ? u.getFirstName() : "") + " " + (u.getLastName() != null ? u.getLastName() : "")).trim();
            return new VacationResponse(
                v.getId(),
                u.getId(),
                u.getEmail(),
                full.isBlank() ? u.getEmail() : full,
                v.getStartDate().toString(),
                v.getEndDate().toString(),
                v.getNotes(),
                v.getStatus() != null ? v.getStatus().name() : VacationRequest.Status.PENDING.name(),
                v.getDecidedBy(),
                v.getDecidedAt() != null ? v.getDecidedAt().toString() : null,
                v.getDecisionNote(),
                v.getCreatedAt().toString()
            );
        }
    }

    public record CreateVacationRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        String notes
    ) {}

    public record DecisionRequest(
        @NotNull VacationRequest.Status status,
        String note
    ) {}

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<VacationResponse>> list(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String role = jwtUtil.extractRole(token);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        List<VacationRequest> list;
        if ("OWNER".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role)) {
            list = vacationRequestRepository.findByCompany_IdOrderByStartDateDesc(companyId);
        } else {
            list = vacationRequestRepository.findByCompany_IdAndUser_IdOrderByStartDateDesc(companyId, user.getId());
        }
        return ResponseEntity.ok(list.stream().map(VacationResponse::from).toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public ResponseEntity<VacationResponse> create(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody CreateVacationRequest req
    ) {
        if (req.startDate() == null || req.endDate() == null || req.endDate().isBefore(req.startDate())) {
            return ResponseEntity.badRequest().build();
        }
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cuenta desactivada");
        }

        Company company = companyRepository.findById(companyId).orElseThrow();

        VacationRequest v = new VacationRequest();
        v.setCompany(company);
        v.setUser(user);
        v.setStartDate(req.startDate());
        v.setEndDate(req.endDate());
        v.setNotes(req.notes() != null && !req.notes().isBlank() ? req.notes().trim() : null);
        v = vacationRequestRepository.save(v);
        return ResponseEntity.status(HttpStatus.CREATED).body(VacationResponse.from(v));
    }

    @PutMapping("/{id}/decision")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ResponseEntity<VacationResponse> decide(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody DecisionRequest req
    ) {
        if (req.status() == null || req.status() == VacationRequest.Status.PENDING) {
            return ResponseEntity.badRequest().build();
        }
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String approverEmail = jwtUtil.extractEmail(token);

        VacationRequest v = vacationRequestRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada"));

        v.setStatus(req.status());
        v.setDecidedBy(approverEmail);
        v.setDecidedAt(LocalDateTime.now());
        v.setDecisionNote(req.note() != null && !req.note().isBlank() ? req.note().trim() : null);
        v = vacationRequestRepository.save(v);

        // Aviso al equipo (las notificaciones son por empresa). Best-effort.
        try {
            String verb = req.status() == VacationRequest.Status.APPROVED ? "aprobada" : "rechazada";
            String who = VacationResponse.from(v).userFullName();
            notificationWriterService.createForCompany(
                companyId,
                "INFO",
                "Vacaciones " + verb,
                who + ": " + v.getStartDate() + " → " + v.getEndDate()
            );
        } catch (Exception ignored) {
            // no bloquear la respuesta por un fallo de notificación
        }

        return ResponseEntity.ok(VacationResponse.from(v));
    }
}
