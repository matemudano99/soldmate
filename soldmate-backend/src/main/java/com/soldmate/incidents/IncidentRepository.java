package com.soldmate.incidents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IncidentRepository extends JpaRepository<Incident, Long> {

    /** JOIN FETCH evita LazyInitializationException al serializar `reportedBy` fuera del servicio. */
    @Query("SELECT i FROM Incident i LEFT JOIN FETCH i.reportedBy WHERE i.company.id = :companyId ORDER BY i.createdAt DESC")
    List<Incident> findByCompanyIdOrderByCreatedAtDesc(@Param("companyId") Long companyId);

    @Query("SELECT i FROM Incident i LEFT JOIN FETCH i.reportedBy WHERE i.company.id = :companyId AND i.status = :status ORDER BY i.createdAt DESC")
    List<Incident> findByCompanyIdAndStatusOrderByCreatedAtDesc(
        @Param("companyId") Long companyId,
        @Param("status") Incident.Status status);

    @Query("SELECT i FROM Incident i LEFT JOIN FETCH i.reportedBy WHERE i.id = :id AND i.company.id = :companyId")
    Optional<Incident> findByIdAndCompanyId(@Param("id") Long id, @Param("companyId") Long companyId);
    boolean existsByCompanyId(Long companyId);

    @Query("SELECT COUNT(i) FROM Incident i " +
           "WHERE i.company.id = :companyId " +
           "AND i.status <> com.soldmate.incidents.Incident.Status.CLOSED")
    long countActiveByCompanyId(Long companyId);
}
