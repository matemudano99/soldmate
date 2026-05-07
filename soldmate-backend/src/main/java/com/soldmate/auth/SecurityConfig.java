package com.soldmate.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * SecurityConfig: configuración central de Spring Security.
 *
 * Conceptos clave para entender este archivo:
 *
 * STATELESS: el servidor no guarda sesiones. Cada petición lleva su propio JWT.
 *   → Ideal para APIs consumidas por apps móviles o React.
 *
 * CSRF desactivado: CSRF (Cross-Site Request Forgery) es un ataque contra
 *   aplicaciones que usan cookies de sesión. Como usamos JWT, no aplica.
 *
 * CORS: el navegador bloquea peticiones a dominios distintos por seguridad.
 *   → Necesitamos permitir explícitamente el frontend (localhost:3000, etc.)
 *
 * @EnableMethodSecurity: activa el uso de @PreAuthorize en los controllers.
 *   Ejemplo: @PreAuthorize("hasRole('OWNER')") sólo permite al dueño.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final String corsAllowedOrigins;

    public SecurityConfig(
        JwtFilter jwtFilter,
        @Value("${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:23000,http://localhost:8082,http://localhost:8081,http://localhost:19006,exp://localhost:19000,https://matemudano99.github.io}") String corsAllowedOrigins
    ) {
        this.jwtFilter = jwtFilter;
        this.corsAllowedOrigins = corsAllowedOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                .frameOptions(frame -> frame.deny())
                .xssProtection(xss -> xss.disable())
            )
            .authorizeHttpRequests(auth -> auth
                // Endpoints públicos de autenticación
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // Todo lo demás requiere JWT válido
                .anyRequest().authenticated()
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            // Añadimos nuestro JwtFilter ANTES del filtro estándar de autenticación
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * BCryptPasswordEncoder: algoritmo seguro para hashear contraseñas.
     *
     * IMPORTANTE: nunca guardes contraseñas en texto plano.
     * BCrypt convierte "miPass123" → "$2a$10$xyz..." de forma irreversible.
     * Para verificar, se comparan los hashes, no las contraseñas.
     *
     * Uso en un servicio:
     *   String hash = passwordEncoder.encode("miPass123");
     *   boolean ok  = passwordEncoder.matches("miPass123", hash);
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Configuración CORS para desarrollo local.
     * En producción cambia los orígenes por tu dominio real:
     *   config.setAllowedOrigins(List.of("https://soldmate.app"));
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> originPatterns = Arrays.stream(corsAllowedOrigins.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
        // setAllowedOriginPatterns permite comodines tipo https://*.vercel.app
        config.setAllowedOriginPatterns(originPatterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
