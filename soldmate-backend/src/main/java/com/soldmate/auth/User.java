package com.soldmate.auth;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User: empleado de un restaurante / bar.
 *
 * La relación con Company es ManyToOne:
 *   muchos usuarios → una empresa
 *
 * El campo company_id en la tabla apunta a la empresa.
 * En el JWT guardamos este id para filtrar datos por empresa
 * sin necesidad de consultar la base de datos en cada petición.
 */
@Entity
@Table(name = "users",
       uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    // Guardamos el hash BCrypt, nunca la contraseña real
    @Column(nullable = false)
    private String password;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    /** DNI/NIE u otro documento nacional; no es clave ni identificador de login. */
    @Column(name = "national_id", length = 32)
    private String nationalId;

    /** Puesto o área operativa (texto libre); la autorización real va en {@link #role}. */
    @Column(name = "job_title", length = 160)
    private String jobTitle;

    /** Nota de horario habitual (MVP; sin motor de turnos). */
    @Column(name = "work_schedule_note", length = 512)
    private String workScheduleNote;

    /** Si false, no puede iniciar sesión. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "last_seen_at")
    private java.time.Instant lastSeenAt;

    /**
     * Rol global del usuario (columna users.role).
     * DEV: operador de plataforma (consola multi-tenant); el JWT usa DEV si está aquí.
     * Resto: rol por defecto; en sesión normal manda la membresía del negocio activo.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.EMPLOYEE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    public enum Role {
        DEV,
        OWNER,
        MANAGER,
        SUPERVISOR,
        EMPLOYEE,
        VIEWER
    }

    /** Roles asignables en {@code user_company_memberships} (sin DEV). */
    public static boolean isTenantMembershipRole(Role r) {
        return r != null && r != Role.DEV;
    }
}
