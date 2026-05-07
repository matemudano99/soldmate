package com.soldmate.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    long countByCompanyIdAndReadAtIsNull(Long companyId);

    Optional<Notification> findByIdAndCompanyId(Long id, Long companyId);

    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.company.id = :companyId AND n.readAt IS NULL")
    int markAllRead(Long companyId);
}
