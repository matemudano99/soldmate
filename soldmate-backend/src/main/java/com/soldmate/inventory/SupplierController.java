package com.soldmate.inventory;

import com.soldmate.auth.JwtUtil;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SupplierController: CRUD de proveedores.
 *
 * GET    /api/v1/suppliers              → lista proveedores activos
 * GET    /api/v1/suppliers?category=X  → filtra por categoría
 * GET    /api/v1/suppliers/{id}        → detalle de un proveedor
 * POST   /api/v1/suppliers             → crea proveedor (OWNER)
 * PUT    /api/v1/suppliers/{id}        → actualiza proveedor (OWNER)
 * DELETE /api/v1/suppliers/{id}        → desactiva proveedor (OWNER)
 */
@RestController
@RequestMapping("/api/v1/suppliers")
public class SupplierController {

    private final SupplierRepository supplierRepository;
    private final CompanyRepository  companyRepository;
    private final JwtUtil            jwtUtil;
    private final com.soldmate.activity.ActivityLogger activityLogger;

    public SupplierController(SupplierRepository supplierRepository,
                              CompanyRepository companyRepository,
                              JwtUtil jwtUtil,
                              com.soldmate.activity.ActivityLogger activityLogger) {
        this.supplierRepository = supplierRepository;
        this.companyRepository  = companyRepository;
        this.jwtUtil            = jwtUtil;
        this.activityLogger     = activityLogger;
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record SupplierResponse(
        Long   id,
        String name,
        String contactEmail,
        String contactPhone,
        String contactPerson,
        String category,
        String notes,
        String type
    ) {
        public static SupplierResponse from(Supplier s) {
            return new SupplierResponse(
                s.getId(), s.getName(), s.getContactEmail(),
                s.getContactPhone(), s.getContactPerson(),
                s.getCategory(), s.getNotes(), s.getSupplierType().name()
            );
        }
    }

    public record CreateSupplierRequest(
        @NotBlank String name,
        @Pattern(regexp = "^$|^[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}$", message = "Email inválido")
        String contactEmail,
        String contactPhone,
        String contactPerson,
        String category,
        String notes,
        Supplier.SupplierType type
    ) {}

    // ─── Endpoints ───────────────────────────────────────────────────────────

    /** GET /api/v1/suppliers  o  GET /api/v1/suppliers?category=Cárnicos */
    @GetMapping
    public ResponseEntity<List<SupplierResponse>> getSuppliers(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) Supplier.SupplierType type
    ) {
        Long companyId = extractCompanyId(authHeader);

        List<Supplier> suppliers;
        if (category != null && !category.isBlank() && type != null) {
            suppliers = supplierRepository.findByCompanyIdAndCategoryAndSupplierTypeAndActiveTrue(companyId, category, type);
        } else if (category != null && !category.isBlank()) {
            suppliers = supplierRepository.findByCompanyIdAndCategoryAndActiveTrue(companyId, category);
        } else if (type != null) {
            suppliers = supplierRepository.findByCompanyIdAndSupplierTypeAndActiveTrue(companyId, type);
        } else {
            suppliers = supplierRepository.findByCompanyIdAndActiveTrue(companyId);
        }

        return ResponseEntity.ok(
            suppliers.stream().map(SupplierResponse::from).toList()
        );
    }

    /** GET /api/v1/suppliers/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<SupplierResponse> getSupplier(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        return supplierRepository.findByIdAndCompanyId(id, companyId)
            .filter(Supplier::isActive)
            .map(SupplierResponse::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/v1/suppliers — solo OWNER */
    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<SupplierResponse> createSupplier(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody CreateSupplierRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);

        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        Supplier supplier = new Supplier();
        supplier.setName(req.name().trim());
        supplier.setContactEmail(blankToNull(req.contactEmail()));
        supplier.setContactPhone(blankToNull(req.contactPhone()));
        supplier.setContactPerson(blankToNull(req.contactPerson()));
        supplier.setCategory(blankToNull(req.category()));
        supplier.setNotes(blankToNull(req.notes()));
        supplier.setSupplierType(req.type() != null ? req.type() : Supplier.SupplierType.SUPPLIER);
        supplier.setCompany(company);

        supplierRepository.save(supplier);
        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "SUPPLIER", "CREADO", supplier.getName());

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(SupplierResponse.from(supplier));
    }

    /** PUT /api/v1/suppliers/{id} — actualiza datos del proveedor */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<SupplierResponse> updateSupplier(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @Valid @RequestBody CreateSupplierRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);

        Supplier supplier = supplierRepository.findByIdAndCompanyId(id, companyId)
            .orElse(null);

        if (supplier == null) return ResponseEntity.notFound().build();

        supplier.setName(req.name().trim());
        supplier.setContactEmail(blankToNull(req.contactEmail()));
        supplier.setContactPhone(blankToNull(req.contactPhone()));
        supplier.setContactPerson(blankToNull(req.contactPerson()));
        supplier.setCategory(blankToNull(req.category()));
        supplier.setNotes(blankToNull(req.notes()));
        supplier.setSupplierType(req.type() != null ? req.type() : supplier.getSupplierType());

        supplierRepository.save(supplier);
        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "SUPPLIER", "MODIFICADO", supplier.getName());

        return ResponseEntity.ok(SupplierResponse.from(supplier));
    }

    /** DELETE /api/v1/suppliers/{id} — eliminación suave */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteSupplier(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);

        Supplier supplier = supplierRepository.findByIdAndCompanyId(id, companyId)
            .orElse(null);

        if (supplier == null) return ResponseEntity.notFound().build();

        supplier.setActive(false);
        supplierRepository.save(supplier);
        activityLogger.log(companyId, jwtUtil.extractEmail(authHeader.substring(7)), "SUPPLIER", "ELIMINADO", supplier.getName());

        return ResponseEntity.noContent().build();
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private Long extractCompanyId(String h) {
        return jwtUtil.extractCompanyId(h.substring(7));
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim();
    }
}
