package com.soldmate.finance;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.auth.JwtUtil;
import com.soldmate.company.CompanySettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/v1/finance")
public class FinanceController {

    private final DailyFinanceService dailyFinanceService;
    private final CompanySettingsService companySettingsService;
    private final JwtUtil jwtUtil;
    private final ActivityLogger activityLogger;

    public FinanceController(
            DailyFinanceService dailyFinanceService,
            CompanySettingsService companySettingsService,
            JwtUtil jwtUtil,
            ActivityLogger activityLogger
    ) {
        this.dailyFinanceService = dailyFinanceService;
        this.companySettingsService = companySettingsService;
        this.jwtUtil = jwtUtil;
        this.activityLogger = activityLogger;
    }

    public record DailyFinanceExpenseLineResponse(String detail, BigDecimal amount) {}

    public record DailyFinanceResponse(
            Long id,
            String entryDate,
            BigDecimal cashOpening,
            BigDecimal incomeDataphone,
            BigDecimal incomeJustEat,
            BigDecimal incomeGlovo,
            BigDecimal incomeUberEats,
            BigDecimal cashClosing,
            BigDecimal revenue,
            BigDecimal expenses,
            BigDecimal finalBalance,
            List<DailyFinanceExpenseLineResponse> expenseLines,
            String notes,
            String createdAt,
            String createdBy,
            String updatedAt,
            String updatedBy
    ) {}

    public record DailyFinanceExpenseLineRequest(
            @NotBlank @Size(max = 200) String detail,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal amount
    ) {}

    public record DailyFinanceUpsertRequest(
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal cashOpening,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal incomeDataphone,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal incomeJustEat,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal incomeGlovo,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal incomeUberEats,
            @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") BigDecimal cashClosing,
            String notes,
            List<@Valid DailyFinanceExpenseLineRequest> expenseLines
    ) {}

    public record DailyFinanceUpsertResponse(DailyFinanceResponse data, List<String> warnings) {}

    private static DailyFinanceResponse toResponse(DailyFinanceEntry e, DailyFinanceService service) {
        List<DailyFinanceExpenseLine> lines = service.readExpenseLines(e);
        List<DailyFinanceExpenseLineResponse> lr = lines.stream()
                .map(l -> new DailyFinanceExpenseLineResponse(l.detail(), l.amount()))
                .toList();
        return new DailyFinanceResponse(
                e.getId(),
                e.getEntryDate().toString(),
                e.getCashOpening(),
                e.getIncomeDataphone(),
                e.getIncomeJustEat(),
                e.getIncomeGlovo(),
                e.getIncomeUberEats(),
                e.getCashClosing(),
                e.getRevenue(),
                e.getExpenses(),
                DailyFinanceService.computeFinalBalance(e),
                lr,
                e.getNotes(),
                e.getCreatedAt().toString(),
                e.getCreatedBy(),
                e.getUpdatedAt().toString(),
                e.getUpdatedBy()
        );
    }

    private static DailyFinanceUpsertCommand toCommand(DailyFinanceUpsertRequest body) {
        List<DailyFinanceExpenseLine> expenses = body.expenseLines() == null
                ? List.of()
                : body.expenseLines().stream()
                .map(r -> new DailyFinanceExpenseLine(r.detail(), r.amount()))
                .toList();
        return new DailyFinanceUpsertCommand(
                body.cashOpening(),
                body.incomeDataphone(),
                body.incomeJustEat(),
                body.incomeGlovo(),
                body.incomeUberEats(),
                body.cashClosing(),
                body.notes(),
                expenses
        );
    }

    @GetMapping("/locked-months")
    public ResponseEntity<List<String>> listLockedMonths(@RequestHeader("Authorization") String authHeader) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        return ResponseEntity.ok(companySettingsService.listLockedFinanceMonths(companyId));
    }

    @PostMapping("/locked-months/{yearMonth}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> lockMonth(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String yearMonth
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        YearMonth ym = YearMonth.parse(yearMonth);
        companySettingsService.lockFinanceMonth(companyId, ym.getYear(), ym.getMonthValue());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/locked-months/{yearMonth}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> unlockMonth(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String yearMonth
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        YearMonth ym = YearMonth.parse(yearMonth);
        companySettingsService.unlockFinanceMonth(companyId, ym.getYear(), ym.getMonthValue());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/daily")
    public ResponseEntity<List<DailyFinanceResponse>> listDaily(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        List<DailyFinanceEntry> entries = dailyFinanceService.list(companyId, from, to);
        List<DailyFinanceResponse> list = entries.stream()
                .map(e -> toResponse(e, dailyFinanceService))
                .toList();
        return ResponseEntity.ok(list);
    }

    @PutMapping("/daily/{date}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<DailyFinanceUpsertResponse> upsertDaily(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody DailyFinanceUpsertRequest body
    ) {
        String token = authHeader.substring(7);
        Long companyId = jwtUtil.extractCompanyId(token);
        String email = jwtUtil.extractEmail(token);
        boolean ownerBypass = "OWNER".equalsIgnoreCase(jwtUtil.extractRole(token));
        DailyFinanceUpsertResult result = dailyFinanceService.upsert(
                companyId, date, email, toCommand(body), ownerBypass);
        DailyFinanceResponse data = toResponse(result.entry(), dailyFinanceService);
        activityLogger.log(companyId, email, "FINANCE", "MODIFICADO",
                "Cierre caja " + date + " · canales " + body.incomeDataphone() + " / saldo " + data.finalBalance());
        return ResponseEntity.ok(new DailyFinanceUpsertResponse(data, result.warnings()));
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
        boolean ownerBypass = "OWNER".equalsIgnoreCase(jwtUtil.extractRole(token));
        dailyFinanceService.softDelete(companyId, date, email, ownerBypass);
        activityLogger.log(companyId, email, "FINANCE", "ELIMINADO", "Archivado cierre caja " + date);
        return ResponseEntity.noContent().build();
    }
}
