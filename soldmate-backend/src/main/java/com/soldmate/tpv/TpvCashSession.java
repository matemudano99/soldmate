package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Sesión de caja (arqueo): apertura con un fondo inicial y cierre con el efectivo contado,
 * calculando el efectivo esperado y el descuadre.
 */
@Entity
@Table(name = "tpv_cash_sessions")
@Data
@NoArgsConstructor
public class TpvCashSession {

    public enum Status { OPEN, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(name = "business_day", nullable = false)
    private LocalDate businessDay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Status status = Status.OPEN;

    @Column(name = "opening_float", nullable = false, precision = 12, scale = 2)
    private BigDecimal openingFloat = BigDecimal.ZERO;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt = Instant.now();

    @Column(name = "opened_by", length = 255)
    private String openedBy;

    @Column(name = "counted_cash", precision = 12, scale = 2)
    private BigDecimal countedCash;

    @Column(name = "expected_cash", precision = 12, scale = 2)
    private BigDecimal expectedCash;

    @Column(precision = 12, scale = 2)
    private BigDecimal difference;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "closed_by", length = 255)
    private String closedBy;

    @Column(length = 500)
    private String note;

    @PrePersist
    void onCreate() {
        if (openedAt == null) {
            openedAt = Instant.now();
        }
    }
}
