package com.soldmate.shifts;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ShiftPlanRepository extends JpaRepository<ShiftPlan, Long> {

    List<ShiftPlan> findByCompany_IdOrderByShiftDateDescShiftNameAsc(Long companyId);

    List<ShiftPlan> findByCompany_IdAndShiftDateBetweenOrderByShiftDateAscShiftNameAsc(
        Long companyId, LocalDate from, LocalDate to);

    Optional<ShiftPlan> findByIdAndCompany_Id(Long id, Long companyId);
}
