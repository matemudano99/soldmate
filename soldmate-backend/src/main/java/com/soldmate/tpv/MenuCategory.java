package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Categoría de carta del TPV (p. ej. Bebidas, Raciones, Postres). */
@Entity
@Table(name = "tpv_menu_categories")
@Data
@NoArgsConstructor
public class MenuCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(length = 16)
    private String color;

    @Column(nullable = false)
    private boolean active = true;

    /** Grupo de modificadores (salsas/extras): no aparece como pestaña principal, sino en combinados. */
    @Column(name = "is_modifier_group", nullable = false)
    private boolean modifierGroup = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
