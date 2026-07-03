package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/** Ciclo de vida de comandas del TPV. Lectura para autenticados; operar requiere EMPLOYEE+. */
@RestController
@RequestMapping("/api/v1/tpv/orders")
public class OrderController {

    private final OrderService orderService;
    private final JwtUtil jwtUtil;

    public OrderController(OrderService orderService, JwtUtil jwtUtil) {
        this.orderService = orderService;
        this.jwtUtil = jwtUtil;
    }

    public record LineResponse(Long id, Long menuItemId, Long parentLineId, String name, BigDecimal qty,
                               BigDecimal unitPrice, BigDecimal vatRate, BigDecimal lineTotal,
                               BigDecimal discountPct, String note, boolean voided, boolean removal) {
        static LineResponse from(TpvOrderLine l) {
            return new LineResponse(l.getId(), l.getMenuItemId(), l.getParentLineId(), l.getNameSnapshot(), l.getQty(),
                l.getUnitPrice(), l.getVatRate(), l.getLineTotal(), l.getDiscountPct(), l.getNote(), l.isVoided(), l.isRemoval());
        }
    }

    public record PaymentResponse(Long id, String method, BigDecimal amount, BigDecimal tip,
                                  String platform, String createdAt) {
        static PaymentResponse from(TpvPayment p) {
            return new PaymentResponse(p.getId(), p.getMethod().name(), p.getAmount(), p.getTip(),
                p.getPlatform(), p.getCreatedAt().toString());
        }
    }

    public record OrderResponse(Long id, String status, String channel, String businessDay,
                                Long tableId, Long customerId, String customerName, String customerPhone,
                                String customerAddress, BigDecimal subtotal, BigDecimal taxTotal, BigDecimal total,
                                String discountType, BigDecimal discountValue, String discountReason,
                                BigDecimal discountTotal, String note, List<LineResponse> lines,
                                List<PaymentResponse> payments) {}

    public record CreateOrderRequest(TpvOrder.Channel channel, String note, Long tableId, Long customerId,
                                     String customerName, String customerPhone, String customerAddress) {
        OrderService.OrderInfo toInfo() {
            return new OrderService.OrderInfo(tableId, customerId, customerName, customerPhone, customerAddress);
        }
    }

    public record UpdateOrderRequest(String note, Long tableId, Long customerId,
                                     String customerName, String customerPhone, String customerAddress) {
        OrderService.OrderInfo toInfo() {
            return new OrderService.OrderInfo(tableId, customerId, customerName, customerPhone, customerAddress);
        }
    }

    /** Combinado elegido en una petición: id de artículo de modificador, cantidad y si es "de quita". */
    public record ModifierInput(Long menuItemId, BigDecimal qty, boolean removed) {
        OrderService.ModifierLine toLine() {
            return new OrderService.ModifierLine(menuItemId, qty, removed);
        }
    }

    public record AddLineRequest(@NotNull Long menuItemId, BigDecimal qty, String note,
                                 List<ModifierInput> modifiers, Integer variantIndex) {}

    public record SetQtyRequest(@NotNull BigDecimal qty) {}

    public record SetModifiersRequest(List<ModifierInput> modifiers, String note) {}

    public record LineDiscountRequest(BigDecimal pct) {}

    public record OrderDiscountRequest(TpvOrder.DiscountType type, BigDecimal value, String reason) {}

    private static List<OrderService.ModifierLine> toModifiers(List<ModifierInput> in) {
        if (in == null) return null;
        return in.stream().filter(java.util.Objects::nonNull).map(ModifierInput::toLine).toList();
    }

    public record PaymentRequest(@NotNull TpvPayment.Method method, @NotNull BigDecimal amount,
                                 BigDecimal tip, String platform) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public ResponseEntity<OrderResponse> create(@RequestHeader("Authorization") String auth,
                                                @RequestBody(required = false) CreateOrderRequest req) {
        TpvOrder.Channel channel = req != null ? req.channel() : null;
        String note = req != null ? req.note() : null;
        OrderService.OrderInfo info = req != null ? req.toInfo() : null;
        TpvOrder order = orderService.createOrder(companyId(auth), email(auth), channel, note, info);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(order));
    }

    @GetMapping("/open")
    @PreAuthorize("isAuthenticated()")
    public List<OrderResponse> listOpen(@RequestHeader("Authorization") String auth) {
        return orderService.listOpen(companyId(auth)).stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public OrderResponse get(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        return toResponse(orderService.getOrder(companyId(auth), id));
    }

    /** Comanda abierta de una mesa (204 si la mesa está libre). */
    @GetMapping("/by-table/{tableId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<OrderResponse> byTable(@RequestHeader("Authorization") String auth, @PathVariable Long tableId) {
        TpvOrder order = orderService.getOpenByTable(companyId(auth), tableId);
        return order != null ? ResponseEntity.ok(toResponse(order)) : ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse update(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                @RequestBody UpdateOrderRequest req) {
        return toResponse(orderService.updateInfo(companyId(auth), id, req.note(), req.toInfo()));
    }

    @PostMapping("/{id}/lines")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse addLine(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                 @RequestBody AddLineRequest req) {
        TpvOrder order = orderService.addLine(companyId(auth), email(auth), id,
            req.menuItemId(), req.qty(), req.note(), toModifiers(req.modifiers()), req.variantIndex());
        return toResponse(order);
    }

    @PostMapping("/{id}/lines/{lineId}/qty")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse setLineQty(@RequestHeader("Authorization") String auth,
                                    @PathVariable Long id, @PathVariable Long lineId,
                                    @RequestBody SetQtyRequest req) {
        return toResponse(orderService.setLineQty(companyId(auth), id, lineId, req.qty()));
    }

    @PostMapping("/{id}/lines/{lineId}/modifiers")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse setLineModifiers(@RequestHeader("Authorization") String auth,
                                          @PathVariable Long id, @PathVariable Long lineId,
                                          @RequestBody SetModifiersRequest req) {
        return toResponse(orderService.setLineModifiers(companyId(auth), id, lineId, toModifiers(req.modifiers()), req.note()));
    }

    @PostMapping("/{id}/lines/{lineId}/void")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse voidLine(@RequestHeader("Authorization") String auth,
                                  @PathVariable Long id, @PathVariable Long lineId) {
        return toResponse(orderService.voidLine(companyId(auth), id, lineId));
    }

    @PostMapping("/{id}/lines/{lineId}/discount")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public OrderResponse setLineDiscount(@RequestHeader("Authorization") String auth,
                                         @PathVariable Long id, @PathVariable Long lineId,
                                         @RequestBody LineDiscountRequest req) {
        return toResponse(orderService.setLineDiscount(companyId(auth), id, lineId, req.pct()));
    }

    @PostMapping("/{id}/discount")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public OrderResponse setOrderDiscount(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                          @RequestBody OrderDiscountRequest req) {
        return toResponse(orderService.setOrderDiscount(companyId(auth), id, req.type(), req.value(), req.reason()));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public OrderResponse pay(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                             @RequestBody PaymentRequest req) {
        TpvOrder order = orderService.addPayment(companyId(auth), email(auth), id,
            req.method(), req.amount(), req.tip(), req.platform());
        return toResponse(order);
    }

    private OrderResponse toResponse(TpvOrder order) {
        List<LineResponse> lines = orderService.linesOf(order.getId()).stream().map(LineResponse::from).toList();
        List<PaymentResponse> payments = orderService.paymentsOf(order.getId()).stream().map(PaymentResponse::from).toList();
        java.math.BigDecimal discountTotal = orderService.rawGross(order.getId()).subtract(order.getTotal());
        if (discountTotal.signum() < 0) discountTotal = java.math.BigDecimal.ZERO;
        return new OrderResponse(
            order.getId(), order.getStatus().name(), order.getChannel().name(),
            order.getBusinessDay().toString(), order.getTableId(), order.getCustomerId(),
            order.getCustomerName(), order.getCustomerPhone(), order.getCustomerAddress(),
            order.getSubtotal(), order.getTaxTotal(), order.getTotal(),
            order.getDiscountType().name(), order.getDiscountValue(), order.getDiscountReason(),
            discountTotal.setScale(2, java.math.RoundingMode.HALF_UP), order.getNote(), lines, payments
        );
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
