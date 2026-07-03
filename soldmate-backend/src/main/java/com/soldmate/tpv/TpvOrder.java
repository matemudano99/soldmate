package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Comanda/pedido del TPV. En Fase 1 el ciclo usado es OPEN → PAID (o VOID); el resto de estados
 * quedan reservados para la gestión de sala (Fase 2). {@code businessDay} se resuelve con la zona
 * horaria de la empresa para que una venta de madrugada cuente en el día correcto del cierre Z.
 */
@Entity
@Table(name = "tpv_orders")
@Data
@NoArgsConstructor
public class TpvOrder {

    public enum Status { OPEN, IN_PROGRESS, SERVED, BILLED, PAID, CLOSED, VOID }

    public enum Channel { DINE_IN, TAKEAWAY, DELIVERY }

    /** Estado de la comanda en cocina (KDS). NONE = sin platos de cocina / no enviada. */
    public enum KitchenStatus { NONE, PENDING, PREPARING, READY, SERVED }

    /** Tipo de descuento de ticket. */
    public enum DiscountType { NONE, PERCENT, AMOUNT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Channel channel = Channel.DINE_IN;

    @Enumerated(EnumType.STRING)
    @Column(name = "kitchen_status", nullable = false, length = 12)
    private KitchenStatus kitchenStatus = KitchenStatus.NONE;

    @Column(name = "business_day", nullable = false)
    private LocalDate businessDay;

    /** Mesa asociada (solo DINE_IN). Null para barra/llevar/domicilio. */
    @Column(name = "table_id")
    private Long tableId;

    /** Cliente del fichero (opcional). Para llevar/domicilio: enlaza con sus datos de facturación. */
    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "customer_name", length = 160)
    private String customerName;

    @Column(name = "customer_phone", length = 40)
    private String customerPhone;

    @Column(name = "customer_address", length = 300)
    private String customerAddress;

    @Column(name = "opened_by", length = 255)
    private String openedBy;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt = Instant.now();

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 10)
    private DiscountType discountType = DiscountType.NONE;

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountValue = BigDecimal.ZERO;

    @Column(name = "discount_reason", length = 200)
    private String discountReason;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        if (openedAt == null) {
            openedAt = Instant.now();
        }
    }
}
