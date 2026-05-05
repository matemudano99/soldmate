package com.soldmate.predictive;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface SaleRecordRepository extends JpaRepository<SaleRecord, Long> {
    List<SaleRecord> findByCompanyIdAndSaleDateBetweenOrderBySaleDateAsc(Long companyId, LocalDate from, LocalDate to);
}
