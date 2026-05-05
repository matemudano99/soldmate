package com.soldmate.company;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Company: representa un restaurante, bar o cafetería.
 *
 * En un sistema multi-tenant, Company es el "inquilino".
 * Todos los demás datos pertenecen a una Company a través de company_id.
 *
 * @Entity   → JPA creará la tabla "companies" en PostgreSQL
 * @Data     → Lombok genera getters, setters, toString, equals, hashCode
 * @NoArgsConstructor → JPA requiere un constructor sin argumentos
 */
@Entity
@Table(name = "companies")
@Data
@NoArgsConstructor
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // autoincrement
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "business_phone")
    private String businessPhone;

    @Column(name = "business_email")
    private String businessEmail;

    @Column(name = "address_line")
    private String addressLine;

    private String city;

    @Column(name = "postal_code")
    private String postalCode;

    @Column
    private String timezone = "Europe/Madrid";

    private Double latitude;

    private Double longitude;

    @Column(name = "opening_hours_json", columnDefinition = "TEXT")
    private String openingHoursJson;

    // NIF o CIF de la empresa (ej: "B12345678")
    @Column(name = "tax_id")
    private String taxId;

    // Código de país ISO 3166-1 alpha-2 (ej: "ES", "FR")
    @Column(nullable = false, length = 2)
    private String country = "ES";

    // Moneda ISO 4217 (ej: "EUR", "USD")
    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    // @Enumerated(STRING): guarda "FREE" o "PREMIUM" como texto,
    // no como número (0, 1). Más legible en la base de datos.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubscriptionTier subscriptionTier = SubscriptionTier.FREE;

    public enum SubscriptionTier {
        FREE, PREMIUM
    }
}
