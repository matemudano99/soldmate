package com.soldmate.dashboard;

import com.soldmate.auth.JwtUtil;
import com.soldmate.crm.ContactRepository;
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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final JwtUtil jwtUtil;
    private final ProductRepository productRepository;
    private final IncidentRepository incidentRepository;
    private final ContactRepository contactRepository;

    public DashboardController(JwtUtil jwtUtil,
                               ProductRepository productRepository,
                               IncidentRepository incidentRepository,
                               ContactRepository contactRepository) {
        this.jwtUtil = jwtUtil;
        this.productRepository = productRepository;
        this.incidentRepository = incidentRepository;
        this.contactRepository = contactRepository;
    }

    public record DashboardSummaryResponse(
        long totalProducts,
        long lowStockProducts,
        long totalIncidents,
        long openIncidents,
        long inProgressIncidents,
        long closedIncidents,
        long activeContacts,
        long totalContacts,
        List<WeeklyPoint> weeklyIncidentsByDay,
        List<RecentIncident> recentIncidents
    ) {}

    public record WeeklyPoint(String day, long incidents) {}

    public record RecentIncident(
        Long id,
        String title,
        String priority,
        String status,
        String createdAt,
        String reportedBy
    ) {}

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryResponse> getSummary(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));

        List<Product> products = productRepository.findByCompanyId(companyId);
        List<Incident> incidents = incidentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        long totalContacts = contactRepository.countByCompanyId(companyId);
        long activeContacts = contactRepository.findByCompanyIdAndActiveTrue(companyId).size();

        long lowStockProducts = products.stream().filter(Product::isLowStock).count();
        long open = incidents.stream().filter(i -> i.getStatus() == Incident.Status.OPEN).count();
        long inProgress = incidents.stream().filter(i -> i.getStatus() == Incident.Status.IN_PROGRESS).count();
        long closed = incidents.stream().filter(i -> i.getStatus() == Incident.Status.CLOSED).count();

        Map<LocalDate, Long> incidentsByDate = incidents.stream()
            .collect(Collectors.groupingBy(i -> i.getCreatedAt().toLocalDate(), Collectors.counting()));

        List<WeeklyPoint> weekly = LocalDate.now().minusDays(6).datesUntil(LocalDate.now().plusDays(1))
            .map(date -> new WeeklyPoint(
                date.getDayOfWeek().name(),
                incidentsByDate.getOrDefault(date, 0L)
            ))
            .toList();

        List<RecentIncident> recent = incidents.stream()
            .limit(6)
            .map(i -> new RecentIncident(
                i.getId(),
                i.getTitle(),
                i.getPriority().name(),
                i.getStatus().name(),
                i.getCreatedAt().toString(),
                i.getReportedBy() != null ? i.getReportedBy().getEmail() : null
            ))
            .toList();

        return ResponseEntity.ok(new DashboardSummaryResponse(
            products.size(),
            lowStockProducts,
            incidents.size(),
            open,
            inProgress,
            closed,
            activeContacts,
            totalContacts,
            weekly,
            recent
        ));
    }
}
