package com.soldmate.finance;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.auth.JwtUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/finance")
public class FinanceController {

    private final DailyFinanceService dailyFinanceService;
    private final JwtUtil jwtUtil;
    private final ActivityLogger activityLogger;

    public FinanceController(DailyFinanceService dailyFinanceService, JwtUtil jwtUtil, ActivityLogger activityLogger) {
        this.dailyFinanceService = dailyFinanceService;
        this.jwtUtil = jwtUtil;
        this.activityLogger = activityLogger;
    }

    public record DailyFinanceResponse(
            Long id,
            String entryDate,
            BigDecimal revenue,
            BigDecimal expenses,
            String notes,
            String updatedAt
    ) {}

    public record DailyFinanceUpsertRequest(
            @NotNull @DecimalMin("0.00") BigDecimal revenue,
            @NotNull @DecimalMin("0.00") BigDecimal expenses,
            String notes
    ) {}

    private static DailyFinanceResponse toResponse(DailyFinanceEntry e) {
        return new DailyFinanceResponse(
                e.getId(),
                e.getEntryDate().toString(),
                e.getRevenue(),
                e.getExpenses(),
                e.getNotes(),
                e.getUpdatedAt().toString()
        );
    }

    @GetMapping("/daily")
    public ResponseEntity<List<DailyFinanceResponse>> listDaily(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        List<DailyFinanceResponse> list = dailyFinanceService.list(companyId, from, to).stream()
                .map(FinanceController::toResponse)
                .toList();
        return ResponseEntity.ok(list);
    }

    @PutMapping("/daily/{date}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<DailyFinanceResponse> upsertDaily(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody DailyFinanceUpsertRequest body
    ) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String email = jwtUtil.extractEmail(token);
        DailyFinanceEntry saved = dailyFinanceService.upsert(
                companyId,
                date,
                body.revenue(),
                body.expenses(),
                body.notes()
        );
        activityLogger.log(companyId, email, "FINANCE", "MODIFICADO",
                "Cierre diario " + date + " · ingresos " + body.revenue() + " · gastos " + body.expenses());
        return ResponseEntity.ok(toResponse(saved));
    }

    @DeleteMapping("/daily/{date}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<Void> deleteDaily(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String email = jwtUtil.extractEmail(token);
        dailyFinanceService.delete(companyId, date);
        activityLogger.log(companyId, email, "FINANCE", "ELIMINADO", "Eliminado cierre diario " + date);
        return ResponseEntity.noContent().build();
    }
}
