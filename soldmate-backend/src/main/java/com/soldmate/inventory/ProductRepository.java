package com.soldmate.inventory;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA: consultas multi-tenant por company_id / company.id.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    @EntityGraph(attributePaths = {"supplier"})
    List<Product> findByCompanyId(Long companyId);

    List<Product> findByCompanyIdAndCategory(Long companyId, String category);

    @EntityGraph(attributePaths = {"supplier"})
    Optional<Product> findByIdAndCompanyId(Long id, Long companyId);

    Optional<Product> findByCompanyIdAndNameIgnoreCase(Long companyId, String name);
}
