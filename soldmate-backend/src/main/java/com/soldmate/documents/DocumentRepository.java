package com.soldmate.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    @Query("SELECT d FROM Document d LEFT JOIN FETCH d.uploadedBy WHERE d.company.id = :companyId ORDER BY d.createdAt DESC")
    List<Document> findByCompanyIdOrderByCreatedAtDesc(@Param("companyId") Long companyId);

    @Query("SELECT d FROM Document d LEFT JOIN FETCH d.uploadedBy WHERE d.company.id = :companyId AND d.category = :category ORDER BY d.createdAt DESC")
    List<Document> findByCompanyIdAndCategoryOrderByCreatedAtDesc(
        @Param("companyId") Long companyId,
        @Param("category") String category);

    @Query("SELECT d FROM Document d LEFT JOIN FETCH d.uploadedBy WHERE d.id = :id AND d.company.id = :companyId")
    Optional<Document> findByIdAndCompanyId(@Param("id") Long id, @Param("companyId") Long companyId);

    long countByCompanyId(Long companyId);

    /** Suma total de bytes para el cálculo de almacenamiento. */
    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.company.id = :companyId")
    long sumFileSizeByCompanyId(@Param("companyId") Long companyId);

    /** Documentos subidos desde la fecha indicada (para el contador "nuevos esta semana"). */
    @Query("SELECT COUNT(d) FROM Document d WHERE d.company.id = :companyId AND d.createdAt >= :since")
    long countByCompanyIdAndCreatedAtAfter(@Param("companyId") Long companyId, @Param("since") LocalDateTime since);
}
