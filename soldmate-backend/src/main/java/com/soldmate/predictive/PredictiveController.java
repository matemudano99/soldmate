package com.soldmate.predictive;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.forecast.ForecastController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/predictions")
public class PredictiveController {

    private final JwtUtil jwtUtil;
    private final CompanyRepository companyRepository;
    private final SaleRecordRepository saleRecordRepository;
    private final ForecastController forecastController;

    public PredictiveController(JwtUtil jwtUtil,
                                CompanyRepository companyRepository,
                                SaleRecordRepository saleRecordRepository,
                                ForecastController forecastController) {
        this.jwtUtil = jwtUtil;
        this.companyRepository = companyRepository;
        this.saleRecordRepository = saleRecordRepository;
        this.forecastController = forecastController;
    }

    public record PredictiveDay(
        String date,
        double weatherImpact,
        double historicalBaseline,
        double predictedDemand,
        int suggestedStaff,
        String inventoryHint
    ) {}

    @GetMapping("/operations")
    public ResponseEntity<List<PredictiveDay>> predictOperations(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        LocalDate now = LocalDate.now();

        List<SaleRecord> historic = saleRecordRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateAsc(
            companyId,
            now.minusDays(60),
            now.minusDays(1)
        );

        Map<DayOfWeek, Double> baselineByDay = historic.stream()
            .collect(Collectors.groupingBy(
                s -> s.getSaleDate().getDayOfWeek(),
                Collectors.averagingDouble(s -> s.getTotal().doubleValue())
            ));

        Company company = companyRepository.findById(companyId).orElseThrow();
        double lat = company.getLatitude() != null ? company.getLatitude() : 40.4168;
        double lon = company.getLongitude() != null ? company.getLongitude() : -3.7038;
        List<ForecastController.ImpactDay> forecast = forecastController.getImpactForCoordinates(lat, lon);
        List<PredictiveDay> output = forecast.stream().map(f -> {
            LocalDate date = LocalDate.parse(f.date());
            double baseline = baselineByDay.getOrDefault(date.getDayOfWeek(), 250.0);
            double weatherFactor = Math.max(0.55, 1 - (f.impactScore() / 100.0));
            double predictedDemand = Math.round(baseline * weatherFactor * 100.0) / 100.0;
            int suggestedStaff = Math.max(1, (int) Math.round(predictedDemand / 180.0));
            String hint = predictedDemand < baseline * 0.8
                ? "Reducir compra de perecederos 10-20%"
                : "Mantener compra estándar";

            return new PredictiveDay(
                date.toString(),
                f.impactScore(),
                Math.round(baseline * 100.0) / 100.0,
                predictedDemand,
                suggestedStaff,
                hint
            );
        }).sorted(Comparator.comparing(PredictiveDay::date)).toList();

        return ResponseEntity.ok(output);
    }

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }
}
