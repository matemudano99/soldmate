package com.soldmate.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * SupabaseStorageService centraliza la subida de ficheros a Supabase Storage.
 *
 * Consolida la lógica duplicada que existía en IncidentService y DocumentService.
 * Cualquier módulo que necesite subir ficheros puede inyectar este bean.
 */
@Service
public class SupabaseStorageService {
    private static final Logger log = LoggerFactory.getLogger(SupabaseStorageService.class);

    @Value("${soldmate.supabase.url}")
    private String supabaseUrl;

    @Value("${soldmate.supabase.anon-key}")
    private String supabaseAnonKey;

    @Value("${soldmate.supabase.service-key:}")
    private String supabaseServiceKey;

    @Value("${soldmate.supabase.bucket:incidents}")
    private String defaultBucket;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Sube un MultipartFile a Supabase Storage usando el bucket por defecto.
     *
     * @param file        fichero a subir
     * @param companyId   se usa como prefijo de carpeta (aislamiento por tenant)
     * @param extension   extensión con punto (p. ej. ".jpg", ".pdf")
     * @return URL pública del objeto subido
     */
    public String upload(MultipartFile file, Long companyId, String extension) throws IOException {
        return upload(file, companyId, extension, defaultBucket);
    }

    /**
     * Sube un MultipartFile a Supabase Storage usando un bucket específico.
     *
     * @param file      fichero a subir
     * @param companyId se usa como prefijo de carpeta
     * @param extension extensión con punto (p. ej. ".jpg")
     * @param bucket    nombre del bucket en Supabase
     * @return URL pública del objeto
     */
    public String upload(MultipartFile file, Long companyId, String extension, String bucket) throws IOException {
        return upload(file, companyId, extension, bucket, null);
    }

    /**
     * Sube un MultipartFile con carpeta lógica opcional (ej. avatars, incidents, documents).
     */
    public String upload(MultipartFile file, Long companyId, String extension, String bucket, String folder) throws IOException {
        String baseUrl = normalize(supabaseUrl);
        if (baseUrl.isBlank()) {
            throw new IllegalStateException(
                "SOLDMATE_SUPABASE_URL está vacía. Configura la URL raíz del proyecto Supabase."
            );
        }
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException(
                "SOLDMATE_SUPABASE_BUCKET está vacío. Define el bucket de Storage."
            );
        }

        String authKey = resolveStorageKey();

        String folderPart = (folder == null || folder.isBlank()) ? "" : (folder.trim().replaceAll("^/+|/+$", "") + "/");
        String objectPath = companyId + "/" + folderPart + UUID.randomUUID() + extension;
        String uploadUrl  = baseUrl + "/storage/v1/object/" + bucket + "/" + objectPath;

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("Authorization", "Bearer " + authKey)
            .header("apikey", authKey)
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
            .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 201) {
                log.error("Supabase upload failed: status={}, bucket={}, objectPath={}, body={}",
                    response.statusCode(), bucket, objectPath, response.body());
                throw new RuntimeException("Supabase Storage error (" + response.statusCode() + "): " + response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Subida de fichero interrumpida", e);
        }

        return baseUrl + "/storage/v1/object/public/" + bucket + "/" + objectPath;
    }

    /**
     * Borra un objeto de Supabase Storage a partir de su URL pública (la que devuelve {@link #upload}).
     *
     * Best-effort: si la URL no es reconocible, no hay clave configurada o la API responde error,
     * se registra un warning pero NO se lanza excepción, para no bloquear el borrado del metadato
     * en la base de datos. Llamar preferiblemente tras el commit (AfterCommitRunner).
     *
     * @param publicUrl URL pública del objeto; si es null/blank no hace nada.
     */
    public void delete(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return;
        }
        String baseUrl = normalize(supabaseUrl);
        if (baseUrl.isBlank()) {
            log.warn("No se puede borrar de Supabase Storage: SOLDMATE_SUPABASE_URL vacía. url={}", publicUrl);
            return;
        }

        final String marker = "/storage/v1/object/public/";
        int idx = publicUrl.indexOf(marker);
        if (idx < 0) {
            log.warn("URL de Storage no reconocida, no se borra el objeto: {}", publicUrl);
            return;
        }
        // bucket/objectPath (sin el segmento "public/")
        String bucketAndPath = publicUrl.substring(idx + marker.length());
        String deleteUrl = baseUrl + "/storage/v1/object/" + bucketAndPath;

        final String authKey;
        try {
            authKey = resolveStorageKey();
        } catch (RuntimeException e) {
            log.warn("No se puede borrar de Supabase Storage (clave no configurada): {}", e.getMessage());
            return;
        }

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(deleteUrl))
            .header("Authorization", "Bearer " + authKey)
            .header("apikey", authKey)
            .DELETE()
            .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 204) {
                log.warn("Supabase delete devolvió status={}, url={}, body={}",
                    response.statusCode(), deleteUrl, response.body());
            }
        } catch (IOException e) {
            log.warn("Error borrando objeto de Supabase Storage: {}", deleteUrl, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Borrado de objeto de Supabase Storage interrumpido: {}", deleteUrl);
        }
    }

    private String resolveStorageKey() {
        String service = supabaseServiceKey != null ? supabaseServiceKey.trim() : "";
        if (!service.isBlank() && !service.equals("placeholder-key")) {
            return service;
        }
        String anon = supabaseAnonKey != null ? supabaseAnonKey.trim() : "";
        if (anon.isBlank() || anon.equals("placeholder-key")) {
            throw new IllegalStateException(
                "No hay clave válida de Supabase. Configura SOLDMATE_SUPABASE_SERVICE_KEY (recomendado) o SOLDMATE_SUPABASE_ANON_KEY."
            );
        }
        return anon;
    }

    /** Elimina la URL base de rutas como /rest/v1, /storage/v1, etc. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String u = raw.trim().replaceAll("/+$", "");
        for (String suffix : new String[]{"/rest/v1", "/graphql/v1", "/auth/v1", "/storage/v1"}) {
            if (u.endsWith(suffix)) {
                u = u.substring(0, u.length() - suffix.length()).replaceAll("/+$", "");
            }
        }
        return u;
    }
}
