package com.soldmate.activity;

import com.soldmate.auth.JwtUtil;
import com.soldmate.incidents.Incident;
import com.soldmate.incidents.IncidentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/activity")
public class ActivityController {

    private final JwtUtil jwtUtil;
    private final IncidentRepository incidentRepository;

    public ActivityController(JwtUtil jwtUtil, IncidentRepository incidentRepository) {
        this.jwtUtil = jwtUtil;
        this.incidentRepository = incidentRepository;
    }

    public record ActivityItemResponse(
        Long id,
        String type,
        String title,
        String status,
        String priority,
        String createdAt,
        String actorName,
        String actorAvatarUrl,
        String actorEmail
    ) {}

    @GetMapping
    public ResponseEntity<List<ActivityItemResponse>> getActivity(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        List<ActivityItemResponse> items = incidentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
            .stream()
            .limit(60)
            .map(this::toActivity)
            .toList();
        return ResponseEntity.ok(items);
    }

    private ActivityItemResponse toActivity(Incident i) {
        String actorName = "Usuario";
        String actorEmail = null;
        String actorAvatar = null;
        if (i.getReportedBy() != null) {
            String first = i.getReportedBy().getFirstName();
            String last = i.getReportedBy().getLastName();
            String full = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
            actorName = full.isBlank() ? i.getReportedBy().getEmail() : full;
            actorEmail = i.getReportedBy().getEmail();
            actorAvatar = i.getReportedBy().getAvatarUrl();
        }
        return new ActivityItemResponse(
            i.getId(),
            "INCIDENT",
            i.getTitle(),
            i.getStatus().name(),
            i.getPriority().name(),
            i.getCreatedAt().toString(),
            actorName,
            actorAvatar,
            actorEmail
        );
    }
}
