package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TpvOrderRepository extends JpaRepository<TpvOrder, Long> {

    Optional<TpvOrder> findByIdAndCompany_Id(Long id, Long companyId);

    List<TpvOrder> findByCompany_IdAndStatusOrderByOpenedAtAsc(Long companyId, TpvOrder.Status status);

    Optional<TpvOrder> findFirstByCompany_IdAndTableIdAndStatusOrderByOpenedAtAsc(
        Long companyId, Long tableId, TpvOrder.Status status);

    List<TpvOrder> findByCompany_IdAndBusinessDayAndStatusInOrderByOpenedAtAsc(
        Long companyId, LocalDate businessDay, List<TpvOrder.Status> statuses);

    List<TpvOrder> findByCompany_IdAndBusinessDayBetweenAndStatusInOrderByClosedAtDesc(
        Long companyId, LocalDate from, LocalDate to, List<TpvOrder.Status> statuses);

    List<TpvOrder> findByCompany_IdAndCustomerIdAndStatusInOrderByClosedAtDesc(
        Long companyId, Long customerId, List<TpvOrder.Status> statuses);

    List<TpvOrder> findByCompany_IdAndKitchenStatusInOrderByOpenedAtAsc(
        Long companyId, List<TpvOrder.KitchenStatus> statuses);
}
