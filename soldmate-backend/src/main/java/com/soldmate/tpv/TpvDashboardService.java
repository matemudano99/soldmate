package com.soldmate.tpv;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.finance.FinanceTimeZones;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Cuadro de mando de ventas del TPV: KPIs y desgloses por canal, método, producto, hora y día. */
@Service
public class TpvDashboardService {

    private static final List<TpvOrder.Status> SALE_STATUSES =
        List.of(TpvOrder.Status.PAID, TpvOrder.Status.CLOSED);

    public record ChannelRow(String channel, BigDecimal total, long count) {}
    public record PaymentRow(String method, BigDecimal total) {}
    public record ProductRow(String name, BigDecimal qty, BigDecimal total) {}
    public record HourRow(int hour, BigDecimal total, long count) {}
    public record DayRow(String day, BigDecimal total, long count) {}

    public record Dashboard(String from, String to, BigDecimal totalSales, long ticketCount,
                            BigDecimal avgTicket, BigDecimal totalTips, List<ChannelRow> byChannel,
                            List<PaymentRow> byPaymentMethod, List<ProductRow> topProducts,
                            List<HourRow> byHour, List<DayRow> byDay) {}

    private final TpvOrderRepository orderRepository;
    private final TpvOrderLineRepository lineRepository;
    private final TpvPaymentRepository paymentRepository;
    private final CompanyRepository companyRepository;

    public TpvDashboardService(TpvOrderRepository orderRepository,
                               TpvOrderLineRepository lineRepository,
                               TpvPaymentRepository paymentRepository,
                               CompanyRepository companyRepository) {
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.paymentRepository = paymentRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional(readOnly = true)
    public Dashboard build(Long companyId, LocalDate from, LocalDate to) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        ZoneId zone = FinanceTimeZones.resolveZoneId(company.getTimezone());

        List<TpvOrder> orders = orderRepository
            .findByCompany_IdAndBusinessDayBetweenAndStatusInOrderByClosedAtDesc(companyId, from, to, SALE_STATUSES);

        BigDecimal totalSales = BigDecimal.ZERO;
        Map<String, BigDecimal> channelTotal = new LinkedHashMap<>();
        Map<String, Long> channelCount = new LinkedHashMap<>();
        Map<LocalDate, BigDecimal> dayTotal = new TreeMap<>();
        Map<LocalDate, Long> dayCount = new TreeMap<>();
        BigDecimal[] hourTotal = new BigDecimal[24];
        long[] hourCount = new long[24];
        for (int i = 0; i < 24; i++) hourTotal[i] = BigDecimal.ZERO;

        for (TpvOrder o : orders) {
            BigDecimal t = o.getTotal() != null ? o.getTotal() : BigDecimal.ZERO;
            totalSales = totalSales.add(t);

            String ch = o.getChannel().name();
            channelTotal.merge(ch, t, BigDecimal::add);
            channelCount.merge(ch, 1L, Long::sum);

            dayTotal.merge(o.getBusinessDay(), t, BigDecimal::add);
            dayCount.merge(o.getBusinessDay(), 1L, Long::sum);

            Instant when = o.getClosedAt() != null ? o.getClosedAt() : o.getOpenedAt();
            if (when != null) {
                int h = when.atZone(zone).getHour();
                hourTotal[h] = hourTotal[h].add(t);
                hourCount[h]++;
            }
        }

        long ticketCount = orders.size();
        BigDecimal avgTicket = ticketCount > 0
            ? totalSales.divide(BigDecimal.valueOf(ticketCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        List<ChannelRow> byChannel = new ArrayList<>();
        for (String ch : channelTotal.keySet()) {
            byChannel.add(new ChannelRow(ch, scale(channelTotal.get(ch)), channelCount.getOrDefault(ch, 0L)));
        }

        List<DayRow> byDay = new ArrayList<>();
        for (LocalDate d : dayTotal.keySet()) {
            byDay.add(new DayRow(d.toString(), scale(dayTotal.get(d)), dayCount.getOrDefault(d, 0L)));
        }

        List<HourRow> byHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            if (hourCount[h] > 0) byHour.add(new HourRow(h, scale(hourTotal[h]), hourCount[h]));
        }

        // Métodos de pago y propinas.
        List<PaymentRow> byPaymentMethod = new ArrayList<>();
        BigDecimal totalTips = BigDecimal.ZERO;
        for (Object[] row : paymentRepository.sumByMethodForRange(companyId, from, to, SALE_STATUSES)) {
            String method = ((TpvPayment.Method) row[0]).name();
            BigDecimal amount = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            BigDecimal tip = row[2] != null ? (BigDecimal) row[2] : BigDecimal.ZERO;
            byPaymentMethod.add(new PaymentRow(method, scale(amount)));
            totalTips = totalTips.add(tip);
        }

        // Top productos por unidades (máx. 10).
        List<ProductRow> topProducts = new ArrayList<>();
        List<Object[]> top = lineRepository.topProducts(companyId, from, to, SALE_STATUSES);
        for (int i = 0; i < top.size() && i < 10; i++) {
            Object[] row = top.get(i);
            BigDecimal qty = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            BigDecimal total = row[2] != null ? (BigDecimal) row[2] : BigDecimal.ZERO;
            topProducts.add(new ProductRow((String) row[0], qty, scale(total)));
        }

        return new Dashboard(from.toString(), to.toString(), scale(totalSales), ticketCount, avgTicket,
            scale(totalTips), byChannel, byPaymentMethod, topProducts, byHour, byDay);
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
