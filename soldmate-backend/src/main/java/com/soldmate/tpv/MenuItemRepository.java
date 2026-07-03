package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {

    List<MenuItem> findByCompany_IdOrderBySortOrderAscNameAsc(Long companyId);

    List<MenuItem> findByCompany_IdAndCategory_IdOrderBySortOrderAscNameAsc(Long companyId, Long categoryId);

    Optional<MenuItem> findByIdAndCompany_Id(Long id, Long companyId);
}
