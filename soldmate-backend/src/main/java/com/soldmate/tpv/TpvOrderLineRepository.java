package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TpvOrderLineRepository extends JpaRepository<TpvOrderLine, Long> {

    List<TpvOrderLine> findByOrder_IdOrderByIdAsc(Long orderId);

    List<TpvOrderLine> findByOrder_IdAndVoidedFalse(Long orderId);

    List<TpvOrderLine> findByParentLineId(Long parentLineId);

    /** Top de productos por unidades en un rango: [nombre, sum(qty), sum(lineTotal)]. */
    @Query("""
            SELECT l.nameSnapshot, SUM(l.qty), SUM(l.lineTotal)
            FROM TpvOrderLine l
            WHERE l.company.id = :companyId
              AND l.order.businessDay BETWEEN :from AND :to
              AND l.order.status IN :statuses
              AND l.voided = false AND l.removal = false
            GROUP BY l.nameSnapshot
            ORDER BY SUM(l.qty) DESC
            """)
    List<Object[]> topProducts(@Param("companyId") Long companyId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               @Param("statuses") List<TpvOrder.Status> statuses);
}
