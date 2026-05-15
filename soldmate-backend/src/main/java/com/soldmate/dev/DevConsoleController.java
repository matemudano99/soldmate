package com.soldmate.dev;

import com.soldmate.auth.User;
import com.soldmate.auth.UserCompanyMembership;
import com.soldmate.auth.UserCompanyMembershipRepository;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * Consola multi-tenant solo para rol DEV (operador de plataforma).
 */
@RestController
@RequestMapping("/api/v1/dev")
@PreAuthorize("hasRole('DEV')")
public class DevConsoleController {

    private final UserRepository userRepository;
    private final UserCompanyMembershipRepository membershipRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;
    private final DevPlatformService platformService;

    public DevConsoleController(UserRepository userRepository,
                                UserCompanyMembershipRepository membershipRepository,
                                CompanyRepository companyRepository,
                                PasswordEncoder passwordEncoder,
                                DevPlatformService platformService) {
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.companyRepository = companyRepository;
        this.passwordEncoder = passwordEncoder;
        this.platformService = platformService;
    }

    public record DevMembershipLink(
        Long membershipId,
        Long companyId,
        String companyName,
        String membershipRole
    ) {}

    public record DevUserAggregateResponse(
        Long userId,
        String email,
        String firstName,
        String lastName,
        String nationalId,
        String jobTitle,
        String workScheduleNote,
        boolean active,
        String avatarUrl,
        String globalRole,
        String lastSeenAt,
        Long primaryCompanyId,
        List<DevMembershipLink> memberships
    ) {}

    public record DevCompanySummaryResponse(
        Long companyId,
        String companyName,
        String taxId,
        String city,
        String country,
        String subscriptionTier,
        String businessEmail,
        String businessPhone,
        String addressLine,
        int membershipCount
    ) {}

    public record DevConsoleResponse(
        int companyCount,
        int membershipCount,
        int distinctUserCount,
        List<DevCompanySummaryResponse> companies,
        List<DevUserAggregateResponse> users
    ) {}

    public record DevCompanyUpsertRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 32) String taxId,
        @Size(max = 120) String city,
        @Size(max = 2) String country,
        @Size(max = 255) String businessEmail,
        @Size(max = 120) String businessPhone,
        @Size(max = 255) String addressLine,
        String subscriptionTier
    ) {}

    public record DevUserUpdateRequest(
        @NotBlank @Email String email,
        String firstName,
        String lastName,
        @Size(max = 32) String nationalId,
        @Size(max = 160) String jobTitle,
        @Size(max = 512) String workScheduleNote,
        Boolean active,
        String avatarUrl,
        String globalRole,
        String membershipRole,
        Long primaryCompanyId,
        /** Mueve la membresía indicada a otro negocio. */
        Long membershipCompanyId,
        @Size(min = 8, max = 128) String newPassword
    ) {}

    public record DevCreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotNull Long companyId,
        String firstName,
        String lastName,
        String membershipRole,
        String globalRole
    ) {}

    public record DevAddMembershipRequest(
        @NotNull Long companyId,
        String membershipRole
    ) {}

    @GetMapping("/console")
    public ResponseEntity<DevConsoleResponse> getConsole() {
        List<UserCompanyMembership> memberships =
            membershipRepository.findAllWithUserAndCompanyOrderByCompanyAndEmail();

        Map<Long, DevCompanySummaryResponse> companies = new LinkedHashMap<>();
        Map<Long, MutableUserAgg> users = new LinkedHashMap<>();

        for (UserCompanyMembership m : memberships) {
            Company c = m.getCompany();
            User u = m.getUser();

            companies.computeIfAbsent(c.getId(), id -> toCompanySummary(c, 0));
            DevCompanySummaryResponse prev = companies.get(c.getId());
            companies.put(c.getId(), new DevCompanySummaryResponse(
                prev.companyId(),
                prev.companyName(),
                prev.taxId(),
                prev.city(),
                prev.country(),
                prev.subscriptionTier(),
                prev.businessEmail(),
                prev.businessPhone(),
                prev.addressLine(),
                prev.membershipCount() + 1
            ));

            MutableUserAgg agg = users.computeIfAbsent(u.getId(), id -> fromUser(u));
            agg.memberships.add(new DevMembershipLink(
                m.getId(),
                c.getId(),
                c.getName(),
                m.getRole().name()
            ));
        }

        for (Company c : companyRepository.findAll()) {
            if (!companies.containsKey(c.getId())) {
                companies.put(c.getId(), toCompanySummary(c, 0));
            }
        }

        List<DevCompanySummaryResponse> companyList = companies.values().stream()
            .sorted(Comparator.comparing(DevCompanySummaryResponse::companyName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        List<DevUserAggregateResponse> userList = users.values().stream()
            .map(MutableUserAgg::toResponse)
            .sorted(Comparator.comparing(DevUserAggregateResponse::email, String.CASE_INSENSITIVE_ORDER))
            .toList();

        return ResponseEntity.ok(new DevConsoleResponse(
            companyList.size(),
            memberships.size(),
            users.size(),
            companyList,
            userList
        ));
    }

    @PostMapping("/companies")
    public ResponseEntity<DevCompanySummaryResponse> createCompany(@Valid @RequestBody DevCompanyUpsertRequest req) {
        Company c = new Company();
        applyCompanyFields(c, req);
        companyRepository.save(c);
        return ResponseEntity.status(HttpStatus.CREATED).body(toCompanySummary(c, 0));
    }

    @PutMapping("/companies/{companyId}")
    public ResponseEntity<DevCompanySummaryResponse> updateCompany(
        @PathVariable Long companyId,
        @Valid @RequestBody DevCompanyUpsertRequest req
    ) {
        Company c = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        applyCompanyFields(c, req);
        companyRepository.save(c);
        long count = membershipRepository.findByCompany_IdOrderByUser_FirstNameAscUser_LastNameAsc(companyId).size();
        return ResponseEntity.ok(toCompanySummary(c, (int) count));
    }

    @DeleteMapping("/companies/{companyId}")
    public ResponseEntity<Void> deleteCompany(
        @PathVariable Long companyId,
        @RequestParam String confirmName
    ) {
        Company c = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!c.getName().trim().equalsIgnoreCase(confirmName.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre de confirmación no coincide");
        }
        if (hasProtectedDevUser(companyId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede eliminar un negocio con el usuario DEV de plataforma");
        }
        platformService.deleteAllCompanyData(companyId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<DevUserAggregateResponse> updateUser(
        @PathVariable Long userId,
        @RequestParam Long membershipId,
        @Valid @RequestBody DevUserUpdateRequest req
    ) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String normalizedEmail = req.email().toLowerCase().trim();
        if (!normalizedEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ya en uso");
        }

        user.setEmail(normalizedEmail);
        user.setFirstName(blankToNull(req.firstName()));
        user.setLastName(blankToNull(req.lastName()));
        user.setNationalId(blankToNull(req.nationalId()));
        user.setJobTitle(blankToNull(req.jobTitle()));
        user.setWorkScheduleNote(blankToNull(req.workScheduleNote()));
        if (req.active() != null) {
            user.setActive(req.active());
        }
        user.setAvatarUrl(blankToNull(req.avatarUrl()));

        if (req.globalRole() != null && !req.globalRole().isBlank()) {
            user.setRole(resolveGlobalRole(req.globalRole().trim()));
        }

        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.newPassword().length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contraseña: mínimo 8 caracteres");
            }
            user.setPassword(passwordEncoder.encode(req.newPassword().trim()));
        }

        UserCompanyMembership membership = membershipRepository.findById(membershipId)
            .filter(m -> m.getUser().getId().equals(userId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membresía no encontrada"));

        if (req.membershipRole() != null && !req.membershipRole().isBlank()) {
            membership.setRole(resolveMembershipRole(req.membershipRole().trim()));
        }

        if (req.membershipCompanyId() != null
            && !req.membershipCompanyId().equals(membership.getCompany().getId())) {
            Company target = companyRepository.findById(req.membershipCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Negocio destino no encontrado"));
            if (membershipRepository.existsByUser_IdAndCompany_Id(userId, target.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El usuario ya pertenece a ese negocio");
            }
            Long oldCompanyId = membership.getCompany().getId();
            membership.setCompany(target);
            if (user.getCompany() != null && user.getCompany().getId().equals(oldCompanyId)) {
                user.setCompany(target);
            }
        }

        if (req.primaryCompanyId() != null) {
            Company primary = companyRepository.findById(req.primaryCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empresa principal no encontrada"));
            if (!membershipRepository.existsByUser_IdAndCompany_Id(userId, primary.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El usuario debe tener membresía en la empresa principal");
            }
            user.setCompany(primary);
        }

        membershipRepository.save(membership);
        userRepository.save(user);

        return ResponseEntity.ok(toUserAggregate(user));
    }

    @PostMapping("/users")
    public ResponseEntity<DevUserAggregateResponse> createUser(@Valid @RequestBody DevCreateUserRequest req) {
        String email = req.email().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ya registrado");
        }
        Company company = companyRepository.findById(req.companyId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Negocio no encontrado"));

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.password().trim()));
        user.setFirstName(blankToNull(req.firstName()));
        user.setLastName(blankToNull(req.lastName()));
        user.setCompany(company);
        user.setRole(req.globalRole() != null && !req.globalRole().isBlank()
            ? resolveGlobalRole(req.globalRole().trim())
            : User.Role.EMPLOYEE);
        user.setActive(true);
        userRepository.save(user);

        User.Role memRole = req.membershipRole() != null && !req.membershipRole().isBlank()
            ? resolveMembershipRole(req.membershipRole().trim())
            : User.Role.EMPLOYEE;
        membershipRepository.save(UserCompanyMembership.of(user, company, memRole));

        return ResponseEntity.status(HttpStatus.CREATED).body(toUserAggregate(user));
    }

    @PostMapping("/users/{userId}/memberships")
    public ResponseEntity<DevUserAggregateResponse> addMembership(
        @PathVariable Long userId,
        @Valid @RequestBody DevAddMembershipRequest req
    ) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Company company = companyRepository.findById(req.companyId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Negocio no encontrado"));
        if (membershipRepository.existsByUser_IdAndCompany_Id(userId, company.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tiene membresía en ese negocio");
        }
        User.Role role = req.membershipRole() != null && !req.membershipRole().isBlank()
            ? resolveMembershipRole(req.membershipRole().trim())
            : User.Role.EMPLOYEE;
        membershipRepository.save(UserCompanyMembership.of(user, company, role));
        return ResponseEntity.ok(toUserAggregate(user));
    }

    @DeleteMapping("/memberships/{membershipId}")
    public ResponseEntity<Void> deleteMembership(@PathVariable Long membershipId) {
        UserCompanyMembership m = membershipRepository.findById(membershipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        User user = m.getUser();
        if (user.getRole() == User.Role.DEV) {
            long count = membershipRepository.countByUser_Id(user.getId());
            if (count <= 1) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El usuario DEV debe conservar al menos una membresía");
            }
        }
        long total = membershipRepository.countByUser_Id(user.getId());
        if (total <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Última membresía: elimina el usuario completo si quieres borrarlo");
        }
        Long removedCompanyId = m.getCompany().getId();
        membershipRepository.delete(m);
        if (user.getCompany() != null && user.getCompany().getId().equals(removedCompanyId)) {
            membershipRepository.findByUser_IdOrderByCompany_NameAsc(user.getId()).stream()
                .findFirst()
                .ifPresent(other -> {
                    user.setCompany(other.getCompany());
                    userRepository.save(user);
                });
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (user.getRole() == User.Role.DEV) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede eliminar el usuario DEV de plataforma");
        }
        platformService.deleteUserFully(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{userId}/unlock")
    public ResponseEntity<DevUserAggregateResponse> unlockUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.setActive(true);
        userRepository.save(user);
        return ResponseEntity.ok(toUserAggregate(user));
    }

    private boolean hasProtectedDevUser(long companyId) {
        return membershipRepository.findByCompany_IdOrderByUser_FirstNameAscUser_LastNameAsc(companyId).stream()
            .anyMatch(m -> m.getUser().getRole() == User.Role.DEV);
    }

    private DevUserAggregateResponse toUserAggregate(User user) {
        List<DevMembershipLink> links = membershipRepository.findByUser_IdOrderByCompany_NameAsc(user.getId()).stream()
            .map(m -> new DevMembershipLink(
                m.getId(),
                m.getCompany().getId(),
                m.getCompany().getName(),
                m.getRole().name()
            ))
            .toList();
        return new DevUserAggregateResponse(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            user.getNationalId(),
            user.getJobTitle(),
            user.getWorkScheduleNote(),
            user.isActive(),
            user.getAvatarUrl(),
            user.getRole().name(),
            user.getLastSeenAt() != null ? user.getLastSeenAt().toString() : null,
            user.getCompany() != null ? user.getCompany().getId() : null,
            links
        );
    }

    private static DevCompanySummaryResponse toCompanySummary(Company c, int membershipCount) {
        return new DevCompanySummaryResponse(
            c.getId(),
            c.getName(),
            c.getTaxId(),
            c.getCity(),
            c.getCountry(),
            c.getSubscriptionTier() != null ? c.getSubscriptionTier().name() : null,
            c.getBusinessEmail(),
            c.getBusinessPhone(),
            c.getAddressLine(),
            membershipCount
        );
    }

    private void applyCompanyFields(Company c, DevCompanyUpsertRequest req) {
        c.setName(req.name().trim());
        c.setTaxId(blankToNull(req.taxId()));
        c.setCity(blankToNull(req.city()));
        if (req.country() != null && !req.country().isBlank()) {
            c.setCountry(req.country().trim().toUpperCase());
        }
        c.setBusinessEmail(blankToNull(req.businessEmail()));
        c.setBusinessPhone(blankToNull(req.businessPhone()));
        c.setAddressLine(blankToNull(req.addressLine()));
        if (req.subscriptionTier() != null && !req.subscriptionTier().isBlank()) {
            try {
                c.setSubscriptionTier(Company.SubscriptionTier.valueOf(req.subscriptionTier().trim().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan inválido (FREE o PREMIUM)");
            }
        }
    }

    private static MutableUserAgg fromUser(User u) {
        MutableUserAgg a = new MutableUserAgg();
        a.userId = u.getId();
        a.email = u.getEmail();
        a.firstName = u.getFirstName();
        a.lastName = u.getLastName();
        a.nationalId = u.getNationalId();
        a.jobTitle = u.getJobTitle();
        a.workScheduleNote = u.getWorkScheduleNote();
        a.active = u.isActive();
        a.avatarUrl = u.getAvatarUrl();
        a.globalRole = u.getRole().name();
        a.lastSeenAt = u.getLastSeenAt() != null ? u.getLastSeenAt().toString() : null;
        a.primaryCompanyId = u.getCompany() != null ? u.getCompany().getId() : null;
        a.memberships = new ArrayList<>();
        return a;
    }

    private static final class MutableUserAgg {
        long userId;
        String email;
        String firstName;
        String lastName;
        String nationalId;
        String jobTitle;
        String workScheduleNote;
        boolean active;
        String avatarUrl;
        String globalRole;
        String lastSeenAt;
        Long primaryCompanyId;
        List<DevMembershipLink> memberships;

        DevUserAggregateResponse toResponse() {
            return new DevUserAggregateResponse(
                userId, email, firstName, lastName, nationalId, jobTitle, workScheduleNote,
                active, avatarUrl, globalRole, lastSeenAt, primaryCompanyId, List.copyOf(memberships)
            );
        }
    }

    private User.Role resolveGlobalRole(String raw) {
        return switch (raw.toUpperCase()) {
            case "DEV" -> User.Role.DEV;
            case "OWNER" -> User.Role.OWNER;
            case "MANAGER" -> User.Role.MANAGER;
            case "SUPERVISOR" -> User.Role.SUPERVISOR;
            case "VIEWER" -> User.Role.VIEWER;
            case "EMPLOYEE", "STAFF" -> User.Role.EMPLOYEE;
            default -> User.Role.EMPLOYEE;
        };
    }

    private User.Role resolveMembershipRole(String raw) {
        User.Role r = resolveGlobalRole(raw);
        if (r == User.Role.DEV) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DEV no es válido como rol de membresía");
        }
        return r;
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
