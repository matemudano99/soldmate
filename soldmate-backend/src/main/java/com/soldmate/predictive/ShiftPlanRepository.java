package com.soldmate.predictive;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ShiftPlanRepository extends JpaRepository<ShiftPlan, Long> {
    List<ShiftPlan> findByCompanyIdAndShiftDateBetweenOrderByShiftDateAsc(Long companyId, LocalDate from, LocalDate to);
}
