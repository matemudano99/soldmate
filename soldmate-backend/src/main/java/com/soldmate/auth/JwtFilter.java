package com.soldmate.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * JwtFilter: intercepta CADA petición HTTP y valida el JWT.
 *
 * Flujo de una petición autenticada:
 *  1. Frontend envía: GET /api/v1/inventory
 *     con header: Authorization: Bearer eyJhbGci...
 *  2. Este filtro lee el header, extrae el token
 *  3. Valida la firma y que no haya caducado
 *  4. Registra al usuario en el SecurityContext
 *  5. Spring Security permite el acceso al endpoint
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserPresenceService userPresenceService;

    public JwtFilter(JwtUtil jwtUtil, UserPresenceService userPresenceService) {
        this.jwtUtil = jwtUtil;
        this.userPresenceService = userPresenceService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // Sin header o sin "Bearer " → pasamos sin autenticar
        // (Spring Security rechazará si el endpoint requiere autenticación)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Eliminamos el prefijo "Bearer " (7 caracteres)
        String token = authHeader.substring(7);

        if (jwtUtil.isTokenValid(token)) {
            String email = jwtUtil.extractEmail(token);
            String role  = jwtUtil.extractRole(token);

            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
            // DEV: operador de plataforma con permisos de OWNER en el tenant activo (soporte).
            if ("DEV".equalsIgnoreCase(role)) {
                authorities.add(new SimpleGrantedAuthority("ROLE_OWNER"));
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(email, null, authorities);

            SecurityContextHolder.getContext().setAuthentication(authToken);
            try {
                userPresenceService.touchIfNeeded(email);
            } catch (Exception ignored) {
                // Presencia es best-effort; no bloquear la petición.
            }
        }

        // Continuamos con el siguiente filtro de la cadena
        filterChain.doFilter(request, response);
    }
}
