package com.soldmate.auth;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.company.CompanySettingsService;
import com.soldmate.company.NifCifValidator;
import com.soldmate.storage.SupabaseStorageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.Map;

/**
 * AuthController: registro y login.
 *
 * Diferencia respecto a la versión anterior:
 *   - Al registrar, llamamos a settingsService.createDefaultSettings(company)
 *     para que cada empresa nueva tenga sus ajustes de IVA y categorías listos.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserRepository          userRepository;
    private final CompanyRepository       companyRepository;
    private final PasswordEncoder         passwordEncoder;
    private final JwtUtil                 jwtUtil;
    private final AuthRateLimiter         authRateLimiter;
    private final NifCifValidator         nifCifValidator;
    private final CompanySettingsService  settingsService;
    private final SupabaseStorageService  storageService;

    public AuthController(UserRepository userRepository,
                          CompanyRepository companyRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          AuthRateLimiter authRateLimiter,
                          NifCifValidator nifCifValidator,
                          CompanySettingsService settingsService,
                          SupabaseStorageService storageService) {
        this.userRepository   = userRepository;
        this.companyRepository = companyRepository;
        this.passwordEncoder  = passwordEncoder;
        this.jwtUtil          = jwtUtil;
        this.authRateLimiter  = authRateLimiter;
        this.nifCifValidator  = nifCifValidator;
        this.settingsService  = settingsService;
        this.storageService   = storageService;
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

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

    public record AuthResponse(
        String token,
        String email,
        String role,
        String tier,
        Long   companyId,
        String firstName,
        String lastName,
        String avatarUrl
    ) {}

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


        // 1. Validar NIF/CIF para empresas españolas
        if (!nifCifValidator.isValid(req.taxId(), req.country())) {
            return ResponseEntity.badRequest()
                .body("NIF/CIF inválido para el país: " + req.country());
        }

        // 2. Email único
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("Ya existe un usuario con ese email");
        }

        // 3. Crear empresa
        Company company = new Company();
        company.setName(req.companyName());
        company.setTaxId(req.taxId().toUpperCase().trim());
        company.setCountry(req.country().toUpperCase());
        company.setCurrency("EUR"); // por ahora EUR por defecto
        companyRepository.save(company);

        // 4. Crear ajustes por defecto (IVA, categorías, estados de pedido)
        // Esto se ejecuta dentro de una transacción: si falla, se deshace todo
        settingsService.createDefaultSettings(company);

        // 5. Crear usuario dueño
        User user = new User();
        user.setEmail(req.email().toLowerCase().trim());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setRole(User.Role.OWNER);
        user.setCompany(company);
        userRepository.save(user);

        // 6. Generar JWT y responder
        String token = jwtUtil.generateToken(
            user.getEmail(),
            company.getId(),
            user.getRole().name(),
            company.getSubscriptionTier().name()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(
            new AuthResponse(token, user.getEmail(), user.getRole().name(),
                             company.getSubscriptionTier().name(), company.getId(),
                             user.getFirstName(), user.getLastName(), user.getAvatarUrl())
        );
    }

    // ─── POST /api/v1/auth/login ─────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpRequest) {
        if (!authRateLimiter.allowLogin(clientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body("Demasiados intentos de login. Inténtalo de nuevo en unos minutos.");
        }
        User user = userRepository.findByEmail(req.email().toLowerCase().trim())
            .orElse(null);

        // Mismo mensaje para email y contraseña incorrectos (evita enumeración)
        if (user == null || !passwordEncoder.matches(req.password(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Credenciales incorrectas");
        }

        Company company = user.getCompany();
        String token = jwtUtil.generateToken(
            user.getEmail(),
            company.getId(),
            user.getRole().name(),
            company.getSubscriptionTier().name()
        );

        return ResponseEntity.ok(
            new AuthResponse(token, user.getEmail(), user.getRole().name(),
                             company.getSubscriptionTier().name(), company.getId(),
                             user.getFirstName(), user.getLastName(), user.getAvatarUrl())
        );
    }

    // ─── GET /api/v1/auth/me ─────────────────────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader("Authorization") String authHeader) {
        String email = jwtUtil.extractEmail(authHeader.substring(7));
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        Company company = user.getCompany();
        return ResponseEntity.ok(
            new AuthResponse(
                authHeader.substring(7),
                user.getEmail(),
                user.getRole().name(),
                company.getSubscriptionTier().name(),
                company.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl()
            )
        );
    }

    // ─── PUT /api/v1/auth/profile ────────────────────────────────────────────

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody UpdateProfileRequest req
    ) {
        String email = jwtUtil.extractEmail(authHeader.substring(7));
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        userRepository.save(user);

        Company company = user.getCompany();
        return ResponseEntity.ok(
            new AuthResponse(
                authHeader.substring(7),
                user.getEmail(),
                user.getRole().name(),
                company.getSubscriptionTier().name(),
                company.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl()
            )
        );
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAvatar(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam("photo") MultipartFile photo
    ) {
        String email = jwtUtil.extractEmail(authHeader.substring(7));
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

        try {
            String avatarUrl = storageService.upload(photo, user.getCompany().getId(), ".jpg", "incidents", "avatars");
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
