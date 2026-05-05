package com.soldmate.alerts;

import com.soldmate.auth.JwtUtil;
import com.soldmate.calendar.CalendarEvent;
import com.soldmate.calendar.CalendarEventRepository;
import com.soldmate.incidents.Incident;
import com.soldmate.incidents.IncidentRepository;
import com.soldmate.inventory.Product;
import com.soldmate.inventory.ProductRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertsController {

    private final JwtUtil jwtUtil;
    private final ProductRepository productRepository;
    private final IncidentRepository incidentRepository;
    private final CalendarEventRepository calendarEventRepository;

    public AlertsController(JwtUtil jwtUtil,
                            ProductRepository productRepository,
                            IncidentRepository incidentRepository,
                            CalendarEventRepository calendarEventRepository) {
        this.jwtUtil = jwtUtil;
        this.productRepository = productRepository;
        this.incidentRepository = incidentRepository;
        this.calendarEventRepository = calendarEventRepository;
    }

    public record AlertItem(String text, String type, String source) {}

    @GetMapping
    public ResponseEntity<List<AlertItem>> getAlerts(@RequestHeader("Authorization") String authHeader) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        List<AlertItem> alerts = new ArrayList<>();

        List<Product> lowStock = productRepository.findByCompanyId(companyId).stream()
            .filter(Product::isLowStock)
            .limit(3)
            .toList();
        for (Product p : lowStock) {
            alerts.add(new AlertItem("Stock crítico: " + p.getName(), "critical", "inventory"));
        }

        List<Incident> incidents = incidentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        long staleIncidents = incidents.stream()
            .filter(i -> i.getStatus() != Incident.Status.CLOSED)
            .filter(i -> i.getCreatedAt().isBefore(LocalDateTime.now().minusHours(24)))
            .count();
        if (staleIncidents > 0) {
            alerts.add(new AlertItem(
                staleIncidents + " incidencias abiertas > 24h",
                "warning",
                "incidents"
            ));
        }

        List<CalendarEvent> dueToday = calendarEventRepository
            .findByCompanyIdAndEventDateBetweenOrderByEventDateAscEventTimeAsc(
                companyId,
                LocalDate.now(),
                LocalDate.now()
            );
        if (!dueToday.isEmpty()) {
            alerts.add(new AlertItem(
                dueToday.size() + " tareas programadas para hoy",
                "warning",
                "calendar"
            ));
        }

        if (alerts.isEmpty()) {
            alerts.add(new AlertItem("Operación estable. No hay alertas críticas activas.", "success", "system"));
        }

        return ResponseEntity.ok(alerts);
    }
}
