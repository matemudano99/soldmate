package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TpvCashSessionRepository extends JpaRepository<TpvCashSession, Long> {

    Optional<TpvCashSession> findFirstByCompany_IdAndStatusOrderByOpenedAtDesc(Long companyId, TpvCashSession.Status status);

    Optional<TpvCashSession> findByIdAndCompany_Id(Long id, Long companyId);
}
