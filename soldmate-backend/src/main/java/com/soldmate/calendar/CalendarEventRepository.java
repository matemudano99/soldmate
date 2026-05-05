package com.soldmate.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    List<CalendarEvent> findByCompanyIdOrderByEventDateAscEventTimeAsc(Long companyId);
    List<CalendarEvent> findByCompanyIdAndEventDateBetweenOrderByEventDateAscEventTimeAsc(
        Long companyId,
        LocalDate from,
        LocalDate to
    );
    Optional<CalendarEvent> findByIdAndCompanyId(Long id, Long companyId);
}
