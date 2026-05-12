package com.soldmate.finance;

import java.time.DateTimeException;
import java.time.ZoneId;

/**
 * Resuelve la zona horaria de la empresa; algunos IDs no existen en la BD IANA (p. ej. Europe/Malaga).
 */
public final class FinanceTimeZones {

    private FinanceTimeZones() {}

    public static ZoneId resolveZoneId(String timezone) {
        String raw = timezone == null || timezone.isBlank() ? "Europe/Madrid" : timezone.trim();
        if ("Europe/Malaga".equalsIgnoreCase(raw)) {
            return ZoneId.of("Europe/Madrid");
        }
        try {
            return ZoneId.of(raw);
        } catch (DateTimeException e) {
            return ZoneId.of("Europe/Madrid");
        }
    }
}
