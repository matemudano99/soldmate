package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Línea de comanda. Guarda snapshot de nombre/precio/IVA al añadirla, para que editar la carta
 * no altere el histórico de pedidos.
 */
@Entity
@Table(name = "tpv_order_lines")
@Data
@NoArgsConstructor
public class TpvOrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private TpvOrder order;

    /** Artículo de carta de origen (com.soldmate.tpv.MenuItem). */
    @Column(name = "menu_item_id")
    private Long menuItemId;

    /** Si es un modificador/combinado, id de la línea padre a la que acompaña. */
    @Column(name = "parent_line_id")
    private Long parentLineId;

    @Column(name = "name_snapshot", nullable = false, length = 160)
    private String nameSnapshot;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal qty = BigDecimal.ONE;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "vat_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal vatRate = new BigDecimal("10.00");

    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal = BigDecimal.ZERO;

    /** Descuento de la línea en % (0-100). 100 = invitado (gratis). El {@code lineTotal} ya lo refleja. */
    @Column(name = "discount_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPct = BigDecimal.ZERO;

    @Column(length = 200)
    private String note;

    @Column(nullable = false)
    private boolean voided = false;

    /** Combinado "de quita" (p. ej. "Sin cebolla"): sin precio, solo informa a cocina. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean removal = false;

    /** Snapshot: si esta línea va a cocina (para el ticket de cocina y el KDS, sin consultar la carta). */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean kitchen = false;

    /** KDS: si el cocinero ha marcado esta línea como hecha. */
    @Column(name = "kitchen_done", nullable = false, columnDefinition = "boolean default false")
    private boolean kitchenDone = false;
}
