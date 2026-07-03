package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Mesas del plano de sala. Lectura para autenticados; editar requiere SUPERVISOR+. */
@RestController
@RequestMapping("/api/v1/tpv/tables")
public class TpvTableController {

    private final TpvTableService tableService;
    private final OrderService orderService;
    private final JwtUtil jwtUtil;

    public TpvTableController(TpvTableService tableService, OrderService orderService, JwtUtil jwtUtil) {
        this.tableService = tableService;
        this.orderService = orderService;
        this.jwtUtil = jwtUtil;
    }

    public record TableResponse(Long id, String label, String zone, int seats, int posX, int posY,
                                int width, int height, String shape, int sortOrder, boolean active,
                                Long openOrderId, BigDecimal openTotal) {}

    public record TableRequest(@NotBlank String label, String zone, Integer seats, Integer posX, Integer posY,
                               Integer width, Integer height, String shape, Integer sortOrder, Boolean active) {
        TpvTableService.TableInput toInput() {
            return new TpvTableService.TableInput(label, zone, seats, posX, posY, width, height, shape, sortOrder, active);
        }
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<TableResponse> list(@RequestHeader("Authorization") String auth) {
        Long companyId = companyId(auth);
        // Mapa mesa → comanda abierta para derivar estado (libre/ocupada) y total.
        Map<Long, TpvOrder> openByTable = orderService.listOpen(companyId).stream()
            .filter(o -> o.getTableId() != null)
            .collect(Collectors.toMap(TpvOrder::getTableId, Function.identity(), (a, b) -> a));
        return tableService.list(companyId).stream()
            .map(t -> toResponse(t, openByTable.get(t.getId())))
            .toList();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<TableResponse> create(@RequestHeader("Authorization") String auth,
                                                @RequestBody TableRequest req) {
        TpvTable t = tableService.create(companyId(auth), email(auth), req.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(t, null));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public TableResponse update(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                @RequestBody TableRequest req) {
        TpvTable t = tableService.update(companyId(auth), email(auth), id, req.toInput());
        return toResponse(t, null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<Void> delete(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        tableService.delete(companyId(auth), email(auth), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/seed-default")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<TableResponse> seedDefault(@RequestHeader("Authorization") String auth) {
        tableService.seedDefaultLayout(companyId(auth), email(auth));
        return list(auth);
    }

    private TableResponse toResponse(TpvTable t, TpvOrder openOrder) {
        return new TableResponse(t.getId(), t.getLabel(), t.getZone(), t.getSeats(), t.getPosX(), t.getPosY(),
            t.getWidth(), t.getHeight(), t.getShape().name(), t.getSortOrder(), t.isActive(),
            openOrder != null ? openOrder.getId() : null,
            openOrder != null ? openOrder.getTotal() : null);
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
