package com.soldmate.auth;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.company.CompanySettingsService;
import com.soldmate.company.NifCifValidator;
import com.soldmate.storage.SupabaseStorageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * AuthController: registro, login y cambio de negocio activo (JWT con otro {@code companyId}).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final UserCompanyMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthRateLimiter authRateLimiter;
    private final NifCifValidator nifCifValidator;
    private final CompanySettingsService settingsService;
    private final SupabaseStorageService storageService;

    public AuthController(UserRepository userRepository,
                          CompanyRepository companyRepository,
                          UserCompanyMembershipRepository membershipRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          AuthRateLimiter authRateLimiter,
                          NifCifValidator nifCifValidator,
                          CompanySettingsService settingsService,
                          SupabaseStorageService storageService) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authRateLimiter = authRateLimiter;
        this.nifCifValidator = nifCifValidator;
        this.settingsService = settingsService;
        this.storageService = storageService;
    }

    public record RegisterRequest(
        @NotBlank String companyName,
        @NotBlank String taxId,
        @NotBlank @Size(min = 2, max = 2) String country,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password,
        String firstName,
        String lastName
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record UpdateProfileRequest(
        @NotBlank String firstName,
        @NotBlank String lastName
    ) {}

    public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8) String newPassword
    ) {}

    public record LinkedCompany(long companyId, String companyName, String role) {}

    public record AuthResponse(
        String token,
        String email,
        String role,
        String tier,
        Long companyId,
        String firstName,
        String lastName,
        String avatarUrl,
        List<LinkedCompany> linkedCompanies
    ) {}

    public record SwitchCompanyRequest(@NotNull Long companyId) {}

    private List<LinkedCompany> linkedCompaniesFor(User user) {
        return membershipRepository.findByUser_IdOrderByCompany_NameAsc(user.getId()).stream()
            .map(m -> new LinkedCompany(m.getCompany().getId(), m.getCompany().getName(), m.getRole().name()))
            .toList();
    }

    private UserCompanyMembership membershipForActiveCompany(User user) {
        Long companyId = user.getCompany().getId();
        return membershipRepository.findByUser_IdAndCompany_Id(user.getId(), companyId)
            .orElseThrow(() -> new IllegalStateException("Usuario sin membresía en el negocio principal"));
    }

    /** Rol en JWT: DEV es global en {@link User#getRole()}; si no, el de la membresía activa. */
    private String sessionRole(User user, UserCompanyMembership membership) {
        if (user.getRole() == User.Role.DEV) {
            return User.Role.DEV.name();
        }
        return membership.getRole().name();
    }

    private boolean userAlreadyHasCompanyNameIgnoreCase(User user, String companyName) {
        String n = companyName == null ? "" : companyName.trim();
        if (n.isEmpty()) {
            return false;
        }
        return membershipRepository.findByUser_IdOrderByCompany_NameAsc(user.getId()).stream()
            .map(m -> m.getCompany().getName())
            .filter(name -> name != null && !name.isBlank())
            .anyMatch(name -> name.trim().equalsIgnoreCase(n));
    }

    // ─── POST /api/v1/auth/register ──────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req, HttpServletRequest httpRequest) {
        if (!authRateLimiter.allowRegister(clientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body("Demasiados intentos de registro. Inténtalo de nuevo en unos minutos.");
        }
        if (!isPasswordStrong(req.password())) {
            return ResponseEntity.badRequest().body("La contraseña debe incluir mayúscula, minúscula y número.");
        }

        if (!nifCifValidator.isValid(req.taxId(), req.country())) {
            return ResponseEntity.badRequest()
                .body("NIF/CIF inválido para el país: " + req.country());
        }

        String normalizedTaxId = req.taxId().toUpperCase().trim();
        if (companyRepository.findByTaxId(normalizedTaxId).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("Ya existe un negocio registrado con ese NIF/CIF.");
        }

        String email = req.email().toLowerCase().trim();
        var existingUserOpt = userRepository.findByEmail(email);

        if (existingUserOpt.isPresent()) {
            User user = existingUserOpt.get();
            if (!passwordEncoder.matches(req.password(), user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("La contraseña no coincide con la cuenta de este email. Inténtalo de nuevo o recupera el acceso.");
            }
            if (userAlreadyHasCompanyNameIgnoreCase(user, req.companyName())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Ya tienes otro negocio vinculado con ese nombre comercial. Elige un nombre distinto.");
            }

            Company company = new Company();
            company.setName(req.companyName().trim());
            company.setTaxId(normalizedTaxId);
            company.setCountry(req.country().toUpperCase());
            company.setCurrency("EUR");
            companyRepository.save(company);

            settingsService.createDefaultSettings(company);

            membershipRepository.save(UserCompanyMembership.of(user, company, User.Role.OWNER));
            user.setCompany(company);
            if (req.firstName() != null && !req.firstName().isBlank()) {
                user.setFirstName(req.firstName().trim());
            }
            if (req.lastName() != null && !req.lastName().isBlank()) {
                user.setLastName(req.lastName().trim());
            }
            userRepository.save(user);

            UserCompanyMembership active = membershipForActiveCompany(user);
            String token = jwtUtil.generateToken(
                user.getEmail(),
                company.getId(),
                active.getRole().name(),
                company.getSubscriptionTier().name()
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(
                new AuthResponse(
                    token,
                    user.getEmail(),
                    active.getRole().name(),
                    company.getSubscriptionTier().name(),
                    company.getId(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getAvatarUrl(),
                    linkedCompaniesFor(user)
                )
            );
        }

        Company company = new Company();
        company.setName(req.companyName().trim());
        company.setTaxId(normalizedTaxId);
        company.setCountry(req.country().toUpperCase());
        company.setCurrency("EUR");
        companyRepository.save(company);

        settingsService.createDefaultSettings(company);

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setRole(User.Role.OWNER);
        user.setCompany(company);
        userRepository.save(user);

        membershipRepository.save(UserCompanyMembership.of(user, company, User.Role.OWNER));

        UserCompanyMembership active = membershipForActiveCompany(user);
        String token = jwtUtil.generateToken(
            user.getEmail(),
            company.getId(),
            active.getRole().name(),
            company.getSubscriptionTier().name()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(
            new AuthResponse(
                token,
                user.getEmail(),
                active.getRole().name(),
                company.getSubscriptionTier().name(),
                company.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                linkedCompaniesFor(user)
            )
        );
    }

    // ─── POST /api/v1/auth/login ─────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpRequest) {
        if (!authRateLimiter.allowLogin(clientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body("Demasiados intentos de login. Inténtalo de nuevo en unos minutos.");
        }
        User user = userRepository.findByEmail(req.email().toLowerCase().trim()).orElse(null);

        if (user == null || !passwordEncoder.matches(req.password(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Credenciales incorrectas");
        }

        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Cuenta desactivada. Contacta con el administrador.");
        }

        UserCompanyMembership active = membershipForActiveCompany(user);
        Company company = active.getCompany();
        String role = sessionRole(user, active);
        String token = jwtUtil.generateToken(
            user.getEmail(),
            company.getId(),
            role,
            company.getSubscriptionTier().name()
        );

        touchLastSeen(user);

        return ResponseEntity.ok(
            new AuthResponse(
                token,
                user.getEmail(),
                role,
                company.getSubscriptionTier().name(),
                company.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                linkedCompaniesFor(user)
            )
        );
    }

    // ─── POST /api/v1/auth/switch-company ────────────────────────────────────

    @PostMapping("/switch-company")
    public ResponseEntity<AuthResponse> switchCompany(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody SwitchCompanyRequest req
    ) {
        String tokenIn = authHeader.substring(7);
        String email = jwtUtil.extractEmail(tokenIn);
        User user = userRepository.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cuenta desactivada");
        }

        UserCompanyMembership mem = membershipRepository.findByUser_IdAndCompany_Id(user.getId(), req.companyId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Sin acceso a ese negocio"));

        Company company = mem.getCompany();
        String role = sessionRole(user, mem);
        String newToken = jwtUtil.generateToken(
            user.getEmail(),
            company.getId(),
            role,
            company.getSubscriptionTier().name()
        );

        touchLastSeen(user);

        return ResponseEntity.ok(
            new AuthResponse(
                newToken,
                user.getEmail(),
                role,
                company.getSubscriptionTier().name(),
                company.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                linkedCompaniesFor(user)
            )
        );
    }

    // ─── GET /api/v1/auth/me ─────────────────────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Cuenta desactivada");
        }

        Long companyId = jwtUtil.extractCompanyId(token);
        UserCompanyMembership mem = membershipRepository.findByUser_IdAndCompany_Id(user.getId(), companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión inválida para el negocio"));

        return ResponseEntity.ok(
            new AuthResponse(
                token,
                user.getEmail(),
                sessionRole(user, mem),
                mem.getCompany().getSubscriptionTier().name(),
                companyId,
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                linkedCompaniesFor(user)
            )
        );
    }

    // ─── PUT /api/v1/auth/profile ────────────────────────────────────────────

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody UpdateProfileRequest req
    ) {
        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        userRepository.save(user);

        Long companyId = jwtUtil.extractCompanyId(token);
        UserCompanyMembership mem = membershipRepository.findByUser_IdAndCompany_Id(user.getId(), companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        return ResponseEntity.ok(
            new AuthResponse(
                token,
                user.getEmail(),
                sessionRole(user, mem),
                mem.getCompany().getSubscriptionTier().name(),
                companyId,
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                linkedCompaniesFor(user)
            )
        );
    }

    // ─── PUT /api/v1/auth/password ───────────────────────────────────────────

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody ChangePasswordRequest req
    ) {
        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!passwordEncoder.matches(req.currentPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("La contraseña actual no es correcta.");
        }
        if (!isPasswordStrong(req.newPassword())) {
            return ResponseEntity.badRequest()
                .body("La nueva contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.");
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body("La nueva contraseña debe ser distinta de la actual.");
        }
        user.setPassword(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAvatar(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam("photo") MultipartFile photo
    ) {
        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        String contentType = photo.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body("Solo se permiten archivos de imagen");
        }
        if (photo.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest().body("La imagen no puede superar 5 MB");
        }

        Long companyId = jwtUtil.extractCompanyId(token);

        try {
            String avatarUrl = storageService.upload(photo, companyId, ".jpg", "incidents", "avatars");
            user.setAvatarUrl(avatarUrl);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("avatarUrl", avatarUrl));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error al subir la imagen: " + e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body("Almacenamiento: " + e.getMessage());
        }
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        touchLastSeen(user);
        return ResponseEntity.ok().build();
    }

    private void touchLastSeen(User user) {
        user.setLastSeenAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    private static boolean isPasswordStrong(String password) {
        if (password == null || password.length() < 8) return false;
        boolean hasUpper = false, hasLower = false, hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isUpperCase(c)) hasUpper = true;
            else if (Character.isLowerCase(c)) hasLower = true;
            else if (Character.isDigit(c)) hasDigit = true;
        }
        return hasUpper && hasLower && hasDigit;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
