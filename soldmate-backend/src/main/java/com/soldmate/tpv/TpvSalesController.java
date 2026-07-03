package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Historial de ventas del TPV y recibo (ticket/justificante) de cada comanda cobrada. */
@RestController
@RequestMapping("/api/v1/tpv/sales")
public class TpvSalesController {

    private final TpvSalesService salesService;
    private final TpvDashboardService dashboardService;
    private final JwtUtil jwtUtil;

    public TpvSalesController(TpvSalesService salesService, TpvDashboardService dashboardService, JwtUtil jwtUtil) {
        this.salesService = salesService;
        this.dashboardService = dashboardService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public List<TpvSalesService.SaleSummary> list(
        @RequestHeader("Authorization") String auth,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate fromDay = from != null ? from : LocalDate.now();
        LocalDate toDay = to != null ? to : fromDay;
        return salesService.listSales(companyId(auth), fromDay, toDay);
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public TpvDashboardService.Dashboard dashboard(
        @RequestHeader("Authorization") String auth,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate fromDay = from != null ? from : LocalDate.now();
        LocalDate toDay = to != null ? to : fromDay;
        return dashboardService.build(companyId(auth), fromDay, toDay);
    }

    @GetMapping("/{orderId}/receipt")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public TpvSalesService.Receipt receipt(@RequestHeader("Authorization") String auth, @PathVariable Long orderId) {
        return salesService.receipt(companyId(auth), orderId);
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }
}
