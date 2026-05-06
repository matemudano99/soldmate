package com.soldmate.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    
    @Query("SELECT a FROM ActivityLog a LEFT JOIN FETCH a.actor WHERE a.company.id = :companyId ORDER BY a.createdAt DESC")
    List<ActivityLog> findByCompanyIdOrderByCreatedAtDesc(@Param("companyId") Long companyId);
}
