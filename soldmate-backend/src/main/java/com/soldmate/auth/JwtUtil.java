package com.soldmate.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.util.Date;

/**
 * JwtUtil: crea y valida tokens JWT.
 *
 * Un JWT tiene 3 partes: header.payload.signature
 * En el payload guardamos claims (datos del usuario):
 *   sub       → email del usuario
 *   companyId → empresa a la que pertenece
 *   role      → OWNER, MANAGER o EMPLOYEE
 *   tier      → FREE o PREMIUM
 */
@Component
public class JwtUtil {

    @Value("${soldmate.jwt.secret}")
    private String secret;

    @Value("${soldmate.jwt.expiration}")
    private long expirationMs;

    /** Convierte el secreto (String) en clave criptográfica segura. */
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Genera un token JWT para el usuario autenticado.
     * Este token se envía al frontend y debe incluirse en
     * cada petición como: Authorization: Bearer <token>
     */
    public String generateToken(String email, Long companyId, String role, String tier) {
        Date now    = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("companyId", companyId)
                .claim("role", role)
                .claim("tier", tier)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Extrae todos los datos del token.
     * Lanza excepción automáticamente si el token es inválido o ha caducado.
     */
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token)     { return extractAllClaims(token).getSubject(); }

    /**
     * El claim companyId puede llegar como Integer o Long según cómo se serializó el JWT;
     * normalizamos a Long para evitar ClassCastException en runtime.
     */
    public Long extractCompanyId(String token) {
        Claims claims = extractAllClaims(token);
        Object raw = claims.get("companyId");
        if (raw == null) {
            return null;
        }
        if (raw instanceof Long l) {
            return l;
        }
        if (raw instanceof Integer i) {
            return i.longValue();
        }
        if (raw instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(String.valueOf(raw));
    }
    public String extractRole(String token)      { return extractAllClaims(token).get("role", String.class); }
    public String extractTier(String token)      { return extractAllClaims(token).get("tier", String.class); }

    /** Devuelve true si el token no ha caducado y la firma es correcta. */
    public boolean isTokenValid(String token) {
        try {
            return extractAllClaims(token).getExpiration().after(new Date());
        } catch (Exception e) {
            // Token malformado, firma incorrecta, caducado → false
            return false;
        }
    }
}
