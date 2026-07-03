package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Mesa del plano de sala. Su posición ({@code posX}/{@code posY}) y tamaño son editables desde el
 * plano del TPV. El estado (libre/ocupada) no se almacena: se deriva de si existe una comanda
 * {@code OPEN} con este {@code table_id}.
 */
@Entity
@Table(name = "tpv_tables")
@Data
@NoArgsConstructor
public class TpvTable {

    public enum Shape { RECT, ROUND }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false, length = 60)
    private String label;

    @Column(nullable = false, length = 60)
    private String zone = "Salón";

    @Column(nullable = false)
    private int seats = 4;

    @Column(name = "pos_x", nullable = false)
    private int posX = 40;

    @Column(name = "pos_y", nullable = false)
    private int posY = 40;

    @Column(nullable = false)
    private int width = 90;

    @Column(nullable = false)
    private int height = 90;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Shape shape = Shape.RECT;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
