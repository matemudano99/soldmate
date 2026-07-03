package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TpvCashMovementRepository extends JpaRepository<TpvCashMovement, Long> {

    List<TpvCashMovement> findBySession_IdOrderByIdAsc(Long sessionId);
}
