package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** KDS de cocina: tablero en vivo y cambio de estado. Accesible al personal (EMPLOYEE+). */
@RestController
@RequestMapping("/api/v1/tpv/kitchen")
public class TpvKitchenController {

    private final TpvKitchenService kitchenService;
    private final JwtUtil jwtUtil;

    public TpvKitchenController(TpvKitchenService kitchenService, JwtUtil jwtUtil) {
        this.kitchenService = kitchenService;
        this.jwtUtil = jwtUtil;
    }

    public record StatusRequest(String status) {}

    public record DoneRequest(boolean done) {}

    @GetMapping("/board")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public List<TpvKitchenService.KitchenOrder> board(@RequestHeader("Authorization") String auth) {
        return kitchenService.board(companyId(auth));
    }

    @PostMapping("/orders/{orderId}/status")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public TpvKitchenService.KitchenOrder setStatus(@RequestHeader("Authorization") String auth,
                                                    @PathVariable Long orderId, @RequestBody StatusRequest req) {
        return kitchenService.setOrderStatus(companyId(auth), email(auth), orderId, req.status());
    }

    @PostMapping("/orders/{orderId}/lines/{lineId}/done")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public TpvKitchenService.KitchenOrder setLineDone(@RequestHeader("Authorization") String auth,
                                                      @PathVariable Long orderId, @PathVariable Long lineId,
                                                      @RequestBody DoneRequest req) {
        return kitchenService.setLineDone(companyId(auth), orderId, lineId, req.done());
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
