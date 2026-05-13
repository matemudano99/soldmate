package com.soldmate.finance;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.company.CompanySettingsService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class DailyFinanceService {

    private static final int MAX_RANGE_DAYS = 800;
    public static final BigDecimal MAX_DAILY_AMOUNT = new BigDecimal("99999999.99");
    private static final int MAX_YEARS_PAST = 10;
    private static final int MAX_FUTURE_DAYS = 1;
    private static final int MAX_INCOME_CHANNELS = 30;
    private static final int MAX_INCOME_CHANNEL_NAME_LEN = 80;
    private static final int MAX_EXPENSE_LINES = 100;
    private static final int MAX_EXPENSE_DETAIL_LEN = 200;

    private final DailyFinanceEntryRepository repository;
    private final CompanyRepository companyRepository;
    private final CompanySettingsService companySettingsService;
    private final FinanceIncomeChannelTemplateService incomeChannelTemplateService;
    private final ObjectMapper objectMapper;

    public DailyFinanceService(
            DailyFinanceEntryRepository repository,
            CompanyRepository companyRepository,
            CompanySettingsService companySettingsService,
            FinanceIncomeChannelTemplateService incomeChannelTemplateService,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.companyRepository = companyRepository;
        this.companySettingsService = companySettingsService;
        this.incomeChannelTemplateService = incomeChannelTemplateService;
        this.objectMapper = objectMapper;
    }

    public List<DailyFinanceEntry> list(Long companyId, LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from y to son obligatorios (YYYY-MM-DD)");
        }
        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from no puede ser posterior a to");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rango máximo de " + MAX_RANGE_DAYS + " días");
        }
        return repository.findByCompanyIdAndEntryDateBetweenAndDeletedAtIsNullOrderByEntryDateDesc(companyId, from, to);
    }

    public List<DailyFinanceExpenseLine> readExpenseLines(DailyFinanceEntry e) {
        try {
            List<DailyFinanceExpenseLine> list = objectMapper.readValue(
                    e.getExpenseLinesJson(),
                    new TypeReference<>() {}
            );
            return list == null ? List.of() : list;
        } catch (Exception ex) {
            return List.of();
        }
    }

    public List<DailyFinanceIncomeChannel> readIncomeChannels(DailyFinanceEntry e) {
        try {
            List<DailyFinanceIncomeChannel> list = objectMapper.readValue(
                    e.getIncomeChannelsJson(),
                    new TypeReference<>() {}
            );
            return list == null ? List.of() : list;
        } catch (Exception ex) {
            return List.of();
        }
    }

    public static BigDecimal computeFinalBalance(DailyFinanceEntry e) {
        return e.getRevenue().add(e.getExpenses()).add(e.getCashClosing()).subtract(e.getCashOpening());
    }

    @Transactional
    public DailyFinanceUpsertResult upsert(
            Long companyId,
            LocalDate entryDate,
            String actorEmail,
            DailyFinanceUpsertCommand cmd,
            boolean ownerBypassMonthLock
    ) {
        if (entryDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha obligatoria");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));

        validateEntryDate(company, entryDate);
        if (companySettingsService.isFinanceMonthLocked(companyId, entryDate) && !ownerBypassMonthLock) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este mes está bloqueado para ediciones. Solo el dueño de la empresa puede desbloquearlo.");
        }

        BigDecimal cashOpening = requireMoney(cmd.cashOpening(), "Efectivo al abrir");
        BigDecimal cashClosing = requireMoney(cmd.cashClosing(), "Efectivo al cierre");
        List<DailyFinanceIncomeChannel> incomeChannels = validateAndNormalizeIncomeChannels(cmd.incomeChannels());

        List<DailyFinanceExpenseLine> expenseLines = validateAndNormalizeExpenseLines(cmd.expenseLines());
        BigDecimal expenseTotal = sumExpenseLines(expenseLines);
        if (expenseTotal.compareTo(MAX_DAILY_AMOUNT) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La suma de gastos supera el máximo permitido");
        }

        BigDecimal channelTotal = sumIncomeChannels(incomeChannels);
        if (channelTotal.compareTo(MAX_DAILY_AMOUNT) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La suma de ingresos por canales supera el máximo permitido");
        }

        List<String> warnings = buildWarnings(companyId, entryDate, channelTotal, expenseTotal);

        DailyFinanceEntry row = repository.findByCompanyIdAndEntryDate(companyId, entryDate).orElseGet(() -> {
            DailyFinanceEntry e = new DailyFinanceEntry();
            e.setCompany(company);
            e.setEntryDate(entryDate);
            e.setCreatedAt(Instant.now());
            e.setCreatedBy(actorEmail);
            return e;
        });
        if (row.getDeletedAt() != null) {
            row.setDeletedAt(null);
        }

        row.setCashOpening(cashOpening);
        row.setIncomeDataphone(sumChannelsByName(incomeChannels, "datáfono", "datáfono (tpv)", "tpv", "datafono"));
        row.setIncomeJustEat(sumChannelsByName(incomeChannels, "just eat", "justeat"));
        row.setIncomeGlovo(sumChannelsByName(incomeChannels, "glovo"));
        row.setIncomeUberEats(sumChannelsByName(incomeChannels, "uber eats", "ubereats"));
        row.setCashClosing(cashClosing);
        row.setRevenue(channelTotal);
        row.setExpenses(expenseTotal);

        try {
            row.setExpenseLinesJson(objectMapper.writeValueAsString(expenseLines));
            row.setIncomeChannelsJson(objectMapper.writeValueAsString(incomeChannels));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo serializar líneas de caja");
        }

        String n = cmd.notes() == null ? null : cmd.notes().trim();
        if (n != null && n.isEmpty()) {
            n = null;
        }
        if (n != null && n.length() > 500) {
            n = n.substring(0, 500);
        }
        row.setNotes(n);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(actorEmail);

        DailyFinanceEntry saved = repository.save(row);
        incomeChannelTemplateService.mergeNames(
                companyId,
                incomeChannels.stream().map(DailyFinanceIncomeChannel::name).toList()
        );

        return new DailyFinanceUpsertResult(saved, warnings);
    }

    @Transactional
    public void softDelete(Long companyId, LocalDate entryDate, String actorEmail, boolean ownerBypassMonthLock) {
        DailyFinanceEntry row = repository.findByCompanyIdAndEntryDate(companyId, entryDate)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cierre no encontrado"));
        if (row.getDeletedAt() != null) {
            return;
        }
        if (companySettingsService.isFinanceMonthLocked(companyId, entryDate) && !ownerBypassMonthLock) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este mes está bloqueado; no se puede archivar el cierre.");
        }
        row.setDeletedAt(Instant.now());
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(actorEmail);
        repository.save(row);
    }

    private static void validateEntryDate(Company company, LocalDate entryDate) {
        LocalDate today = LocalDate.now(FinanceTimeZones.resolveZoneId(company.getTimezone()));
        if (entryDate.isAfter(today.plusDays(MAX_FUTURE_DAYS))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser más de " + MAX_FUTURE_DAYS + " día(s) en el futuro");
        }
        if (entryDate.isBefore(today.minusYears(MAX_YEARS_PAST))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser anterior a " + MAX_YEARS_PAST + " años");
        }
    }

    private static BigDecimal requireMoney(BigDecimal value, String label) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + ": obligatorio");
        }
        BigDecimal v = value.setScale(2, RoundingMode.HALF_UP);
        if (v.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + ": no puede ser negativo");
        }
        if (v.compareTo(MAX_DAILY_AMOUNT) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + ": supera el máximo permitido (" + MAX_DAILY_AMOUNT + ")");
        }
        return v;
    }

    private List<DailyFinanceExpenseLine> validateAndNormalizeExpenseLines(List<DailyFinanceExpenseLine> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        if (raw.size() > MAX_EXPENSE_LINES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo " + MAX_EXPENSE_LINES + " líneas de gasto");
        }
        List<DailyFinanceExpenseLine> out = new ArrayList<>();
        for (DailyFinanceExpenseLine line : raw) {
            if (line == null || line.detail() == null || line.detail().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada gasto debe tener detalle");
            }
            String d = line.detail().trim();
            if (d.length() > MAX_EXPENSE_DETAIL_LEN) {
                d = d.substring(0, MAX_EXPENSE_DETAIL_LEN);
            }
            BigDecimal a = line.amount() == null
                    ? BigDecimal.ZERO
                    : line.amount().setScale(2, RoundingMode.HALF_UP);
            if (a.compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe de gasto no puede ser negativo");
            }
            if (a.compareTo(MAX_DAILY_AMOUNT) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe de gasto fuera de rango");
            }
            out.add(new DailyFinanceExpenseLine(d, a));
        }
        return out;
    }

    private List<DailyFinanceIncomeChannel> validateAndNormalizeIncomeChannels(List<DailyFinanceIncomeChannel> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes registrar al menos un canal de ingreso");
        }
        if (raw.size() > MAX_INCOME_CHANNELS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo " + MAX_INCOME_CHANNELS + " canales de ingreso");
        }
        List<DailyFinanceIncomeChannel> out = new ArrayList<>();
        for (DailyFinanceIncomeChannel line : raw) {
            if (line == null || line.name() == null || line.name().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada canal debe tener nombre");
            }
            String name = line.name().trim();
            if (name.length() > MAX_INCOME_CHANNEL_NAME_LEN) {
                name = name.substring(0, MAX_INCOME_CHANNEL_NAME_LEN);
            }
            BigDecimal amount = line.amount() == null
                    ? BigDecimal.ZERO
                    : line.amount().setScale(2, RoundingMode.HALF_UP);
            if (amount.compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe de canal no puede ser negativo");
            }
            if (amount.compareTo(MAX_DAILY_AMOUNT) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe de canal fuera de rango");
            }
            out.add(new DailyFinanceIncomeChannel(name, amount));
        }
        return out;
    }

    private static BigDecimal sumIncomeChannels(List<DailyFinanceIncomeChannel> lines) {
        BigDecimal s = BigDecimal.ZERO;
        for (DailyFinanceIncomeChannel l : lines) {
            s = s.add(l.amount());
        }
        return s.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal sumChannelsByName(List<DailyFinanceIncomeChannel> lines, String... names) {
        BigDecimal sum = BigDecimal.ZERO;
        for (DailyFinanceIncomeChannel line : lines) {
            String normalized = normalize(line.name());
            for (String name : names) {
                if (normalized.equals(normalize(name))) {
                    sum = sum.add(line.amount());
                    break;
                }
            }
        }
        return sum.setScale(2, RoundingMode.HALF_UP);
    }

    private static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private static BigDecimal sumExpenseLines(List<DailyFinanceExpenseLine> lines) {
        BigDecimal s = BigDecimal.ZERO;
        for (DailyFinanceExpenseLine l : lines) {
            s = s.add(l.amount());
        }
        return s.setScale(2, RoundingMode.HALF_UP);
    }

    private List<String> buildWarnings(Long companyId, LocalDate entryDate, BigDecimal channelTotal, BigDecimal expenseTotal) {
        List<String> warnings = new ArrayList<>();
        if (expenseTotal.compareTo(BigDecimal.ZERO) > 0 && channelTotal.compareTo(BigDecimal.ZERO) > 0) {
            if (expenseTotal.compareTo(channelTotal.multiply(new BigDecimal("3"))) > 0) {
                warnings.add("Los gastos superan el triple de los ingresos por canales (datáfono + apps).");
            }
        }
        List<DailyFinanceEntry> recent = repository.findByCompanyIdAndDeletedAtIsNullAndEntryDateLessThanOrderByEntryDateDesc(
                companyId, entryDate, PageRequest.of(0, 60));
        List<BigDecimal> prevChannels = recent.stream()
                .map(DailyFinanceEntry::getRevenue)
                .filter(r -> r.compareTo(BigDecimal.ZERO) > 0)
                .sorted()
                .toList();
        if (!prevChannels.isEmpty() && channelTotal.compareTo(BigDecimal.ZERO) > 0) {
            List<BigDecimal> sorted = new ArrayList<>(prevChannels);
            Collections.sort(sorted);
            BigDecimal median = sorted.get(sorted.size() / 2);
            if (median.compareTo(BigDecimal.ZERO) > 0 && channelTotal.compareTo(median.multiply(new BigDecimal("5"))) > 0) {
                warnings.add("Los ingresos por canales son más de 5× la mediana reciente.");
            }
        }
        return warnings;
    }
}
