package com.soldmate.inventory;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
public class ProductController {

    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;
    private final JwtUtil jwtUtil;
    private final com.soldmate.activity.ActivityLogger activityLogger;

    public ProductController(ProductRepository productRepository,
                             CompanyRepository companyRepository,
                             JwtUtil jwtUtil,
                             com.soldmate.activity.ActivityLogger activityLogger) {
        this.productRepository = productRepository;
        this.companyRepository = companyRepository;
        this.jwtUtil = jwtUtil;
        this.activityLogger = activityLogger;
    }

    public record ProductResponse(
        Long id,
        String name,
        BigDecimal currentStock,
        BigDecimal minStock,
        String unit,
        String category,
        BigDecimal vatRate,
        boolean lowStock
    ) {
        public static ProductResponse from(Product p) {
            return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getCurrentStock(),
                p.getMinStock(),
                p.getUnit().name(),
                p.getCategory(),
                p.getVatRate(),
                p.isLowStock()
            );
        }
    }

    public record CreateProductRequest(
        @NotBlank String name,
        @NotNull BigDecimal currentStock,
        @NotNull BigDecimal minStock,
        @NotNull Product.Unit unit,
        String category,
        BigDecimal vatRate
    ) {}

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getProducts(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<ProductResponse> response = productRepository.findByCompanyId(companyId)
            .stream()
            .map(ProductResponse::from)
            .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ProductResponse> createProduct(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody CreateProductRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        Product product = new Product();
        product.setName(req.name().trim());
        product.setCurrentStock(req.currentStock());
        product.setMinStock(req.minStock());
        product.setUnit(req.unit());
        product.setCategory(req.category());
        product.setVatRate(req.vatRate() != null ? req.vatRate() : new BigDecimal("10.00"));
        product.setCompany(company);

        Product saved = productRepository.save(product);
        String userEmail = jwtUtil.extractEmail(authHeader.substring(7));
        activityLogger.log(companyId, userEmail, "PRODUCT", "CREADO", saved.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductResponse.from(saved));
    }

    @PatchMapping("/{id}/stock")
    public ResponseEntity<ProductResponse> updateStock(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestParam BigDecimal quantity
    ) {
        Long companyId = extractCompanyId(authHeader);
        Product product = productRepository.findByIdAndCompanyId(id, companyId).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        product.setCurrentStock(product.getCurrentStock().add(quantity));
        return ResponseEntity.ok(ProductResponse.from(productRepository.save(product)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ProductResponse> updateProduct(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @Valid @RequestBody CreateProductRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        Product product = productRepository.findByIdAndCompanyId(id, companyId).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        product.setName(req.name().trim());
        product.setCurrentStock(req.currentStock());
        product.setMinStock(req.minStock());
        product.setUnit(req.unit());
        product.setCategory(req.category());
        product.setVatRate(req.vatRate() != null ? req.vatRate() : product.getVatRate());

        Product updated = productRepository.save(product);
        String userEmail = jwtUtil.extractEmail(authHeader.substring(7));
        activityLogger.log(companyId, userEmail, "PRODUCT", "MODIFICADO", updated.getName());
        return ResponseEntity.ok(ProductResponse.from(updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteProduct(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        Product product = productRepository.findByIdAndCompanyId(id, companyId).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        String name = product.getName();
        productRepository.delete(product);
        String userEmail = jwtUtil.extractEmail(authHeader.substring(7));
        activityLogger.log(companyId, userEmail, "PRODUCT", "ELIMINADO", name);
        return ResponseEntity.noContent().build();
    }

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }
}
