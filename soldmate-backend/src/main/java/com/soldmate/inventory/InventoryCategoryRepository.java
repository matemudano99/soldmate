package com.soldmate.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, Long> {

    @Query("SELECT c FROM InventoryCategory c WHERE c.company.id = :companyId ORDER BY c.sortOrder ASC, c.name ASC")
    List<InventoryCategory> findByCompanyIdOrderBySortOrderAscNameAsc(@Param("companyId") Long companyId);

    @Query("SELECT COUNT(c) FROM InventoryCategory c WHERE c.company.id = :companyId")
    long countByCompanyId(@Param("companyId") Long companyId);

    Optional<InventoryCategory> findByIdAndCompanyId(Long id, Long companyId);

    boolean existsByCompanyIdAndNameIgnoreCase(Long companyId, String name);

    Optional<InventoryCategory> findByCompanyIdAndNameIgnoreCase(Long companyId, String name);
}
