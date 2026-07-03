package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Artículo de carta. El precio es BRUTO (IVA incluido), convención de hostelería.
 * El descuento de stock se resuelve por escandallo ({@link MenuItemIngredient}) o, si no hay receta,
 * por {@code sellsAsProductId} (el artículo "es" un producto stockado, p. ej. una botella).
 */
@Entity
@Table(name = "tpv_menu_items")
@Data
@NoArgsConstructor
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private MenuCategory category;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "vat_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal vatRate = new BigDecimal("10.00");

    /** Opcional: el artículo se vende como este producto de inventario (descuenta 1 ud por unidad vendida). */
    @Column(name = "sells_as_product_id")
    private Long sellsAsProductId;

    @Column(nullable = false)
    private boolean active = true;

    /** Si admite combinados (salsas/extras), al añadirlo se abre la hoja de modificadores. */
    @Column(name = "allows_modifiers", nullable = false)
    private boolean allowsModifiers = false;

    /** Si el artículo debe aparecer en el ticket de cocina (platos a preparar). */
    @Column(nullable = false)
    private boolean kitchen = false;

    /** Disponible para la venta. Si es false está "agotado" y no se puede añadir a una comanda. */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean available = true;

    /** Si se marca solo como agotado cuando su stock vinculado (producto/escandallo) llega a 0. */
    @Column(name = "auto_sold_out", nullable = false, columnDefinition = "boolean default false")
    private boolean autoSoldOut = false;

    /**
     * Variantes de tamaño en JSON (p. ej. Simple/Doble). Si está presente, el artículo es un único
     * producto y el tamaño elegido fija el precio. Formato:
     * {@code [{"label":"Simple","price":10.90},{"label":"Doble","price":12.90}]}.
     */
    @Column(name = "variants_json", columnDefinition = "TEXT")
    private String variantsJson;

    /** Grupos de combinados aplicables (JSON array de ids de categoría). NULL/vacío = todos. */
    @Column(name = "modifier_groups_json", columnDefinition = "TEXT")
    private String modifierGroupsJson;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
