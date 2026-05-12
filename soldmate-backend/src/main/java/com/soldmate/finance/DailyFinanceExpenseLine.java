package com.soldmate.finance;

import java.math.BigDecimal;

/** Línea de gasto/sueldo en el cierre de caja (persistida en JSON). */
public record DailyFinanceExpenseLine(String detail, BigDecimal amount) {}
