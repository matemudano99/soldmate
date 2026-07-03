package com.soldmate.tpv;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Cliente del TPV (consumidor final). Se usa para autocompletar pedidos a domicilio/recoger y para
 * guardar datos de facturación (NIF, dirección). Sólo {@code name} y {@code phone} son obligatorios.
 */
@Entity
@Table(name = "tpv_customers")
@Data
@NoArgsConstructor
public class TpvCustomer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 40)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(length = 300)
    private String address;

    @Column(length = 120)
    private String city;

    @Column(name = "postal_code", length = 16)
    private String postalCode;

    @Column(name = "tax_id", length = 32)
    private String taxId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
