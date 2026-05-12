package com.soldmate.finance;

import java.math.BigDecimal;
import java.util.List;

/**
 * Cierre de caja diario: efectivo apertura/cierre, ingresos por canal y gastos con detalle.
 */
public record DailyFinanceUpsertCommand(
        BigDecimal cashOpening,
        BigDecimal incomeDataphone,
        BigDecimal incomeJustEat,
        BigDecimal incomeGlovo,
        BigDecimal incomeUberEats,
        BigDecimal cashClosing,
        String notes,
        List<DailyFinanceExpenseLine> expenseLines
) {
    public DailyFinanceUpsertCommand {
        expenseLines = expenseLines == null ? List.of() : List.copyOf(expenseLines);
    }
}
