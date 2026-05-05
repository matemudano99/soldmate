package com.soldmate.calendar;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/calendar/events")
public class CalendarController {

    private final JwtUtil jwtUtil;
    private final CompanyRepository companyRepository;
    private final CalendarEventRepository calendarEventRepository;

    public CalendarController(JwtUtil jwtUtil,
                              CompanyRepository companyRepository,
                              CalendarEventRepository calendarEventRepository) {
        this.jwtUtil = jwtUtil;
        this.companyRepository = companyRepository;
        this.calendarEventRepository = calendarEventRepository;
    }

    public record CalendarEventResponse(
        Long id,
        String title,
        String notes,
        String eventDate,
        String eventTime,
        String source
    ) {
        public static CalendarEventResponse from(CalendarEvent e) {
            return new CalendarEventResponse(
                e.getId(),
                e.getTitle(),
                e.getNotes(),
                e.getEventDate().toString(),
                e.getEventTime() != null ? e.getEventTime().toString() : null,
                e.getSource()
            );
        }
    }

    public record CreateCalendarEventRequest(
        @NotBlank String title,
        String notes,
        @NotNull String eventDate,
        String eventTime
    ) {}

    @GetMapping
    public ResponseEntity<List<CalendarEventResponse>> getEvents(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<CalendarEvent> events;
        if (from != null && to != null) {
            events = calendarEventRepository.findByCompanyIdAndEventDateBetweenOrderByEventDateAscEventTimeAsc(
                companyId,
                LocalDate.parse(from),
                LocalDate.parse(to)
            );
        } else {
            events = calendarEventRepository.findByCompanyIdOrderByEventDateAscEventTimeAsc(companyId);
        }
        return ResponseEntity.ok(events.stream().map(CalendarEventResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<CalendarEventResponse> createEvent(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody CreateCalendarEventRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        CalendarEvent event = new CalendarEvent();
        event.setCompany(company);
        event.setTitle(req.title().trim());
        event.setNotes(req.notes());
        event.setEventDate(LocalDate.parse(req.eventDate()));
        event.setEventTime(parseTime(req.eventTime()));
        event.setSource("MANUAL");

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(CalendarEventResponse.from(calendarEventRepository.save(event)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CalendarEventResponse> updateEvent(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @Valid @RequestBody CreateCalendarEventRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        CalendarEvent event = calendarEventRepository.findByIdAndCompanyId(id, companyId).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }

        event.setTitle(req.title().trim());
        event.setNotes(req.notes());
        event.setEventDate(LocalDate.parse(req.eventDate()));
        event.setEventTime(parseTime(req.eventTime()));

        return ResponseEntity.ok(CalendarEventResponse.from(calendarEventRepository.save(event)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        CalendarEvent event = calendarEventRepository.findByIdAndCompanyId(id, companyId).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }
        calendarEventRepository.delete(event);
        return ResponseEntity.noContent().build();
    }

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }

    private LocalTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        if (raw.length() == 5) return LocalTime.parse(raw + ":00");
        return LocalTime.parse(raw);
    }
}
