package com.soldmate.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyFinanceEntryRepository extends JpaRepository<DailyFinanceEntry, Long> {

    List<DailyFinanceEntry> findByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(
            Long companyId, LocalDate fromInclusive, LocalDate toInclusive);

    Optional<DailyFinanceEntry> findByCompanyIdAndEntryDate(Long companyId, LocalDate entryDate);

    void deleteByCompanyIdAndEntryDate(Long companyId, LocalDate entryDate);
}
