package com.soldmate.shifts;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Planificación de turnos por día: cobertura prevista (nombre de turno + personal requerido).
 * Mapea la tabla {@code shift_plans} creada en el versionador de esquema (paso 004).
 */
@Entity
@Table(name = "shift_plans")
@Data
@NoArgsConstructor
public class ShiftPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate;

    @Column(name = "shift_name", nullable = false, length = 120)
    private String shiftName;

    @Column(name = "staff_required", nullable = false)
    private int staffRequired = 2;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
