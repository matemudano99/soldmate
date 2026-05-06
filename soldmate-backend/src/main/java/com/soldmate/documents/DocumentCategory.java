package com.soldmate.documents;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DocumentCategory: categorías de documentos (p. ej. "Contratos", "Facturas", "RRHH").
 *
 * Multi-tenant: cada empresa tiene sus propias categorías.
 * Si la empresa no tiene ninguna, el frontend muestra las por defecto.
 */
@Entity
@Table(name = "document_categories",
       uniqueConstraints = @UniqueConstraint(columnNames = {"company_id", "name"}))
@Data
@NoArgsConstructor
public class DocumentCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column
    private String color; // hex o clase de Tailwind, ej: "#4f6ef7"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;
}
