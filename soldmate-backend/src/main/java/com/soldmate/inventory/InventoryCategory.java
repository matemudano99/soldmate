package com.soldmate.inventory;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Categoría de inventario por empresa (solo nombre y orden).
 * Los productos guardan el nombre en {@link Product#getCategory()}; el proveedor va en {@link Product#getSupplier()}.
 */
@Entity
@Table(name = "inventory_categories")
@Data
@NoArgsConstructor
public class InventoryCategory {

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
}
