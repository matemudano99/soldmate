package com.soldmate.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Consultas nativas por {@code company_id} para evitar ambigüedades de Spring Data
 * con la asociación {@code company} y fallos en despliegues con esquemas heterogéneos.
 */
public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, Long> {

    @Query(value = "SELECT * FROM inventory_categories WHERE company_id = :companyId ORDER BY sort_order ASC, name ASC", nativeQuery = true)
    List<InventoryCategory> findByCompanyIdOrderBySortOrderAscNameAsc(@Param("companyId") Long companyId);

    @Query(value = "SELECT COUNT(*) FROM inventory_categories WHERE company_id = :companyId", nativeQuery = true)
    Long countByCompanyId(@Param("companyId") Long companyId);

    @Query(value = "SELECT * FROM inventory_categories WHERE id = :id AND company_id = :companyId", nativeQuery = true)
    Optional<InventoryCategory> findByIdAndCompanyId(@Param("id") Long id, @Param("companyId") Long companyId);

    @Query(value = "SELECT COUNT(*) FROM inventory_categories ic WHERE ic.company_id = :companyId AND LOWER(ic.name) = LOWER(:name)", nativeQuery = true)
    Long countByCompanyIdAndNameIgnoreCase(@Param("companyId") Long companyId, @Param("name") String name);

    @Query(value = "SELECT * FROM inventory_categories WHERE company_id = :companyId AND LOWER(name) = LOWER(:name) LIMIT 1", nativeQuery = true)
    Optional<InventoryCategory> findByCompanyIdAndNameIgnoreCase(@Param("companyId") Long companyId, @Param("name") String name);
}
