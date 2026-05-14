package com.soldmate.vacation;

import com.soldmate.auth.JwtUtil;
import com.soldmate.auth.User;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * MVP vacaciones: registro y listado. Sin flujo de aprobación.
 * OWNER y MANAGER ven todas las solicitudes de la empresa; el resto solo las propias.
 */
@RestController
@RequestMapping("/api/v1/vacations")
public class VacationController {

    private final VacationRequestRepository vacationRequestRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JwtUtil jwtUtil;

    public VacationController(VacationRequestRepository vacationRequestRepository,
                              UserRepository userRepository,
                              CompanyRepository companyRepository,
                              JwtUtil jwtUtil) {
        this.vacationRequestRepository = vacationRequestRepository;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.jwtUtil = jwtUtil;
    }

    public record VacationResponse(
        Long id,
        Long userId,
        String userEmail,
        String userFullName,
        String startDate,
        String endDate,
        String notes,
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
                v.getCreatedAt().toString()
            );
        }
    }

    public record CreateVacationRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        String notes
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
}
