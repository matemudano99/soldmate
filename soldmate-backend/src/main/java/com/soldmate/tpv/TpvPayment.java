package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/** Pago de una comanda. Una comanda puede tener varios (cuenta dividida, efectivo + tarjeta). */
@Entity
@Table(name = "tpv_payments")
@Data
@NoArgsConstructor
public class TpvPayment {

    public enum Method { CASH, CARD, TRANSFER, OTHER, DELIVERY_PLATFORM }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private TpvOrder order;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Method method = Method.CASH;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal tip = BigDecimal.ZERO;

    @Column(name = "change_given", nullable = false, precision = 12, scale = 2)
    private BigDecimal changeGiven = BigDecimal.ZERO;

    /** Para method=DELIVERY_PLATFORM: "Just Eat" / "Glovo" / "Uber Eats" → casa el canal de Finanzas. */
    @Column(length = 32)
    private String platform;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
