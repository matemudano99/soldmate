package com.soldmate.vacation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VacationRequestRepository extends JpaRepository<VacationRequest, Long> {

    List<VacationRequest> findByCompany_IdOrderByStartDateDesc(Long companyId);

    List<VacationRequest> findByCompany_IdAndUser_IdOrderByStartDateDesc(Long companyId, Long userId);
}
