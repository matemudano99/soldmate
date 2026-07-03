package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

/** Arqueo de caja del TPV: apertura, movimientos y cierre con conteo. */
@RestController
@RequestMapping("/api/v1/tpv/cash")
public class TpvCashController {

    private final TpvCashService cashService;
    private final JwtUtil jwtUtil;

    public TpvCashController(TpvCashService cashService, JwtUtil jwtUtil) {
        this.cashService = cashService;
        this.jwtUtil = jwtUtil;
    }

    public record OpenRequest(BigDecimal openingFloat) {}

    public record MovementRequest(String type, BigDecimal amount, String reason) {}

    public record CloseRequest(BigDecimal countedCash, String note) {}

    @GetMapping("/current")
    @PreAuthorize("isAuthenticated()")
    public TpvCashService.CashState current(@RequestHeader("Authorization") String auth) {
        return cashService.current(companyId(auth));
    }

    @PostMapping("/open")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public TpvCashService.CashState open(@RequestHeader("Authorization") String auth, @RequestBody OpenRequest req) {
        return cashService.open(companyId(auth), email(auth), req.openingFloat());
    }

    @PostMapping("/movement")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public TpvCashService.CashState movement(@RequestHeader("Authorization") String auth, @RequestBody MovementRequest req) {
        return cashService.addMovement(companyId(auth), email(auth), req.type(), req.amount(), req.reason());
    }

    @PostMapping("/close")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public TpvCashService.CloseResult close(@RequestHeader("Authorization") String auth, @RequestBody CloseRequest req) {
        return cashService.close(companyId(auth), email(auth), req.countedCash(), req.note());
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
