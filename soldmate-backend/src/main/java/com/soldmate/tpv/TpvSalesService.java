package com.soldmate.tpv;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
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

/** Historial de ventas del TPV y generación del recibo (ticket/justificante) de una comanda cobrada. */
@Service
public class TpvSalesService {

    private static final List<TpvOrder.Status> SALE_STATUSES =
        List.of(TpvOrder.Status.PAID, TpvOrder.Status.CLOSED);

    // ─── DTOs de salida ─────────────────────────────────────────────────────────

    public record SaleSummary(Long id, String businessDay, String closedAt, String channel,
                              String tableLabel, String customerName, BigDecimal total,
                              BigDecimal tips, List<String> paymentMethods) {}

    public record ReceiptCompany(String name, String taxId, String addressLine, String city,
                                 String postalCode, String phone, String email) {}

    public record ReceiptLine(String name, BigDecimal qty, BigDecimal unitPrice, BigDecimal lineTotal,
                              boolean modifier, boolean kitchen, boolean removal, BigDecimal discountPct, String note) {}

    public record TaxRow(BigDecimal vatRate, BigDecimal base, BigDecimal tax, BigDecimal total) {}

    public record ReceiptPayment(String method, BigDecimal amount, BigDecimal tip, BigDecimal change,
                                 String platform, String createdAt) {}

    public record Receipt(ReceiptCompany company, Long orderId, String number, String businessDay,
                          String openedAt, String closedAt, String channel, String tableLabel,
                          String customerName, String customerPhone, String customerAddress,
                          String customerTaxId, String customerEmail,
                          String openedBy, String note, List<ReceiptLine> lines, List<TaxRow> taxBreakdown,
                          BigDecimal subtotal, BigDecimal taxTotal, BigDecimal total, BigDecimal discountTotal,
                          String discountReason, List<ReceiptPayment> payments, BigDecimal totalPaid,
                          BigDecimal totalTips) {}

    private final TpvOrderRepository orderRepository;
    private final TpvOrderLineRepository lineRepository;
    private final TpvPaymentRepository paymentRepository;
    private final TpvTableRepository tableRepository;
    private final TpvCustomerRepository customerRepository;
    private final MenuItemRepository menuItemRepository;
    private final CompanyRepository companyRepository;

    public TpvSalesService(TpvOrderRepository orderRepository,
                           TpvOrderLineRepository lineRepository,
                           TpvPaymentRepository paymentRepository,
                           TpvTableRepository tableRepository,
                           TpvCustomerRepository customerRepository,
                           MenuItemRepository menuItemRepository,
                           CompanyRepository companyRepository) {
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.paymentRepository = paymentRepository;
        this.tableRepository = tableRepository;
        this.customerRepository = customerRepository;
        this.menuItemRepository = menuItemRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional(readOnly = true)
    public List<SaleSummary> listSales(Long companyId, LocalDate from, LocalDate to) {
        return toSummaries(companyId, orderRepository
            .findByCompany_IdAndBusinessDayBetweenAndStatusInOrderByClosedAtDesc(companyId, from, to, SALE_STATUSES));
    }

    @Transactional(readOnly = true)
    public List<SaleSummary> listSalesByCustomer(Long companyId, Long customerId) {
        return toSummaries(companyId, orderRepository
            .findByCompany_IdAndCustomerIdAndStatusInOrderByClosedAtDesc(companyId, customerId, SALE_STATUSES));
    }

    private List<SaleSummary> toSummaries(Long companyId, List<TpvOrder> orders) {
        List<SaleSummary> out = new ArrayList<>();
        for (TpvOrder o : orders) {
            List<TpvPayment> payments = paymentRepository.findByOrder_IdOrderByIdAsc(o.getId());
            BigDecimal tips = payments.stream().map(TpvPayment::getTip).reduce(BigDecimal.ZERO, BigDecimal::add);
            List<String> methods = payments.stream().map(p -> p.getMethod().name()).distinct().toList();
            out.add(new SaleSummary(
                o.getId(), o.getBusinessDay().toString(),
                o.getClosedAt() != null ? o.getClosedAt().toString() : null,
                o.getChannel().name(), tableLabel(companyId, o.getTableId()), o.getCustomerName(),
                o.getTotal(), tips, methods));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Receipt receipt(Long companyId, Long orderId) {
        TpvOrder order = orderRepository.findByIdAndCompany_Id(orderId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada"));
        Company c = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));

        List<TpvOrderLine> lines = lineRepository.findByOrder_IdOrderByIdAsc(order.getId()).stream()
            .filter(l -> !l.isVoided())
            .toList();

        // Marca de cocina por línea: snapshot guardado en la propia línea.
        List<ReceiptLine> receiptLines = lines.stream()
            .map(l -> new ReceiptLine(l.getNameSnapshot(), l.getQty(), l.getUnitPrice(), l.getLineTotal(),
                l.getParentLineId() != null, l.isKitchen(), l.isRemoval(), l.getDiscountPct(), l.getNote()))
            .toList();

        // Desglose de IVA por tipo (precios brutos: base = bruto / (1 + tipo)).
        Map<BigDecimal, BigDecimal> grossByRate = new LinkedHashMap<>();
        for (TpvOrderLine l : lines) {
            grossByRate.merge(l.getVatRate(), l.getLineTotal(), BigDecimal::add);
        }
        List<TaxRow> taxBreakdown = new ArrayList<>();
        for (Map.Entry<BigDecimal, BigDecimal> e : grossByRate.entrySet()) {
            BigDecimal rate = e.getKey();
            BigDecimal gross = e.getValue();
            BigDecimal divisor = BigDecimal.ONE.add(rate.movePointLeft(2));
            BigDecimal base = divisor.compareTo(BigDecimal.ZERO) > 0
                ? gross.divide(divisor, 2, RoundingMode.HALF_UP) : gross;
            BigDecimal tax = gross.subtract(base);
            taxBreakdown.add(new TaxRow(rate, base, tax.setScale(2, RoundingMode.HALF_UP),
                gross.setScale(2, RoundingMode.HALF_UP)));
        }

        List<TpvPayment> payments = paymentRepository.findByOrder_IdOrderByIdAsc(order.getId());
        List<ReceiptPayment> receiptPayments = payments.stream()
            .map(p -> new ReceiptPayment(p.getMethod().name(), p.getAmount(), p.getTip(), p.getChangeGiven(),
                p.getPlatform(), p.getCreatedAt() != null ? p.getCreatedAt().toString() : null))
            .toList();
        BigDecimal totalPaid = payments.stream().map(TpvPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalTips = payments.stream().map(TpvPayment::getTip).reduce(BigDecimal.ZERO, BigDecimal::add);

        ReceiptCompany company = new ReceiptCompany(c.getName(), c.getTaxId(), c.getAddressLine(),
            c.getCity(), c.getPostalCode(), c.getBusinessPhone(), c.getBusinessEmail());

        // Datos de facturación del cliente (NIF/email) desde su ficha, si la comanda tiene cliente.
        String customerTaxId = null;
        String customerEmail = null;
        if (order.getCustomerId() != null) {
            TpvCustomer cust = customerRepository.findByIdAndCompany_Id(order.getCustomerId(), companyId).orElse(null);
            if (cust != null) {
                customerTaxId = cust.getTaxId();
                customerEmail = cust.getEmail();
            }
        }

        // Descuento total = bruto sin descuentos − total final.
        BigDecimal rawGross = lines.stream()
            .map(l -> l.getUnitPrice().multiply(l.getQty()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = rawGross.subtract(order.getTotal());
        if (discountTotal.signum() < 0) discountTotal = BigDecimal.ZERO;

        return new Receipt(company, order.getId(), "#" + order.getId(), order.getBusinessDay().toString(),
            order.getOpenedAt() != null ? order.getOpenedAt().toString() : null,
            order.getClosedAt() != null ? order.getClosedAt().toString() : null,
            order.getChannel().name(), tableLabel(companyId, order.getTableId()),
            order.getCustomerName(), order.getCustomerPhone(), order.getCustomerAddress(),
            customerTaxId, customerEmail,
            order.getOpenedBy(), order.getNote(), receiptLines, taxBreakdown,
            order.getSubtotal(), order.getTaxTotal(), order.getTotal(),
            discountTotal.setScale(2, RoundingMode.HALF_UP), order.getDiscountReason(),
            receiptPayments, totalPaid.setScale(2, RoundingMode.HALF_UP),
            totalTips.setScale(2, RoundingMode.HALF_UP));
    }

    private String tableLabel(Long companyId, Long tableId) {
        if (tableId == null) return null;
        return tableRepository.findByIdAndCompany_Id(tableId, companyId)
            .map(TpvTable::getLabel).orElse(null);
    }
}
