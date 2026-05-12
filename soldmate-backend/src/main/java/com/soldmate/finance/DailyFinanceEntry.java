package com.soldmate.finance;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "daily_finance_entries",
        uniqueConstraints = @UniqueConstraint(name = "ux_daily_finance_company_date", columnNames = {"company_id", "entry_date"})
)
@Data
@NoArgsConstructor
public class DailyFinanceEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    /** Suma de ingresos por datáfono + plataformas (sin efectivo apertura/cierre). */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal revenue = BigDecimal.ZERO;

    /** Suma de líneas de gastos/sueldos. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal expenses = BigDecimal.ZERO;

    @Column(name = "cash_opening", nullable = false, precision = 14, scale = 2)
    private BigDecimal cashOpening = BigDecimal.ZERO;

    @Column(name = "income_dataphone", nullable = false, precision = 14, scale = 2)
    private BigDecimal incomeDataphone = BigDecimal.ZERO;

    @Column(name = "income_just_eat", nullable = false, precision = 14, scale = 2)
    private BigDecimal incomeJustEat = BigDecimal.ZERO;

    @Column(name = "income_glovo", nullable = false, precision = 14, scale = 2)
    private BigDecimal incomeGlovo = BigDecimal.ZERO;

    @Column(name = "income_uber_eats", nullable = false, precision = 14, scale = 2)
    private BigDecimal incomeUberEats = BigDecimal.ZERO;

    @Column(name = "cash_closing", nullable = false, precision = 14, scale = 2)
    private BigDecimal cashClosing = BigDecimal.ZERO;

    @Column(name = "expense_lines_json", nullable = false, columnDefinition = "TEXT")
    private String expenseLinesJson = "[]";

    @Column(length = 500)
    private String notes;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", length = 255)
    private String updatedBy;
}
