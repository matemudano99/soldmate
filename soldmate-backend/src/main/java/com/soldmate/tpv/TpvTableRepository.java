package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TpvTableRepository extends JpaRepository<TpvTable, Long> {

    List<TpvTable> findByCompany_IdOrderBySortOrderAscIdAsc(Long companyId);

    Optional<TpvTable> findByIdAndCompany_Id(Long id, Long companyId);

    long countByCompany_Id(Long companyId);
}
