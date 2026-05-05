package com.soldmate.forecast;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/forecast")
public class ForecastController {

    private final RestTemplate restTemplate;
    private final JwtUtil jwtUtil;
    private final CompanyRepository companyRepository;

    @Value("${soldmate.weather.default-latitude:40.4168}")
    private double defaultLatitude;

    @Value("${soldmate.weather.default-longitude:-3.7038}")
    private double defaultLongitude;

    public ForecastController(JwtUtil jwtUtil, CompanyRepository companyRepository) {
        this.jwtUtil = jwtUtil;
        this.companyRepository = companyRepository;
        this.restTemplate = new RestTemplate();
    }

    public record ImpactDay(
        String date,
        double rain,
        double wind,
        double tempMax,
        double impactScore,
        String recommendation
    ) {}

    @GetMapping("/impact")
    public ResponseEntity<List<ImpactDay>> getImpact(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) Double latitude,
        @RequestParam(required = false) Double longitude
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        Company company = companyRepository.findById(companyId).orElse(null);
        double lat = latitude != null
            ? latitude
            : (company != null && company.getLatitude() != null ? company.getLatitude() : defaultLatitude);
        double lon = longitude != null
            ? longitude
            : (company != null && company.getLongitude() != null ? company.getLongitude() : defaultLongitude);

        return ResponseEntity.ok(getImpactForCoordinates(lat, lon));
    }

    public List<ImpactDay> getImpactForCoordinates(double lat, double lon) {
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
            "&longitude=" + lon +
            "&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&forecast_days=7&timezone=auto";

        @SuppressWarnings("unchecked")
        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> daily = body != null ? (Map<String, Object>) body.get("daily") : Map.of();

        List<String> time = asStringList(daily.get("time"));
        List<Double> rain = asDoubleList(daily.get("precipitation_sum"));
        List<Double> wind = asDoubleList(daily.get("wind_speed_10m_max"));
        List<Double> temp = asDoubleList(daily.get("temperature_2m_max"));

        List<ImpactDay> response = new ArrayList<>();
        for (int i = 0; i < time.size(); i++) {
            double r = i < rain.size() ? rain.get(i) : 0.0;
            double w = i < wind.size() ? wind.get(i) : 0.0;
            double t = i < temp.size() ? temp.get(i) : 0.0;
            double score = calculateScore(r, w, t);
            response.add(new ImpactDay(
                time.get(i),
                r,
                w,
                t,
                score,
                recommendationFor(score)
            ));
        }

        return response;
    }

    private double calculateScore(double rain, double wind, double tempMax) {
        double rainPenalty = rain * 2.2;
        double windPenalty = wind * 0.6;
        double tempPenalty = tempMax >= 31 ? (tempMax - 30) * 1.8 : 0;
        return Math.round((rainPenalty + windPenalty + tempPenalty) * 10.0) / 10.0;
    }

    private String recommendationFor(double score) {
        if (score >= 45) return "Alta afectación: reduce compras perecederas y ajusta turnos de terraza.";
        if (score >= 25) return "Afectación media: prepara stock moderado y cobertura flexible.";
        return "Baja afectación: día favorable para mayor afluencia.";
    }

    private List<String> asStringList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().map(String::valueOf).toList();
    }

    private List<Double> asDoubleList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream()
            .map(v -> {
                if (v instanceof Number n) return n.doubleValue();
                try {
                    return Double.parseDouble(String.valueOf(v));
                } catch (NumberFormatException ignored) {
                    return 0.0;
                }
            })
            .toList();
    }
}
