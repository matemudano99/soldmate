package com.soldmate.inventory;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory/categories")
public class InventoryCategoryController {

    private final JwtUtil jwtUtil;
    private final InventoryCategoryService categoryService;

    public InventoryCategoryController(JwtUtil jwtUtil, InventoryCategoryService categoryService) {
        this.jwtUtil = jwtUtil;
        this.categoryService = categoryService;
    }

    public record InventoryCategoryResponse(Long id, String name) {
        static InventoryCategoryResponse from(InventoryCategory c) {
            return new InventoryCategoryResponse(c.getId(), c.getName());
        }
    }

    public record CreateInventoryCategoryRequest(
        @NotBlank @Size(max = 120) String name
    ) {}

    public record UpdateInventoryCategoryRequest(
        @Size(max = 120) String name
    ) {}

    @GetMapping
    public ResponseEntity<List<InventoryCategoryResponse>> list(@RequestHeader("Authorization") String authHeader) {
        Long companyId = extractCompanyId(authHeader);
        List<InventoryCategoryResponse> list = categoryService.listEnsuringDefaults(companyId).stream()
            .map(InventoryCategoryResponse::from)
            .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<InventoryCategoryResponse> create(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody CreateInventoryCategoryRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        InventoryCategory saved = categoryService.create(companyId, req.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(InventoryCategoryResponse.from(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<InventoryCategoryResponse> update(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @Valid @RequestBody UpdateInventoryCategoryRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        InventoryCategory saved = categoryService.update(companyId, id, req.name());
        return ResponseEntity.ok(InventoryCategoryResponse.from(saved));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> delete(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        categoryService.delete(companyId, id);
        return ResponseEntity.noContent().build();
    }

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }
}
