package com.soldmate.finance;

import java.util.List;

public record DailyFinanceUpsertResult(DailyFinanceEntry entry, List<String> warnings) {
}
