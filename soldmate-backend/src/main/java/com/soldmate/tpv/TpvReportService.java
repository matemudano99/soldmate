package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.finance.DailyFinanceIncomeChannel;
import com.soldmate.finance.DailyFinanceService;
import com.soldmate.finance.DailyFinanceUpsertCommand;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Informes de caja del TPV y cierre Z (concilia en Finanzas reutilizando {@link DailyFinanceService}).
 * El TPV NUNCA escribe directamente en daily_finance_entries: agrega el día y llama a su upsert.
 */
@Service
public class TpvReportService {

    private static final List<TpvOrder.Status> SALE_STATUSES =
        List.of(TpvOrder.Status.PAID, TpvOrder.Status.CLOSED);

    public record ChannelTotal(String name, BigDecimal amount) {}

    public record DayReport(
        String businessDay,
        BigDecimal totalSales,
        BigDecimal totalTips,
        int paymentCount,
        List<ChannelTotal> byFinanceChannel
    ) {}

    private final TpvPaymentRepository paymentRepository;
    private final DailyFinanceService dailyFinanceService;
    private final ActivityLogger activityLogger;

    public TpvReportService(TpvPaymentRepository paymentRepository,
                            DailyFinanceService dailyFinanceService,
                            ActivityLogger activityLogger) {
        this.paymentRepository = paymentRepository;
        this.dailyFinanceService = dailyFinanceService;
        this.activityLogger = activityLogger;
    }

    /** Informe X: resumen del día sin cerrar caja. */
    @Transactional(readOnly = true)
    public DayReport xReport(Long companyId, LocalDate day) {
        List<TpvPayment> payments = paymentRepository.findForBusinessDay(companyId, day, SALE_STATUSES);
        return buildReport(day, payments);
    }

    /**
     * Cierre Z: agrega las ventas del día y las vuelca en el cierre de caja de Finanzas
     * (un canal por medio de pago, p. ej. "Datáfono (TPV)" → incomeDataphone). Respeta el bloqueo de mes.
     */
    @Transactional
    public DayReport zClose(Long companyId, LocalDate day, String email, boolean ownerBypassMonthLock) {
        List<TpvPayment> payments = paymentRepository.findForBusinessDay(companyId, day, SALE_STATUSES);
        if (payments.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No hay ventas cobradas para esa fecha");
        }
        DayReport report = buildReport(day, payments);

        List<DailyFinanceIncomeChannel> channels = report.byFinanceChannel().stream()
            .map(c -> new DailyFinanceIncomeChannel(c.name(), c.amount()))
            .toList();

        DailyFinanceUpsertCommand cmd = new DailyFinanceUpsertCommand(
            BigDecimal.ZERO,            // cashOpening (el TPV es la fuente; sin arqueo físico en Fase 1)
            channels,
            BigDecimal.ZERO,            // cashClosing
            "Generado por el cierre Z del TPV",
            List.of()
        );
        dailyFinanceService.upsert(companyId, day, email, cmd, ownerBypassMonthLock);

        activityLogger.log(companyId, email, "TPV_REPORT", "CIERRE_Z",
            "Cierre Z " + day + " · " + report.totalSales() + "€");
        return report;
    }

    private DayReport buildReport(LocalDate day, List<TpvPayment> payments) {
        Map<String, BigDecimal> byChannel = new LinkedHashMap<>();
        BigDecimal totalSales = BigDecimal.ZERO;
        BigDecimal totalTips = BigDecimal.ZERO;

        for (TpvPayment p : payments) {
            String channel = financeChannelName(p);
            byChannel.merge(channel, p.getAmount(), BigDecimal::add);
            totalSales = totalSales.add(p.getAmount());
            totalTips = totalTips.add(p.getTip());
        }

        List<ChannelTotal> channelTotals = new ArrayList<>();
        byChannel.forEach((name, amount) -> channelTotals.add(new ChannelTotal(name, amount.setScale(2, RoundingMode.HALF_UP))));

        return new DayReport(
            day.toString(),
            totalSales.setScale(2, RoundingMode.HALF_UP),
            totalTips.setScale(2, RoundingMode.HALF_UP),
            payments.size(),
            channelTotals
        );
    }

    /** Nombre de canal de Finanzas según el medio de pago (casa con DailyFinanceService.sumChannelsByName). */
    private static String financeChannelName(TpvPayment p) {
        return switch (p.getMethod()) {
            case CARD -> "Datáfono (TPV)";
            case CASH -> "Efectivo (TPV)";
            case TRANSFER -> "Transferencia (TPV)";
            case DELIVERY_PLATFORM -> (p.getPlatform() != null && !p.getPlatform().isBlank())
                ? p.getPlatform().trim()
                : "Plataforma (TPV)";
            case OTHER -> "Otros (TPV)";
        };
    }
}
