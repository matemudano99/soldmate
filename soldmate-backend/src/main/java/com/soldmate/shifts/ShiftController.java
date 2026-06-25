package com.soldmate.shifts;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * Planificación de turnos (cobertura por día). Lectura para cualquier usuario autenticado;
 * alta/edición/borrado para MANAGER y superiores.
 */
@RestController
@RequestMapping("/api/v1/shifts")
@Transactional
public class ShiftController {

    private final ShiftPlanRepository shiftPlanRepository;
    private final CompanyRepository companyRepository;
    private final ActivityLogger activityLogger;
    private final JwtUtil jwtUtil;

    public ShiftController(ShiftPlanRepository shiftPlanRepository,
                           CompanyRepository companyRepository,
                           ActivityLogger activityLogger,
                           JwtUtil jwtUtil) {
        this.shiftPlanRepository = shiftPlanRepository;
        this.companyRepository = companyRepository;
        this.activityLogger = activityLogger;
        this.jwtUtil = jwtUtil;
    }

    public record ShiftResponse(
        Long id,
        String shiftDate,
        String shiftName,
        int staffRequired,
        String notes,
        String createdAt
    ) {
        static ShiftResponse from(ShiftPlan s) {
            return new ShiftResponse(
                s.getId(),
                s.getShiftDate().toString(),
                s.getShiftName(),
                s.getStaffRequired(),
                s.getNotes(),
                s.getCreatedAt().toString()
            );
        }
    }

    public record ShiftRequest(
        @NotNull LocalDate shiftDate,
        @NotBlank String shiftName,
        Integer staffRequired,
        String notes
    ) {}

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ShiftResponse>> list(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Long companyId = companyId(authHeader);
        List<ShiftPlan> rows = (from != null && to != null)
            ? shiftPlanRepository.findByCompany_IdAndShiftDateBetweenOrderByShiftDateAscShiftNameAsc(companyId, from, to)
            : shiftPlanRepository.findByCompany_IdOrderByShiftDateDescShiftNameAsc(companyId);
        return ResponseEntity.ok(rows.stream().map(ShiftResponse::from).toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ShiftResponse> create(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody ShiftRequest req
    ) {
        if (req.shiftDate() == null || req.shiftName() == null || req.shiftName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Long companyId = companyId(authHeader);
        String email = jwtUtil.extractEmail(authHeader.substring(7));
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));

        ShiftPlan s = new ShiftPlan();
        s.setCompany(company);
        applyRequest(s, req);
        s = shiftPlanRepository.save(s);
        activityLogger.log(companyId, email, "SHIFT", "CREADO", s.getShiftName() + " · " + s.getShiftDate());
        return ResponseEntity.status(HttpStatus.CREATED).body(ShiftResponse.from(s));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ShiftResponse> update(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody ShiftRequest req
    ) {
        if (req.shiftDate() == null || req.shiftName() == null || req.shiftName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Long companyId = companyId(authHeader);
        String email = jwtUtil.extractEmail(authHeader.substring(7));
        ShiftPlan s = shiftPlanRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turno no encontrado"));
        applyRequest(s, req);
        s = shiftPlanRepository.save(s);
        activityLogger.log(companyId, email, "SHIFT", "MODIFICADO", s.getShiftName() + " · " + s.getShiftDate());
        return ResponseEntity.ok(ShiftResponse.from(s));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<Void> delete(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = companyId(authHeader);
        String email = jwtUtil.extractEmail(authHeader.substring(7));
        ShiftPlan s = shiftPlanRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turno no encontrado"));
        String label = s.getShiftName() + " · " + s.getShiftDate();
        shiftPlanRepository.delete(s);
        activityLogger.log(companyId, email, "SHIFT", "ELIMINADO", label);
        return ResponseEntity.noContent().build();
    }

    private void applyRequest(ShiftPlan s, ShiftRequest req) {
        s.setShiftDate(req.shiftDate());
        s.setShiftName(req.shiftName().trim());
        s.setStaffRequired(req.staffRequired() != null && req.staffRequired() > 0 ? req.staffRequired() : 1);
        s.setNotes(req.notes() != null && !req.notes().isBlank() ? req.notes().trim() : null);
    }

    private Long companyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }
}
