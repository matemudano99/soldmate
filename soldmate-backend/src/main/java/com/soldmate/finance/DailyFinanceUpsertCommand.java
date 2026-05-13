package com.soldmate.finance;

import java.math.BigDecimal;
import java.util.List;

/**
 * Cierre de caja diario: efectivo apertura/cierre, ingresos por canal y gastos con detalle.
 */
public record DailyFinanceUpsertCommand(
        BigDecimal cashOpening,
        List<DailyFinanceIncomeChannel> incomeChannels,
        BigDecimal cashClosing,
        String notes,
        List<DailyFinanceExpenseLine> expenseLines
) {
    public DailyFinanceUpsertCommand {
        incomeChannels = incomeChannels == null ? List.of() : List.copyOf(incomeChannels);
        expenseLines = expenseLines == null ? List.of() : List.copyOf(expenseLines);
    }
}
