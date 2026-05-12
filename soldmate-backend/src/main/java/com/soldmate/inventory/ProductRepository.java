package com.soldmate.inventory;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA: consultas multi-tenant por company_id / company.id.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    @EntityGraph(attributePaths = {"supplier"})
    @Query(
            """
                    SELECT p FROM Product p
                    WHERE p.company.id = :companyId
                    ORDER BY LOWER(COALESCE(NULLIF(TRIM(BOTH FROM p.category), ''), 'Ninguna')),
                             LOWER(p.name),
                             p.id
                    """)
    List<Product> findByCompanyId(@Param("companyId") Long companyId);

    List<Product> findByCompanyIdAndCategory(Long companyId, String category);

    @EntityGraph(attributePaths = {"supplier"})
    Optional<Product> findByIdAndCompanyId(Long id, Long companyId);

    Optional<Product> findByCompanyIdAndNameIgnoreCase(Long companyId, String name);
}
