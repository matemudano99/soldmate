package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Informes de caja del TPV: X (resumen) y Z (cierre que concilia con Finanzas). */
@RestController
@RequestMapping("/api/v1/tpv/reports")
public class TpvReportController {

    private final TpvReportService reportService;
    private final JwtUtil jwtUtil;

    public TpvReportController(TpvReportService reportService, JwtUtil jwtUtil) {
        this.reportService = reportService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/x")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public TpvReportService.DayReport xReport(
        @RequestHeader("Authorization") String auth,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reportService.xReport(companyId(auth), date != null ? date : LocalDate.now());
    }

    @PostMapping("/z")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public TpvReportService.DayReport zClose(
        @RequestHeader("Authorization") String auth,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        String token = auth.substring(7);
        String role = jwtUtil.extractRole(token);
        boolean ownerBypass = "OWNER".equalsIgnoreCase(role) || "DEV".equalsIgnoreCase(role);
        return reportService.zClose(
            jwtUtil.extractCompanyId(token),
            date != null ? date : LocalDate.now(),
            jwtUtil.extractEmail(token),
            ownerBypass
        );
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }
}
