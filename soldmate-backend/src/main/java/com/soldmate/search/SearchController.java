package com.soldmate.search;

import com.soldmate.auth.JwtUtil;
import com.soldmate.incidents.IncidentRepository;
import com.soldmate.inventory.ProductRepository;
import com.soldmate.inventory.SupplierRepository;
import com.soldmate.documents.DocumentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

/**
 * SearchController: búsqueda global cross-entidad.
 *
 * GET /api/v1/search?q=texto
 * Devuelve hasta 20 resultados de productos, incidencias, proveedores y documentos.
 */
@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final JwtUtil jwtUtil;
    private final ProductRepository productRepository;
    private final IncidentRepository incidentRepository;
    private final SupplierRepository supplierRepository;
    private final DocumentRepository documentRepository;

    public SearchController(JwtUtil jwtUtil,
                            ProductRepository productRepository,
                            IncidentRepository incidentRepository,
                            SupplierRepository supplierRepository,
                            DocumentRepository documentRepository) {
        this.jwtUtil = jwtUtil;
        this.productRepository = productRepository;
        this.incidentRepository = incidentRepository;
        this.supplierRepository = supplierRepository;
        this.documentRepository = documentRepository;
    }

    public record SearchResult(String id, String type, String title, String subtitle, String href) {}

    @GetMapping
    public ResponseEntity<List<SearchResult>> search(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam("q") String query
    ) {
        if (query == null || query.isBlank() || query.length() < 2) {
            return ResponseEntity.ok(List.of());
        }

        Long companyId = jwtUtil.extractCompanyId(authHeader.substring(7));
        String q = query.trim().toLowerCase();
        List<SearchResult> results = new ArrayList<>();

        // Products
        productRepository.findByCompanyId(companyId).stream()
            .filter(p -> p.getName() != null && p.getName().toLowerCase().contains(q))
            .limit(5)
            .forEach(p -> results.add(new SearchResult(
                "product-" + p.getId(), "PRODUCT",
                p.getName(),
                "Stock: " + p.getCurrentStock() + " " + p.getUnit(),
                "/inventory"
            )));

        // Incidents
        incidentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId).stream()
            .filter(i -> i.getTitle() != null && i.getTitle().toLowerCase().contains(q))
            .limit(5)
            .forEach(i -> results.add(new SearchResult(
                "incident-" + i.getId(), "INCIDENT",
                i.getTitle(),
                i.getPriority().name() + " · " + i.getStatus().name(),
                "/incidents"
            )));

        // Suppliers
        supplierRepository.findByCompanyId(companyId).stream()
            .filter(s -> s.getName() != null && s.getName().toLowerCase().contains(q))
            .limit(5)
            .forEach(s -> results.add(new SearchResult(
                "supplier-" + s.getId(), "SUPPLIER",
                s.getName(),
                s.getCategory() != null ? s.getCategory() : "Proveedor",
                "/suppliers"
            )));

        // Documents
        documentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId).stream()
            .filter(d -> d.getName() != null && d.getName().toLowerCase().contains(q))
            .limit(5)
            .forEach(d -> results.add(new SearchResult(
                "doc-" + d.getId(), "DOCUMENT",
                d.getName(),
                d.getDocType() + " · " + (d.getCategory() != null ? d.getCategory() : "Sin categoría"),
                "/documents"
            )));

        return ResponseEntity.ok(results.stream().limit(20).toList());
    }
}
