package com.soldmate.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentCategoryRepository extends JpaRepository<DocumentCategory, Long> {

    List<DocumentCategory> findByCompanyIdOrderByName(Long companyId);

    Optional<DocumentCategory> findByIdAndCompanyId(Long id, Long companyId);

    boolean existsByCompanyIdAndNameIgnoreCase(Long companyId, String name);
}
