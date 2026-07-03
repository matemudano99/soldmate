package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TpvPaymentRepository extends JpaRepository<TpvPayment, Long> {

    List<TpvPayment> findByOrder_IdOrderByIdAsc(Long orderId);

    @Query("""
            SELECT p FROM TpvPayment p
            WHERE p.company.id = :companyId
              AND p.order.businessDay = :day
              AND p.order.status IN :statuses
            """)
    List<TpvPayment> findForBusinessDay(@Param("companyId") Long companyId,
                                        @Param("day") LocalDate day,
                                        @Param("statuses") List<TpvOrder.Status> statuses);

    /** Importe y propina por método de pago en un rango: [method, sum(amount), sum(tip)]. */
    @Query("""
            SELECT p.method, SUM(p.amount), SUM(p.tip)
            FROM TpvPayment p
            WHERE p.company.id = :companyId
              AND p.order.businessDay BETWEEN :from AND :to
              AND p.order.status IN :statuses
            GROUP BY p.method
            """)
    List<Object[]> sumByMethodForRange(@Param("companyId") Long companyId,
                                       @Param("from") LocalDate from,
                                       @Param("to") LocalDate to,
                                       @Param("statuses") List<TpvOrder.Status> statuses);
}
