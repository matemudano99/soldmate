package com.soldmate.company;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/business-profile")
public class BusinessProfileController {

    private final JwtUtil jwtUtil;
    private final CompanyRepository companyRepository;

    public BusinessProfileController(JwtUtil jwtUtil, CompanyRepository companyRepository) {
        this.jwtUtil = jwtUtil;
        this.companyRepository = companyRepository;
    }

    public record BusinessProfileResponse(
        String businessName,
        String phone,
        String email,
        String address,
        String city,
        String postalCode,
        String country,
        String timezone,
        Double latitude,
        Double longitude,
        String openingHours,
        String taxId,
        String currency,
        String subscriptionTier
    ) {
        public static BusinessProfileResponse from(Company c) {
            return new BusinessProfileResponse(
                c.getName(),
                c.getBusinessPhone(),
                c.getBusinessEmail(),
                c.getAddressLine(),
                c.getCity(),
                c.getPostalCode(),
                c.getCountry(),
                c.getTimezone(),
                c.getLatitude(),
                c.getLongitude(),
                c.getOpeningHoursJson(),
                c.getTaxId(),
                c.getCurrency(),
                c.getSubscriptionTier().name()
            );
        }
    }

    public record UpdateBusinessProfileRequest(
        @NotBlank String businessName,
        String phone,
        String email,
        String address,
        String city,
        String postalCode,
        String country,
        String timezone,
        Double latitude,
        Double longitude,
        String openingHours,
        String currency
    ) {}

    @GetMapping
    public ResponseEntity<BusinessProfileResponse> getProfile(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        Company company = companyRepository.findById(companyId).orElseThrow();
        return ResponseEntity.ok(BusinessProfileResponse.from(company));
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<BusinessProfileResponse> updateProfile(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody @Valid UpdateBusinessProfileRequest req
    ) {
        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        Company company = companyRepository.findById(companyId).orElseThrow();

        company.setName(req.businessName().trim());
        company.setBusinessPhone(req.phone());
        company.setBusinessEmail(req.email());
        company.setAddressLine(req.address());
        company.setCity(req.city());
        company.setPostalCode(req.postalCode());
        company.setCountry(req.country() != null && !req.country().isBlank() ? req.country().toUpperCase() : company.getCountry());
        company.setTimezone(req.timezone() != null && !req.timezone().isBlank() ? req.timezone() : "Europe/Madrid");
        company.setLatitude(req.latitude());
        company.setLongitude(req.longitude());
        company.setOpeningHoursJson(req.openingHours());
        if (req.currency() != null && !req.currency().isBlank() && req.currency().length() == 3) {
            company.setCurrency(req.currency().toUpperCase());
        }

        companyRepository.save(company);
        return ResponseEntity.ok(BusinessProfileResponse.from(company));
    }
}
