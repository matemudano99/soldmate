package com.soldmate.finance;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class DailyFinanceService {

    private static final int MAX_RANGE_DAYS = 800;

    private final DailyFinanceEntryRepository repository;
    private final CompanyRepository companyRepository;

    public DailyFinanceService(DailyFinanceEntryRepository repository, CompanyRepository companyRepository) {
        this.repository = repository;
        this.companyRepository = companyRepository;
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
        return repository.findByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(companyId, from, to);
    }

    @Transactional
    public DailyFinanceEntry upsert(Long companyId, LocalDate entryDate, BigDecimal revenue, BigDecimal expenses, String notes) {
        if (entryDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha obligatoria");
        }
        if (revenue == null || revenue.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresos no válidos");
        }
        if (expenses == null || expenses.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gastos no válidos");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));

        DailyFinanceEntry row = repository.findByCompanyIdAndEntryDate(companyId, entryDate).orElseGet(() -> {
            DailyFinanceEntry e = new DailyFinanceEntry();
            e.setCompany(company);
            e.setEntryDate(entryDate);
            return e;
        });
        row.setRevenue(revenue);
        row.setExpenses(expenses);
        String n = notes == null ? null : notes.trim();
        if (n != null && n.isEmpty()) {
            n = null;
        }
        if (n != null && n.length() > 500) {
            n = n.substring(0, 500);
        }
        row.setNotes(n);
        row.setUpdatedAt(Instant.now());
        return repository.save(row);
    }

    @Transactional
    public void delete(Long companyId, LocalDate entryDate) {
        repository.deleteByCompanyIdAndEntryDate(companyId, entryDate);
    }
}
