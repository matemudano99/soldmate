package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.finance.FinanceTimeZones;
import com.soldmate.predictive.SaleRecord;
import com.soldmate.predictive.SaleRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Ciclo de vida de la comanda del TPV: alta, líneas y cobro (transición a PAID). */
@Service
@Transactional
public class OrderService {

    private final TpvOrderRepository orderRepository;
    private final TpvOrderLineRepository lineRepository;
    private final TpvPaymentRepository paymentRepository;
    private final MenuItemRepository menuItemRepository;
    private final TpvTableRepository tableRepository;
    private final TpvCustomerService customerService;
    private final CompanyRepository companyRepository;
    private final StockDeductionService stockDeductionService;
    private final SaleRecordRepository saleRecordRepository;
    private final ActivityLogger activityLogger;

    public OrderService(TpvOrderRepository orderRepository,
                        TpvOrderLineRepository lineRepository,
                        TpvPaymentRepository paymentRepository,
                        MenuItemRepository menuItemRepository,
                        TpvTableRepository tableRepository,
                        TpvCustomerService customerService,
                        CompanyRepository companyRepository,
                        StockDeductionService stockDeductionService,
                        SaleRecordRepository saleRecordRepository,
                        ActivityLogger activityLogger) {
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.paymentRepository = paymentRepository;
        this.menuItemRepository = menuItemRepository;
        this.tableRepository = tableRepository;
        this.customerService = customerService;
        this.companyRepository = companyRepository;
        this.stockDeductionService = stockDeductionService;
        this.saleRecordRepository = saleRecordRepository;
        this.activityLogger = activityLogger;
    }

    /** Datos de cliente / mesa al crear o editar una comanda. */
    public record OrderInfo(Long tableId, Long customerId, String customerName, String customerPhone,
                            String customerAddress) {}

    /** Combinado elegido: artículo de modificador y su cantidad (p. ej. +2 bacon), o "de quita" (sin X). */
    public record ModifierLine(Long menuItemId, BigDecimal qty, boolean removed) {}

    @Transactional(readOnly = true)
    public TpvOrder getOrder(Long companyId, Long orderId) {
        return orderRepository.findByIdAndCompany_Id(orderId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comanda no encontrada"));
    }

    @Transactional(readOnly = true)
    public List<TpvOrderLine> linesOf(Long orderId) {
        return lineRepository.findByOrder_IdOrderByIdAsc(orderId);
    }

    @Transactional(readOnly = true)
    public List<TpvPayment> paymentsOf(Long orderId) {
        return paymentRepository.findByOrder_IdOrderByIdAsc(orderId);
    }

    @Transactional(readOnly = true)
    public List<TpvOrder> listOpen(Long companyId) {
        return orderRepository.findByCompany_IdAndStatusOrderByOpenedAtAsc(companyId, TpvOrder.Status.OPEN);
    }

    public TpvOrder createOrder(Long companyId, String email, TpvOrder.Channel channel, String note, OrderInfo info) {
        Company company = company(companyId);
        TpvOrder order = new TpvOrder();
        order.setCompany(company);
        order.setChannel(channel != null ? channel : TpvOrder.Channel.DINE_IN);
        order.setBusinessDay(LocalDate.now(FinanceTimeZones.resolveZoneId(company.getTimezone())));
        order.setOpenedBy(email);
        order.setOpenedAt(Instant.now());
        order.setNote(note != null && !note.isBlank() ? note.trim() : null);
        applyInfo(companyId, order, info);
        // Si no se eligió un cliente existente pero hay nombre+teléfono, lo guarda/actualiza en el fichero.
        if (order.getCustomerId() == null) {
            Long cid = customerService.upsertFromOrder(companyId, order.getCustomerName(),
                order.getCustomerPhone(), order.getCustomerAddress());
            if (cid != null) order.setCustomerId(cid);
        }
        order = orderRepository.save(order);
        activityLogger.log(companyId, email, "TPV_ORDER", "CREADO", "Comanda #" + order.getId());
        return order;
    }

    /** Edita nota y datos de cliente/mesa de una comanda abierta. */
    public TpvOrder updateInfo(Long companyId, Long orderId, String note, OrderInfo info) {
        TpvOrder order = requireOpen(companyId, orderId);
        if (note != null) order.setNote(note.isBlank() ? null : note.trim());
        applyInfo(companyId, order, info);
        return orderRepository.save(order);
    }

    @Transactional(readOnly = true)
    public TpvOrder getOpenByTable(Long companyId, Long tableId) {
        return orderRepository
            .findFirstByCompany_IdAndTableIdAndStatusOrderByOpenedAtAsc(companyId, tableId, TpvOrder.Status.OPEN)
            .orElse(null);
    }

    private void applyInfo(Long companyId, TpvOrder order, OrderInfo info) {
        if (info == null) return;
        if (info.tableId() != null) {
            // Valida que la mesa pertenezca a la empresa.
            tableRepository.findByIdAndCompany_Id(info.tableId(), companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mesa no encontrada"));
            order.setTableId(info.tableId());
        }
        if (info.customerId() != null) {
            customerService.get(companyId, info.customerId()); // valida pertenencia (lanza 404 si no es de la empresa)
            order.setCustomerId(info.customerId());
        }
        if (info.customerName() != null) order.setCustomerName(blankToNull(info.customerName()));
        if (info.customerPhone() != null) order.setCustomerPhone(blankToNull(info.customerPhone()));
        if (info.customerAddress() != null) order.setCustomerAddress(blankToNull(info.customerAddress()));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    public TpvOrder addLine(Long companyId, String email, Long orderId, Long menuItemId, BigDecimal qty,
                            String note, List<ModifierLine> modifiers, Integer variantIndex) {
        TpvOrder order = requireOpen(companyId, orderId);
        MenuItem item = menuItemRepository.findByIdAndCompany_Id(menuItemId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Artículo no encontrado"));
        if (!item.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Artículo agotado");
        }
        BigDecimal quantity = (qty != null && qty.compareTo(BigDecimal.ZERO) > 0) ? qty : BigDecimal.ONE;
        boolean hasModifiers = modifiers != null && !modifiers.isEmpty();
        boolean plainNote = note == null || note.isBlank();

        // Resuelve nombre/precio según la variante elegida (p. ej. "Veggie" + "Doble"). El precio se
        // toma siempre del servidor, nunca del cliente.
        List<TpvVariants.Variant> variants = TpvVariants.parse(item.getVariantsJson());
        String resolvedName = item.getName();
        BigDecimal resolvedPrice = item.getPrice();
        if (!variants.isEmpty()) {
            int idx = (variantIndex != null && variantIndex >= 0 && variantIndex < variants.size()) ? variantIndex : 0;
            TpvVariants.Variant v = variants.get(idx);
            resolvedName = item.getName() + " " + v.label();
            resolvedPrice = v.price();
        }

        // Línea simple sin combinados ni nota: si ya existe una idéntica (mismo artículo y variante,
        // sin combinados propios), acumula cantidad para mantener el ticket limpio.
        if (!hasModifiers && plainNote) {
            List<TpvOrderLine> active = lineRepository.findByOrder_IdAndVoidedFalse(orderId);
            Set<Long> parentsWithChildren = active.stream()
                .map(TpvOrderLine::getParentLineId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
            String finalName = resolvedName;
            BigDecimal finalPrice = resolvedPrice;
            TpvOrderLine existing = active.stream()
                .filter(l -> menuItemId.equals(l.getMenuItemId()) && l.getParentLineId() == null
                    && !parentsWithChildren.contains(l.getId())
                    && finalName.equals(l.getNameSnapshot())
                    && finalPrice.compareTo(l.getUnitPrice()) == 0
                    && (l.getNote() == null || l.getNote().isBlank()))
                .findFirst().orElse(null);
            if (existing != null) {
                setQty(existing, existing.getQty().add(quantity));
                lineRepository.save(existing);
                bumpKitchenStatus(order, item.isKitchen());
                recomputeTotals(order);
                return orderRepository.save(order);
            }
        }

        TpvOrderLine parent = buildLine(order, item.getId(), resolvedName, resolvedPrice, item.getVatRate(),
            quantity, note, null);
        parent.setKitchen(item.isKitchen());
        lineRepository.save(parent);

        if (hasModifiers) {
            for (ModifierLine m : modifiers) {
                if (m == null || m.menuItemId() == null) continue;
                MenuItem mod = menuItemRepository.findByIdAndCompany_Id(m.menuItemId(), companyId).orElse(null);
                if (mod == null) continue;
                TpvOrderLine child = buildModifier(order, mod, m, parent.getId());
                child.setKitchen(parent.isKitchen());
                lineRepository.save(child);
            }
        }

        bumpKitchenStatus(order, item.isKitchen());
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    /** Cuando se añade un plato de cocina, la comanda (re)entra al tablero como pendiente. */
    private void bumpKitchenStatus(TpvOrder order, boolean kitchenItem) {
        if (!kitchenItem) return;
        TpvOrder.KitchenStatus ks = order.getKitchenStatus();
        if (ks == TpvOrder.KitchenStatus.NONE || ks == TpvOrder.KitchenStatus.READY
            || ks == TpvOrder.KitchenStatus.SERVED) {
            order.setKitchenStatus(TpvOrder.KitchenStatus.PENDING);
        }
    }

    /** Construye la línea hija de un combinado: normal (precio×cantidad) o "de quita" ("Sin X", sin precio). */
    private TpvOrderLine buildModifier(TpvOrder order, MenuItem mod, ModifierLine m, Long parentLineId) {
        if (m.removed()) {
            TpvOrderLine line = buildLine(order, mod.getId(), "Sin " + mod.getName(), BigDecimal.ZERO,
                mod.getVatRate(), BigDecimal.ONE, null, parentLineId);
            line.setRemoval(true);
            return line;
        }
        BigDecimal modQty = (m.qty() != null && m.qty().compareTo(BigDecimal.ZERO) > 0) ? m.qty() : BigDecimal.ONE;
        return buildLine(order, mod.getId(), mod.getName(), mod.getPrice(), mod.getVatRate(),
            modQty, null, parentLineId);
    }

    /**
     * Cambia la cantidad de una línea. qty <= 0 anula la línea (y sus combinados). Los combinados
     * mantienen su propia cantidad (p. ej. +2 bacon), no se sincronizan con el padre.
     */
    public TpvOrder setLineQty(Long companyId, Long orderId, Long lineId, BigDecimal qty) {
        TpvOrder order = requireOpen(companyId, orderId);
        TpvOrderLine line = requireLine(companyId, orderId, lineId);
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
            voidWithChildren(line);
        } else {
            setQty(line, qty);
            lineRepository.save(line);
        }
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    public TpvOrder voidLine(Long companyId, Long orderId, Long lineId) {
        TpvOrder order = requireOpen(companyId, orderId);
        TpvOrderLine line = requireLine(companyId, orderId, lineId);
        voidWithChildren(line);
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    /** Aplica un descuento de % a una línea (100 = invitar/gratis). */
    public TpvOrder setLineDiscount(Long companyId, Long orderId, Long lineId, BigDecimal pct) {
        TpvOrder order = requireOpen(companyId, orderId);
        TpvOrderLine line = requireLine(companyId, orderId, lineId);
        BigDecimal p = pct != null ? pct : BigDecimal.ZERO;
        if (p.compareTo(BigDecimal.ZERO) < 0) p = BigDecimal.ZERO;
        if (p.compareTo(new BigDecimal("100")) > 0) p = new BigDecimal("100");
        line.setDiscountPct(p.setScale(2, RoundingMode.HALF_UP));
        applyLineTotal(line);
        lineRepository.save(line);
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    /** Descuento de ticket: tipo (NONE/PERCENT/AMOUNT), valor y motivo. */
    public TpvOrder setOrderDiscount(Long companyId, Long orderId, TpvOrder.DiscountType type,
                                     BigDecimal value, String reason) {
        TpvOrder order = requireOpen(companyId, orderId);
        TpvOrder.DiscountType t = type != null ? type : TpvOrder.DiscountType.NONE;
        BigDecimal v = value != null ? value : BigDecimal.ZERO;
        if (v.compareTo(BigDecimal.ZERO) < 0) v = BigDecimal.ZERO;
        if (t == TpvOrder.DiscountType.PERCENT && v.compareTo(new BigDecimal("100")) > 0) v = new BigDecimal("100");
        order.setDiscountType(t);
        order.setDiscountValue(v.setScale(2, RoundingMode.HALF_UP));
        order.setDiscountReason(t == TpvOrder.DiscountType.NONE ? null : (reason != null && !reason.isBlank() ? reason.trim() : null));
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    /** Importe bruto sin descuentos (suma de precio×cantidad de las líneas no anuladas). */
    @Transactional(readOnly = true)
    public BigDecimal rawGross(Long orderId) {
        return lineRepository.findByOrder_IdAndVoidedFalse(orderId).stream()
            .map(l -> l.getUnitPrice().multiply(l.getQty()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    }

    /** Reemplaza los combinados (líneas hijas) de una línea padre y su descripción/nota. */
    public TpvOrder setLineModifiers(Long companyId, Long orderId, Long lineId, List<ModifierLine> modifiers, String note) {
        TpvOrder order = requireOpen(companyId, orderId);
        TpvOrderLine parent = requireLine(companyId, orderId, lineId);
        if (parent.getParentLineId() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea no admite combinados");
        }
        parent.setNote(note != null && !note.isBlank() ? note.trim() : null);
        lineRepository.save(parent);

        // Borra los combinados actuales (la comanda está abierta, no hay histórico que preservar).
        lineRepository.deleteAll(lineRepository.findByParentLineId(parent.getId()));

        if (modifiers != null) {
            for (ModifierLine m : modifiers) {
                if (m == null || m.menuItemId() == null) continue;
                MenuItem mod = menuItemRepository.findByIdAndCompany_Id(m.menuItemId(), companyId).orElse(null);
                if (mod == null) continue;
                TpvOrderLine child = buildModifier(order, mod, m, parent.getId());
                child.setKitchen(parent.isKitchen());
                lineRepository.save(child);
            }
        }
        recomputeTotals(order);
        return orderRepository.save(order);
    }

    private TpvOrderLine buildLine(TpvOrder order, Long menuItemId, String name, BigDecimal unitPrice,
                                   BigDecimal vatRate, BigDecimal quantity, String note, Long parentLineId) {
        TpvOrderLine line = new TpvOrderLine();
        line.setCompany(order.getCompany());
        line.setOrder(order);
        line.setMenuItemId(menuItemId);
        line.setParentLineId(parentLineId);
        line.setNameSnapshot(name);
        line.setUnitPrice(unitPrice);
        line.setVatRate(vatRate);
        line.setNote(note != null && !note.isBlank() ? note.trim() : null);
        setQty(line, quantity);
        return line;
    }

    private void setQty(TpvOrderLine line, BigDecimal quantity) {
        line.setQty(quantity);
        applyLineTotal(line);
    }

    /** Recalcula el total de la línea: precio × cantidad menos su descuento (% de línea). */
    private void applyLineTotal(TpvOrderLine line) {
        BigDecimal raw = line.getUnitPrice().multiply(line.getQty());
        BigDecimal pct = line.getDiscountPct() != null ? line.getDiscountPct() : BigDecimal.ZERO;
        BigDecimal factor = BigDecimal.ONE.subtract(pct.movePointLeft(2));
        if (factor.compareTo(BigDecimal.ZERO) < 0) factor = BigDecimal.ZERO;
        line.setLineTotal(raw.multiply(factor).setScale(2, RoundingMode.HALF_UP));
    }

    private void voidWithChildren(TpvOrderLine line) {
        line.setVoided(true);
        lineRepository.save(line);
        for (TpvOrderLine child : lineRepository.findByParentLineId(line.getId())) {
            child.setVoided(true);
            lineRepository.save(child);
        }
    }

    private TpvOrderLine requireLine(Long companyId, Long orderId, Long lineId) {
        return lineRepository.findById(lineId)
            .filter(l -> l.getOrder().getId().equals(orderId) && l.getCompany().getId().equals(companyId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Línea no encontrada"));
    }

    /**
     * Registra un pago. Si la suma de pagos cubre el total, transiciona la comanda a PAID:
     * descuenta stock por escandallo, registra la venta (SaleRecord) y audita. Idempotente: si la
     * comanda ya está PAID, no vuelve a descontar.
     */
    public TpvOrder addPayment(Long companyId, String email, Long orderId,
                               TpvPayment.Method method, BigDecimal amount, BigDecimal tip, String platform) {
        TpvOrder order = getOrder(companyId, orderId);
        if (order.getStatus() == TpvOrder.Status.PAID || order.getStatus() == TpvOrder.Status.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La comanda ya está cobrada");
        }
        if (order.getStatus() == TpvOrder.Status.VOID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La comanda está anulada");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe de pago inválido");
        }

        TpvPayment payment = new TpvPayment();
        payment.setCompany(order.getCompany());
        payment.setOrder(order);
        payment.setMethod(method != null ? method : TpvPayment.Method.CASH);
        payment.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        payment.setTip(tip != null ? tip.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        payment.setPlatform(platform != null && !platform.isBlank() ? platform.trim() : null);
        payment.setCreatedBy(email);
        // Cambio si paga en efectivo de más sobre el total pendiente.
        paymentRepository.save(payment);

        BigDecimal paid = paymentRepository.findByOrder_IdOrderByIdAsc(orderId).stream()
            .map(TpvPayment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (paid.compareTo(order.getTotal()) >= 0 && order.getTotal().compareTo(BigDecimal.ZERO) > 0) {
            markPaid(companyId, email, order);
        }
        return orderRepository.save(order);
    }

    private void markPaid(Long companyId, String email, TpvOrder order) {
        order.setStatus(TpvOrder.Status.PAID);
        order.setClosedAt(Instant.now());

        List<TpvOrderLine> lines = lineRepository.findByOrder_IdAndVoidedFalse(order.getId());
        stockDeductionService.deductForOrder(companyId, lines);

        SaleRecord sale = new SaleRecord();
        sale.setCompany(order.getCompany());
        sale.setSaleDate(order.getBusinessDay());
        sale.setTotal(order.getTotal());
        sale.setChannel(order.getChannel() == TpvOrder.Channel.DINE_IN ? "DINING" : order.getChannel().name());
        saleRecordRepository.save(sale);

        activityLogger.log(companyId, email, "TPV_ORDER", "VENTA",
            "Comanda #" + order.getId() + " · " + order.getTotal() + "€");
    }

    private TpvOrder requireOpen(Long companyId, Long orderId) {
        TpvOrder order = getOrder(companyId, orderId);
        if (order.getStatus() == TpvOrder.Status.PAID || order.getStatus() == TpvOrder.Status.CLOSED
            || order.getStatus() == TpvOrder.Status.VOID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La comanda no admite cambios en su estado actual");
        }
        return order;
    }

    private void recomputeTotals(TpvOrder order) {
        List<TpvOrderLine> lines = lineRepository.findByOrder_IdAndVoidedFalse(order.getId());
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal base = BigDecimal.ZERO;
        for (TpvOrderLine l : lines) {
            BigDecimal lineGross = l.getLineTotal();
            BigDecimal divisor = BigDecimal.ONE.add(l.getVatRate().movePointLeft(2));
            BigDecimal lineBase = divisor.compareTo(BigDecimal.ZERO) > 0
                ? lineGross.divide(divisor, 2, RoundingMode.HALF_UP)
                : lineGross;
            gross = gross.add(lineGross);
            base = base.add(lineBase);
        }
        // Descuento de ticket: factor uniforme (mantiene la proporción base/IVA).
        BigDecimal factor = BigDecimal.ONE;
        BigDecimal value = order.getDiscountValue() != null ? order.getDiscountValue() : BigDecimal.ZERO;
        if (order.getDiscountType() == TpvOrder.DiscountType.PERCENT && value.compareTo(BigDecimal.ZERO) > 0) {
            factor = BigDecimal.ONE.subtract(value.movePointLeft(2));
        } else if (order.getDiscountType() == TpvOrder.DiscountType.AMOUNT
            && value.compareTo(BigDecimal.ZERO) > 0 && gross.compareTo(BigDecimal.ZERO) > 0) {
            factor = gross.subtract(value).divide(gross, 6, RoundingMode.HALF_UP);
        }
        if (factor.compareTo(BigDecimal.ZERO) < 0) factor = BigDecimal.ZERO;
        gross = gross.multiply(factor);
        base = base.multiply(factor);

        order.setTotal(gross.setScale(2, RoundingMode.HALF_UP));
        order.setSubtotal(base.setScale(2, RoundingMode.HALF_UP));
        order.setTaxTotal(gross.subtract(base).setScale(2, RoundingMode.HALF_UP));
    }

    private Company company(Long companyId) {
        return companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
    }
}
