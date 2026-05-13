package com.soldmate.auth;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final UserCompanyMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final com.soldmate.activity.ActivityLogger activityLogger;

    public UserController(UserRepository userRepository,
                          CompanyRepository companyRepository,
                          UserCompanyMembershipRepository membershipRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          com.soldmate.activity.ActivityLogger activityLogger) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.activityLogger = activityLogger;
    }

    public record UserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        String fullName,
        String role,
        String avatarUrl
    ) {
        static UserResponse from(User u, User.Role roleInCompany) {
            String full = ((u.getFirstName() != null ? u.getFirstName() : "") + " " + (u.getLastName() != null ? u.getLastName() : "")).trim();
            return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getFirstName(),
                u.getLastName(),
                full,
                roleInCompany.name(),
                u.getAvatarUrl()
            );
        }
    }

    public record CreateUserRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        String role,
        String avatarUrl,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password
    ) {}

    public record UpdateUserRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        String role,
        String avatarUrl
    ) {}

    @GetMapping
    public ResponseEntity<List<UserResponse>> getUsers(@RequestHeader("Authorization") String authHeader) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        List<UserResponse> users = membershipRepository.findByCompany_IdOrderByUser_FirstNameAscUser_LastNameAsc(companyId)
            .stream()
            .map(m -> UserResponse.from(m.getUser(), m.getRole()))
            .toList();
        return ResponseEntity.ok(users);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<UserResponse> createUser(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody CreateUserRequest req
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        Company company = companyRepository.findById(companyId).orElseThrow();
        String email = req.email().toLowerCase().trim();
        User.Role role = resolveRole(req.role());

        var existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User user = existing.get();
            if (membershipRepository.existsByUser_IdAndCompany_Id(user.getId(), companyId)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }
            membershipRepository.save(UserCompanyMembership.of(user, company, role));
            activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "USER", "VINCULADO", user.getEmail());
            return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user, role));
        }

        String[] names = splitName(req.fullName());
        User user = new User();
        user.setCompany(company);
        user.setEmail(email);
        user.setFirstName(names[0]);
        user.setLastName(names[1]);
        user.setAvatarUrl(blankToNull(req.avatarUrl()));
        user.setRole(role);
        user.setPassword(passwordEncoder.encode(req.password().trim()));
        userRepository.save(user);
        membershipRepository.save(UserCompanyMembership.of(user, company, role));

        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "USER", "CREADO", user.getEmail());

        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user, role));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<UserResponse> updateUser(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @Valid @RequestBody UpdateUserRequest req
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        UserCompanyMembership membership = membershipRepository.findByUser_IdAndCompany_Id(id, companyId).orElse(null);
        if (membership == null) {
            return ResponseEntity.notFound().build();
        }

        User user = membership.getUser();
        String normalizedEmail = req.email().toLowerCase().trim();
        if (!normalizedEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(normalizedEmail)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        String[] names = splitName(req.fullName());
        user.setFirstName(names[0]);
        user.setLastName(names[1]);
        user.setEmail(normalizedEmail);
        user.setAvatarUrl(blankToNull(req.avatarUrl()));
        User.Role newRole = resolveRole(req.role());
        user.setRole(newRole);
        userRepository.save(user);

        membership.setRole(newRole);
        membershipRepository.save(membership);

        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "USER", "MODIFICADO", user.getEmail());

        return ResponseEntity.ok(UserResponse.from(user, newRole));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteUser(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        UserCompanyMembership membership = membershipRepository.findByUser_IdAndCompany_Id(id, companyId).orElse(null);
        if (membership == null) {
            return ResponseEntity.notFound().build();
        }

        User user = membership.getUser();
        membershipRepository.delete(membership);

        if (membershipRepository.countByUser_Id(user.getId()) == 0) {
            userRepository.delete(user);
        }

        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "USER", "ELIMINADO", user.getEmail());
        return ResponseEntity.noContent().build();
    }

    private User.Role resolveRole(String raw) {
        if (raw == null || raw.isBlank()) {
            return User.Role.EMPLOYEE;
        }
        return switch (raw.trim().toUpperCase()) {
            case "OWNER" -> User.Role.OWNER;
            case "MANAGER" -> User.Role.MANAGER;
            case "EMPLOYEE", "STAFF" -> User.Role.EMPLOYEE;
            default -> User.Role.EMPLOYEE;
        };
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new String[]{"Usuario", ""};
        }
        String[] names = fullName.trim().split("\\s+", 2);
        String first = names.length > 0 ? names[0] : "Usuario";
        String last = names.length > 1 ? names[1] : "";
        return new String[]{first, last};
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
