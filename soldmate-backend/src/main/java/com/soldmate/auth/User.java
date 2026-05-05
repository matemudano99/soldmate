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

    // firstName y lastName separados para mayor flexibilidad
    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    // OWNER: dueño del negocio (acceso total)
    // MANAGER: encargado/supervisor (gestión operativa)
    // EMPLOYEE: operario base (acceso limitado)
    // STAFF: rol legado (compatibilidad con datos antiguos)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.EMPLOYEE;

    // ManyToOne: muchos usuarios pertenecen a una empresa
    // FetchType.LAZY: no carga la empresa hasta que se acceda a ella (más eficiente)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    public enum Role {
        OWNER, MANAGER, EMPLOYEE, STAFF
    }
}
