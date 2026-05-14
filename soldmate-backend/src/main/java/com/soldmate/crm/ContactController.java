package com.soldmate.crm;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ContactController: CRUD completo de contactos CRM.
 *
 * GET    /api/v1/contacts           → lista de contactos de la empresa
 * GET    /api/v1/contacts/{id}      → detalle de un contacto
 * POST   /api/v1/contacts           → crea contacto
 * PUT    /api/v1/contacts/{id}      → actualiza contacto
 * PATCH  /api/v1/contacts/{id}/active → toggle activo/inactivo
 * DELETE /api/v1/contacts/{id}      → elimina contacto (solo OWNER)
 * GET    /api/v1/contacts/stats     → estadísticas del equipo
 */
@RestController
@RequestMapping("/api/v1/contacts")
public class ContactController {

    private final ContactService contactService;
    private final ContactRepository contactRepository;
    private final JwtUtil jwtUtil;

    public ContactController(ContactService contactService,
                             ContactRepository contactRepository,
                             JwtUtil jwtUtil) {
        this.contactService    = contactService;
        this.contactRepository = contactRepository;
        this.jwtUtil           = jwtUtil;
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record ContactResponse(
        Long    id,
        String  fullName,
        String  email,
        String  phone,
        String  avatarUrl,
        String  role,
        String  department,
        String  location,
        int     progress,
        boolean active,
        String  notes,
        String  joinDate,
        double  rating,
        String  projects,
        String  createdAt
    ) {
        static ContactResponse from(Contact c) {
            return new ContactResponse(
                c.getId(),
                c.getFullName(),
                c.getEmail(),
                c.getPhone(),
                c.getAvatarUrl(),
                c.getRole(),
                c.getDepartment(),
                c.getLocation(),
                c.getProgress() != null ? c.getProgress() : 0,
                c.getActive()   != null && c.getActive(),
                c.getNotes(),
                c.getJoinDate(),
                c.getRating()   != null ? c.getRating() : 0.0,
                c.getProjects(),
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null
            );
        }
    }

    public record ContactStats(
        long total,
        long active,
        long inactive,
        double avgProgress
    ) {}

    public record CreateRequest(
        @NotBlank String fullName,
        String email,
        String phone,
        String avatarUrl,
        String role,
        String department,
        String location,
        Integer progress,
        Boolean active,
        String notes,
        String joinDate,
        Double rating,
        String projects
    ) {}

    public record UpdateRequest(
        @NotBlank String fullName,
        String email,
        String phone,
        String avatarUrl,
        String role,
        String department,
        String location,
        Integer progress,
        Boolean active,
        String notes,
        String joinDate,
        Double rating,
        String projects
    ) {}

    // ─── Endpoints ───────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<ContactResponse>> getAll(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<ContactResponse> list = contactService.getAll(companyId)
            .stream().map(ContactResponse::from).toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/stats")
    public ResponseEntity<ContactStats> getStats(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<Contact> all = contactService.getAll(companyId);

        long active   = all.stream().filter(c -> Boolean.TRUE.equals(c.getActive())).count();
        long inactive = all.size() - active;
        double avg    = all.isEmpty() ? 0 :
            all.stream().mapToInt(c -> c.getProgress() != null ? c.getProgress() : 0).average().orElse(0);

        return ResponseEntity.ok(new ContactStats(all.size(), active, inactive, Math.round(avg * 10.0) / 10.0));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContactResponse> getOne(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            return ResponseEntity.ok(ContactResponse.from(contactService.getById(companyId, id)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ContactResponse> create(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody CreateRequest req
    ) {
        if (req.fullName() == null || req.fullName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Long companyId = extractCompanyId(authHeader);
        Contact created = contactService.create(companyId, toServiceRequest(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(ContactResponse.from(created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ContactResponse> update(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody UpdateRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            Contact updated = contactService.update(companyId, id, toServiceRequest(req));
            return ResponseEntity.ok(ContactResponse.from(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ContactResponse> toggleActive(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            Contact updated = contactService.toggleActive(companyId, id);
            return ResponseEntity.ok(ContactResponse.from(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> delete(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            contactService.delete(companyId, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }

    private ContactService.ContactRequest toServiceRequest(CreateRequest r) {
        return new ContactService.ContactRequest(
            r.fullName(), r.email(), r.phone(), r.avatarUrl(),
            r.role(), r.department(), r.location(),
            r.progress(), r.active(), r.notes(), r.joinDate(), r.rating(), r.projects()
        );
    }

    private ContactService.ContactRequest toServiceRequest(UpdateRequest r) {
        return new ContactService.ContactRequest(
            r.fullName(), r.email(), r.phone(), r.avatarUrl(),
            r.role(), r.department(), r.location(),
            r.progress(), r.active(), r.notes(), r.joinDate(), r.rating(), r.projects()
        );
    }
}
