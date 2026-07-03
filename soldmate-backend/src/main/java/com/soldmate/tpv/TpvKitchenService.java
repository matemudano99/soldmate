package com.soldmate.tpv;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

/** KDS de cocina: tablero de comandas activas y cambio de estado por comanda/línea. */
@Service
@Transactional
public class TpvKitchenService {

    private static final List<TpvOrder.KitchenStatus> ACTIVE = List.of(
        TpvOrder.KitchenStatus.PENDING, TpvOrder.KitchenStatus.PREPARING, TpvOrder.KitchenStatus.READY);

    public record KitchenLine(Long id, String name, BigDecimal qty, boolean modifier, boolean removal,
                              boolean done, String note) {}

    public record KitchenOrder(Long orderId, String number, String channel, String tableLabel,
                               String customerName, String status, String openedAt, List<KitchenLine> lines) {}

    private final TpvOrderRepository orderRepository;
    private final TpvOrderLineRepository lineRepository;
    private final TpvTableRepository tableRepository;

    public TpvKitchenService(TpvOrderRepository orderRepository,
                             TpvOrderLineRepository lineRepository,
                             TpvTableRepository tableRepository) {
        this.orderRepository = orderRepository;
        this.lineRepository = lineRepository;
        this.tableRepository = tableRepository;
    }

    @Transactional(readOnly = true)
    public List<KitchenOrder> board(Long companyId) {
        List<TpvOrder> orders = orderRepository.findByCompany_IdAndKitchenStatusInOrderByOpenedAtAsc(companyId, ACTIVE);
        return orders.stream().map(o -> toKitchenOrder(companyId, o)).filter(k -> !k.lines().isEmpty()).toList();
    }

    public KitchenOrder setOrderStatus(Long companyId, String email, Long orderId, String status) {
        TpvOrder order = orderRepository.findByIdAndCompany_Id(orderId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comanda no encontrada"));
        TpvOrder.KitchenStatus next;
        try {
            next = TpvOrder.KitchenStatus.valueOf(status != null ? status.trim().toUpperCase() : "");
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado de cocina inválido");
        }
        order.setKitchenStatus(next);
        orderRepository.save(order);
        return toKitchenOrder(companyId, order);
    }

    public KitchenOrder setLineDone(Long companyId, Long orderId, Long lineId, boolean done) {
        TpvOrder order = orderRepository.findByIdAndCompany_Id(orderId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comanda no encontrada"));
        TpvOrderLine line = lineRepository.findById(lineId)
            .filter(l -> l.getOrder().getId().equals(orderId) && l.getCompany().getId().equals(companyId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Línea no encontrada"));
        line.setKitchenDone(done);
        lineRepository.save(line);
        return toKitchenOrder(companyId, order);
    }

    private KitchenOrder toKitchenOrder(Long companyId, TpvOrder o) {
        List<KitchenLine> lines = lineRepository.findByOrder_IdOrderByIdAsc(o.getId()).stream()
            .filter(l -> l.isKitchen() && !l.isVoided())
            .map(l -> new KitchenLine(l.getId(), l.getNameSnapshot(), l.getQty(), l.getParentLineId() != null,
                l.isRemoval(), l.isKitchenDone(), l.getNote()))
            .toList();
        return new KitchenOrder(o.getId(), "#" + o.getId(), o.getChannel().name(),
            tableLabel(companyId, o.getTableId()), o.getCustomerName(), o.getKitchenStatus().name(),
            o.getOpenedAt() != null ? o.getOpenedAt().toString() : null, lines);
    }

    private String tableLabel(Long companyId, Long tableId) {
        if (tableId == null) return null;
        return tableRepository.findByIdAndCompany_Id(tableId, companyId).map(TpvTable::getLabel).orElse(null);
    }
}
