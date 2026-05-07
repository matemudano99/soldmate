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

/**
 * SupabaseStorageService centraliza la subida de ficheros a Supabase Storage.
 *
 * Consolida la lógica duplicada que existía en IncidentService y DocumentService.
 * Cualquier módulo que necesite subir ficheros puede inyectar este bean.
 */
@Service
public class SupabaseStorageService {

    @Value("${soldmate.supabase.url}")
    private String supabaseUrl;

    @Value("${soldmate.supabase.anon-key}")
    private String supabaseAnonKey;

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
        String baseUrl = normalize(supabaseUrl);
        if (baseUrl.isBlank()) {
            throw new IllegalStateException(
                "SOLDMATE_SUPABASE_URL está vacía. Configura la URL raíz del proyecto Supabase."
            );
        }

        String objectPath = companyId + "/" + UUID.randomUUID() + extension;
        String uploadUrl  = baseUrl + "/storage/v1/object/" + bucket + "/" + objectPath;

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("Authorization", "Bearer " + supabaseAnonKey)
            .header("apikey", supabaseAnonKey)
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
            .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new RuntimeException("Supabase Storage error (" + response.statusCode() + "): " + response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Subida de fichero interrumpida", e);
        }

        return baseUrl + "/storage/v1/object/public/" + bucket + "/" + objectPath;
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
