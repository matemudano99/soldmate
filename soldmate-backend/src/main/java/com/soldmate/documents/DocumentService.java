package com.soldmate.documents;

import com.soldmate.auth.User;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * DocumentService: lógica de negocio del módulo de documentos.
 *
 * La subida a Supabase Storage reutiliza el mismo patrón que IncidentService.
 * El binario va al bucket "documents" (configurable) bajo la ruta:
 *   {companyId}/{uuid}.{ext}
 */
@Service
@Transactional
public class DocumentService {

    private final DocumentRepository         documentRepository;
    private final DocumentCategoryRepository categoryRepository;
    private final UserRepository             userRepository;
    private final CompanyRepository          companyRepository;
    private final com.soldmate.activity.ActivityLogger activityLogger;

    @Value("${soldmate.supabase.url}")
    private String supabaseUrl;

    @Value("${soldmate.supabase.anon-key}")
    private String supabaseAnonKey;

    /** Bucket compartido para ficheros (incidencias y documentos). */
    @Value("${soldmate.supabase.bucket:incidents}")
    private String documentsBucket;

    public DocumentService(DocumentRepository documentRepository,
                           DocumentCategoryRepository categoryRepository,
                           UserRepository userRepository,
                           CompanyRepository companyRepository,
                           com.soldmate.activity.ActivityLogger activityLogger) {
        this.documentRepository = documentRepository;
        this.categoryRepository  = categoryRepository;
        this.userRepository      = userRepository;
        this.companyRepository   = companyRepository;
        this.activityLogger      = activityLogger;
    }

    // ─── Documentos ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Document> getAllByCompany(Long companyId) {
        return documentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    @Transactional(readOnly = true)
    public List<Document> getByCategory(Long companyId, String category) {
        return documentRepository.findByCompanyIdAndCategoryOrderByCreatedAtDesc(companyId, category);
    }

    @Transactional(readOnly = true)
    public Optional<Document> getByIdAndCompany(Long companyId, Long documentId) {
        return documentRepository.findByIdAndCompanyId(documentId, companyId);
    }

    /**
     * Sube un fichero a Supabase Storage y persiste sus metadatos en Postgres.
     *
     * @param companyId   empresa del usuario (del JWT)
     * @param uploaderEmail email del usuario que sube el fichero (del JWT)
     * @param name        nombre amigable del documento
     * @param category    categoría (puede ser null)
     * @param file        fichero recibido del frontend (multipart)
     */
    public Document upload(Long companyId,
                           String uploaderEmail,
                           String name,
                           String category,
                           MultipartFile file) throws IOException {

        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        User uploader = userRepository.findByEmail(uploaderEmail)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        // 1. Detectar tipo de documento
        String mimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String docType  = detectDocType(mimeType, file.getOriginalFilename());

        // 2. Subir a Supabase Storage
        String fileUrl = uploadToSupabase(file, companyId, docType);

        // 3. Persistir metadatos
        Document doc = new Document();
        doc.setName(name != null && !name.isBlank() ? name.trim()
                    : (file.getOriginalFilename() != null ? file.getOriginalFilename() : "Documento"));
        doc.setFileUrl(fileUrl);
        doc.setMimeType(mimeType);
        doc.setFileSize(file.getSize());
        doc.setDocType(docType);
        doc.setCategory(category != null && !category.isBlank() ? category.trim() : null);
        doc.setUploadedBy(uploader);
        doc.setCompany(company);

        doc = documentRepository.save(doc);
        activityLogger.log(companyId, uploaderEmail, "DOCUMENT", "CREADO", "Subido: " + doc.getName());
        return doc;
    }

    /** Renombra o mueve de categoría un documento existente. */
    public Document update(Long companyId, Long documentId, String name, String category) {
        Document doc = documentRepository.findByIdAndCompanyId(documentId, companyId)
            .orElseThrow(() -> new RuntimeException("Documento no encontrado"));

        if (name != null && !name.isBlank()) doc.setName(name.trim());
        doc.setCategory(category != null && !category.isBlank() ? category.trim() : null);
        doc = documentRepository.save(doc);
        // Opcionalmente podemos usar un user genérico o extraer el usuario actual. En este caso enviaremos null para userEmail.
        activityLogger.log(companyId, null, "DOCUMENT", "MODIFICADO", doc.getName());
        return doc;
    }

    /** Elimina el registro de Postgres (el fichero en Supabase queda huérfano; bórralo desde el dashboard si es necesario). */
    public void delete(Long companyId, Long documentId) {
        Document doc = documentRepository.findByIdAndCompanyId(documentId, companyId)
            .orElseThrow(() -> new RuntimeException("Documento no encontrado"));
        documentRepository.delete(doc);
        activityLogger.log(companyId, null, "DOCUMENT", "ELIMINADO", doc.getName());
    }

    // ─── Estadísticas ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DocumentStats getStats(Long companyId) {
        long total     = documentRepository.countByCompanyId(companyId);
        long totalSize = documentRepository.sumFileSizeByCompanyId(companyId);
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        long newThisWeek = documentRepository.countByCompanyIdAndCreatedAtAfter(companyId, weekAgo);
        return new DocumentStats(total, totalSize, newThisWeek);
    }

    public record DocumentStats(long totalDocuments, long totalSizeBytes, long newThisWeek) {}

    // ─── Categorías ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentCategory> getCategories(Long companyId) {
        return categoryRepository.findByCompanyIdOrderByName(companyId);
    }

    public DocumentCategory createCategory(Long companyId, String name, String color) {
        if (categoryRepository.existsByCompanyIdAndNameIgnoreCase(companyId, name)) {
            throw new RuntimeException("Ya existe una categoría con ese nombre");
        }
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        DocumentCategory cat = new DocumentCategory();
        cat.setName(name.trim());
        cat.setColor(color);
        cat.setCompany(company);
        cat = categoryRepository.save(cat);
        activityLogger.log(companyId, null, "DOCUMENT_CATEGORY", "CREADO", cat.getName());
        return cat;
    }

    public DocumentCategory updateCategory(Long companyId, Long categoryId, String name, String color) {
        DocumentCategory cat = categoryRepository.findByIdAndCompanyId(categoryId, companyId)
            .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));
        if (name != null && !name.isBlank()) cat.setName(name.trim());
        if (color != null) cat.setColor(color);
        cat = categoryRepository.save(cat);
        activityLogger.log(companyId, null, "DOCUMENT_CATEGORY", "MODIFICADO", cat.getName());
        return cat;
    }

    public void deleteCategory(Long companyId, Long categoryId) {
        DocumentCategory cat = categoryRepository.findByIdAndCompanyId(categoryId, companyId)
            .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));
        categoryRepository.delete(cat);
        activityLogger.log(companyId, null, "DOCUMENT_CATEGORY", "ELIMINADO", cat.getName());
    }

    // ─── Supabase Storage ─────────────────────────────────────────────────────

    /**
     * Detecta el tipo normalizado de documento a partir del MIME type.
     * Se usa tanto para el campo `docType` como para elegir la extensión del fichero en Storage.
     */
    static String detectDocType(String mimeType, String originalFilename) {
        if (mimeType == null) mimeType = "";
        String mime = mimeType.toLowerCase();

        if (mime.contains("pdf"))                         return "PDF";
        if (mime.contains("spreadsheet") || mime.contains("excel") || mime.contains("csv")
            || endsWithIgnoreCase(originalFilename, ".xlsx", ".xls", ".csv", ".ods")) return "XLSX";
        if (mime.startsWith("image/"))                   return "IMG";
        if (mime.contains("wordprocessingml") || mime.contains("msword")
            || endsWithIgnoreCase(originalFilename, ".doc", ".docx", ".odt")) return "DOCX";
        if (mime.contains("presentation") || mime.contains("powerpoint")
            || endsWithIgnoreCase(originalFilename, ".ppt", ".pptx", ".odp")) return "PPTX";
        if (mime.contains("zip") || mime.contains("compressed")
            || endsWithIgnoreCase(originalFilename, ".zip", ".rar", ".7z")) return "ZIP";
        if (mime.startsWith("video/"))                   return "VIDEO";
        if (mime.startsWith("audio/"))                   return "AUDIO";
        if (mime.contains("text/"))                      return "TXT";
        return "OTHER";
    }

    private static boolean endsWithIgnoreCase(String filename, String... extensions) {
        if (filename == null) return false;
        String lower = filename.toLowerCase();
        for (String ext : extensions) {
            if (lower.endsWith(ext.toLowerCase())) return true;
        }
        return false;
    }

    /**
     * Sube el fichero a Supabase Storage.
     * Reutiliza el patrón del IncidentService con el bucket de documentos.
     */
    private String uploadToSupabase(MultipartFile file, Long companyId, String docType)
            throws IOException {

        String baseUrl = normalizeSupabaseProjectUrl(supabaseUrl);
        if (baseUrl.isBlank()) {
            throw new RuntimeException(
                "SOLDMATE_SUPABASE_URL vacía o inválida. Usa la raíz del proyecto, p. ej. https://xxxx.supabase.co"
            );
        }

        // Elegimos la extensión correcta según el tipo detectado
        String ext = docTypeToExt(docType);
        String objectPath = String.format("%d/%s%s", companyId, UUID.randomUUID(), ext);
        String uploadUrl  = String.format(
            "%s/storage/v1/object/%s/%s",
            baseUrl, documentsBucket, objectPath
        );

        HttpClient client  = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("Authorization", "Bearer " + supabaseAnonKey)
            .header("apikey", supabaseAnonKey)
            .header("Content-Type", file.getContentType() != null
                    ? file.getContentType() : "application/octet-stream")
            .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
            .build();

        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new RuntimeException("Error al subir documento a Supabase: " + response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Subida interrumpida");
        }

        return String.format(
            "%s/storage/v1/object/public/%s/%s",
            baseUrl, documentsBucket, objectPath
        );
    }

    private static String docTypeToExt(String docType) {
        return switch (docType) {
            case "PDF"   -> ".pdf";
            case "XLSX"  -> ".xlsx";
            case "IMG"   -> ".jpg";
            case "DOCX"  -> ".docx";
            case "PPTX"  -> ".pptx";
            case "ZIP"   -> ".zip";
            case "VIDEO" -> ".mp4";
            case "AUDIO" -> ".mp3";
            case "TXT"   -> ".txt";
            default      -> "";
        };
    }

    private static String normalizeSupabaseProjectUrl(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String u = raw.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        String[] mistakenSuffixes = {"/rest/v1", "/graphql/v1", "/auth/v1", "/storage/v1"};
        for (String suffix : mistakenSuffixes) {
            if (u.endsWith(suffix)) {
                u = u.substring(0, u.length() - suffix.length());
                while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
            }
        }
        return u;
    }
}
