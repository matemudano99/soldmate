package com.soldmate.inventory;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "current_stock", nullable = false, precision = 10, scale = 3)
    private BigDecimal currentStock = BigDecimal.ZERO;

    @Column(name = "min_stock", nullable = false, precision = 10, scale = 3)
    private BigDecimal minStock = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Unit unit = Unit.UNIT;

    private String category;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "vat_rate", precision = 5, scale = 2)
    private BigDecimal vatRate = new BigDecimal("10.00");

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    /** Stock bajo solo si el actual es estrictamente menor que el mínimo (igual al mínimo = OK). */
    public boolean isLowStock() {
        return currentStock.compareTo(minStock) < 0;
    }

    public enum Unit { KG, L, UNIT, BOX }
}
