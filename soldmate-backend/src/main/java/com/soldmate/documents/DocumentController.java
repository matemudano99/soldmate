package com.soldmate.documents;

import com.soldmate.auth.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * DocumentController: endpoints del módulo de documentos.
 *
 * GET    /api/v1/documents                      → lista documentos (filtro opcional por categoría)
 * GET    /api/v1/documents/stats                → contador, almacenamiento, nuevos esta semana
 * POST   /api/v1/documents/upload               → sube un fichero a Supabase (multipart)
 * PATCH  /api/v1/documents/{id}                 → renombra / cambia categoría
 * DELETE /api/v1/documents/{id}                 → elimina metadatos (solo OWNER)
 *
 * GET    /api/v1/documents/categories            → lista categorías
 * POST   /api/v1/documents/categories            → crea categoría
 * PATCH  /api/v1/documents/categories/{id}       → actualiza categoría
 * DELETE /api/v1/documents/categories/{id}       → elimina categoría (solo OWNER)
 */
@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final JwtUtil         jwtUtil;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public DocumentController(DocumentService documentService, JwtUtil jwtUtil) {
        this.documentService = documentService;
        this.jwtUtil         = jwtUtil;
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record DocumentResponse(
        Long   id,
        String name,
        String fileUrl,
        String mimeType,
        Long   fileSize,
        String docType,
        String category,
        String createdAt,
        String uploaderName,
        String uploaderEmail,
        String uploaderAvatarUrl
    ) {
        static DocumentResponse from(Document d) {
            String uploaderName  = "Usuario";
            String uploaderEmail = null;
            String uploaderAvatar = null;
            if (d.getUploadedBy() != null) {
                var u = d.getUploadedBy();
                String first = u.getFirstName();
                String last  = u.getLastName();
                String full  = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
                uploaderName  = full.isBlank() ? u.getEmail() : full;
                uploaderEmail = u.getEmail();
                uploaderAvatar = u.getAvatarUrl();
            }
            return new DocumentResponse(
                d.getId(),
                d.getName(),
                d.getFileUrl(),
                d.getMimeType(),
                d.getFileSize(),
                d.getDocType(),
                d.getCategory(),
                d.getCreatedAt().format(DATE_FMT),
                uploaderName,
                uploaderEmail,
                uploaderAvatar
            );
        }
    }

    public record DocumentStatsResponse(
        long   totalDocuments,
        long   totalSizeBytes,
        String totalSizeHuman,
        long   newThisWeek
    ) {
        static DocumentStatsResponse from(DocumentService.DocumentStats s) {
            return new DocumentStatsResponse(
                s.totalDocuments(),
                s.totalSizeBytes(),
                humanSize(s.totalSizeBytes()),
                s.newThisWeek()
            );
        }

        private static String humanSize(long bytes) {
            if (bytes < 1024)                     return bytes + " B";
            if (bytes < 1024 * 1024)              return String.format("%.1f KB", bytes / 1024.0);
            if (bytes < 1024 * 1024 * 1024)       return String.format("%.1f MB", bytes / (1024.0 * 1024));
            return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
        }
    }

    public record CategoryResponse(Long id, String name, String color) {
        static CategoryResponse from(DocumentCategory c) {
            return new CategoryResponse(c.getId(), c.getName(), c.getColor());
        }
    }

    public record UpdateDocumentRequest(String name, String category) {}

    public record CreateCategoryRequest(String name, String color) {}

    public record UpdateCategoryRequest(String name, String color) {}

    // ─── Documentos ──────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<DocumentResponse>> getDocuments(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(required = false) String category
    ) {
        Long companyId = extractCompanyId(authHeader);
        List<Document> docs = category != null && !category.isBlank()
            ? documentService.getByCategory(companyId, category)
            : documentService.getAllByCompany(companyId);

        return ResponseEntity.ok(docs.stream().map(DocumentResponse::from).toList());
    }

    @GetMapping("/stats")
    public ResponseEntity<DocumentStatsResponse> getStats(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        return ResponseEntity.ok(DocumentStatsResponse.from(documentService.getStats(companyId)));
    }

    /**
     * POST /api/v1/documents/upload
     * Sube un fichero a Supabase Storage y persiste sus metadatos.
     * Campos multipart: file (obligatorio), name (opcional), category (opcional).
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam("file")                          MultipartFile file,
        @RequestParam(value = "name",     required = false) String name,
        @RequestParam(value = "category", required = false) String category
    ) {
        Long   companyId      = extractCompanyId(authHeader);
        String uploaderEmail  = extractEmail(authHeader);

        // Límite de 50 MB por documento
        if (file.getSize() > 50L * 1024 * 1024) {
            return ResponseEntity.badRequest().body("El documento no puede superar 50 MB");
        }

        try {
            Document doc = documentService.upload(companyId, uploaderEmail, name, category, file);
            return ResponseEntity.status(HttpStatus.CREATED).body(DocumentResponse.from(doc));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error al subir el documento: " + e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body("Almacenamiento: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateDocument(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody UpdateDocumentRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            Document doc = documentService.update(companyId, id, req.name(), req.category());
            return ResponseEntity.ok(DocumentResponse.from(doc));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<Void> deleteDocument(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            documentService.delete(companyId, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─── Categorías ──────────────────────────────────────────────────────────

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> getCategories(
        @RequestHeader("Authorization") String authHeader
    ) {
        Long companyId = extractCompanyId(authHeader);
        return ResponseEntity.ok(
            documentService.getCategories(companyId).stream().map(CategoryResponse::from).toList()
        );
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<?> createCategory(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody CreateCategoryRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        if (req.name() == null || req.name().isBlank()) {
            return ResponseEntity.badRequest().body("El nombre es obligatorio");
        }
        try {
            DocumentCategory cat = documentService.createCategory(companyId, req.name(), req.color());
            return ResponseEntity.status(HttpStatus.CREATED).body(CategoryResponse.from(cat));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<?> updateCategory(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id,
        @RequestBody UpdateCategoryRequest req
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            DocumentCategory cat = documentService.updateCategory(companyId, id, req.name(), req.color());
            return ResponseEntity.ok(CategoryResponse.from(cat));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'MANAGER')")
    public ResponseEntity<Void> deleteCategory(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        Long companyId = extractCompanyId(authHeader);
        try {
            documentService.deleteCategory(companyId, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Long extractCompanyId(String authHeader) {
        return jwtUtil.extractCompanyId(authHeader.substring(7));
    }

    private String extractEmail(String authHeader) {
        return jwtUtil.extractEmail(authHeader.substring(7));
    }
}
