package com.soldmate.inventory;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Supplier: proveedor de productos para el restaurante.
 *
 * Un proveedor está asociado a una empresa (multi-tenant).
 * La categoría es de texto libre: "Frutas y verduras", "Cárnicos", etc.
 * En el futuro podría vincularse con CompanySettings.CATEGORY.
 */
@Entity
@Table(name = "suppliers")
@Data
@NoArgsConstructor
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "contact_person")
    private String contactPerson;  // nombre del comercial

    private String category;       // ej: "Frutas y verduras"

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "supplier_type", nullable = false)
    private SupplierType supplierType = SupplierType.SUPPLIER;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    public enum SupplierType { SUPPLIER, CONTACT }
}
