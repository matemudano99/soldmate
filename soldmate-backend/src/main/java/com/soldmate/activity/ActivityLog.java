package com.soldmate.activity;

import com.soldmate.auth.User;
import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "activity_logs")
@Data
@NoArgsConstructor
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Ej: INCIDENT, DOCUMENT, SUPPLIER, USER, TASK, PRODUCT */
    @Column(name = "entity_type", nullable = false)
    private String entityType;

    /** Ej: CREADO, MODIFICADO, ELIMINADO */
    @Column(nullable = false)
    private String action;

    /** Ej: "Factura de luz", "Juan Pérez", etc. */
    @Column(nullable = false)
    private String title;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Opcional: El email del actor que realizó la acción, en caso de que el usuario ya haya sido eliminado */
    @Column(name = "actor_email")
    private String actorEmail;

    /** Opcional: El nombre del actor (para no depender de que el User siga existiendo) */
    @Column(name = "actor_name")
    private String actorName;

    /** El usuario que realizó la acción. Puede ser nulo si el usuario fue borrado. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    public ActivityLog(Company company, User actor, String actorName, String actorEmail, String entityType, String action, String title) {
        this.company = company;
        this.actor = actor;
        this.actorName = actorName;
        this.actorEmail = actorEmail;
        this.entityType = entityType;
        this.action = action;
        this.title = title;
        this.createdAt = LocalDateTime.now();
    }
}
