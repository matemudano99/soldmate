package com.soldmate.incidents;

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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * IncidentService: lógica de negocio del módulo de incidencias.
 *
 * Incluye la subida de fotos a Supabase Storage.
 *
 * ¿Por qué HttpClient de Java 11+ y no RestTemplate?
 * HttpClient es parte de la JDK estándar (sin dependencias extra).
 * Es suficiente para las pocas llamadas que hacemos a Supabase.
 */
@Service
@Transactional
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final UserRepository     userRepository;
    private final CompanyRepository  companyRepository;

    // Inyectamos los valores de Supabase desde application.properties
    @Value("${soldmate.supabase.url}")
    private String supabaseUrl;

    @Value("${soldmate.supabase.anon-key}")
    private String supabaseAnonKey;

    @Value("${soldmate.supabase.bucket}")
    private String supabaseBucket;

    public IncidentService(IncidentRepository incidentRepository,
                           UserRepository userRepository,
                           CompanyRepository companyRepository) {
        this.incidentRepository = incidentRepository;
        this.userRepository     = userRepository;
        this.companyRepository  = companyRepository;
    }

    // ─── Lectura ─────────────────────────────────────────────────────────────

    /** Lista todas las incidencias de la empresa, de más reciente a más antigua. */
    @Transactional(readOnly = true)
    public List<Incident> getAllByCompany(Long companyId) {
        return incidentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    /** Lista incidencias filtradas por estado. */
    @Transactional(readOnly = true)
    public List<Incident> getByStatus(Long companyId, Incident.Status status) {
        return incidentRepository.findByCompanyIdAndStatusOrderByCreatedAtDesc(companyId, status);
    }

    @Transactional(readOnly = true)
    public Optional<Incident> getByCompanyAndId(Long companyId, Long incidentId) {
        return incidentRepository.findByIdAndCompanyId(incidentId, companyId);
    }

    // ─── Creación ────────────────────────────────────────────────────────────

    /**
     * Crea una incidencia sin foto.
     *
     * @param companyId  empresa del usuario (del JWT)
     * @param reportedBy email del usuario que reporta (del JWT)
     * @param title      título breve de la avería
     * @param description detalles adicionales
     * @param priority   nivel de urgencia
     */
    public Incident create(Long companyId, String reportedBy,
                           String title, String description,
                           Incident.Priority priority) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        User user = userRepository.findByEmail(reportedBy)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Incident incident = new Incident();
        incident.setTitle(title);
        incident.setDescription(description);
        incident.setPriority(priority);
        incident.setStatus(Incident.Status.OPEN);
        incident.setCompany(company);
        incident.setReportedBy(user);

        return incidentRepository.save(incident);
    }

    /**
     * Crea una incidencia CON foto.
     *
     * Flujo:
     *   1. Subimos la imagen a Supabase Storage → obtenemos la URL pública
     *   2. Guardamos la incidencia con esa URL en photo_url
     *
     * @param photo archivo de imagen recibido del frontend (MultipartFile)
     */
    public Incident createWithPhoto(Long companyId, String reportedBy,
                                    String title, String description,
                                    Incident.Priority priority,
                                    MultipartFile photo) throws IOException {
        // 1. Subir la foto a Supabase Storage
        String photoUrl = uploadToSupabase(photo, companyId);

        // 2. Crear la incidencia con la URL de la foto
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        User user = userRepository.findByEmail(reportedBy)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Incident incident = new Incident();
        incident.setTitle(title);
        incident.setDescription(description);
        incident.setPriority(priority);
        incident.setStatus(Incident.Status.OPEN);
        incident.setPhotoUrl(photoUrl);
        incident.setCompany(company);
        incident.setReportedBy(user);

        return incidentRepository.save(incident);
    }

    // ─── Actualización de estado ──────────────────────────────────────────────

    /**
     * Cambia el estado de una incidencia (OPEN → IN_PROGRESS → CLOSED).
     * Verifica que la incidencia pertenece a la empresa del usuario.
     */
    public Incident updateStatus(Long companyId, Long incidentId, Incident.Status newStatus) {
        Incident incident = incidentRepository.findByIdAndCompanyId(incidentId, companyId)
            .orElseThrow(() -> new RuntimeException("Incidencia no encontrada"));

        incident.setStatus(newStatus);
        return incidentRepository.save(incident);
    }

    public Incident updateIncident(Long companyId, Long incidentId,
                                   String title, String description,
                                   Incident.Priority priority) {
        Incident incident = incidentRepository.findByIdAndCompanyId(incidentId, companyId)
            .orElseThrow(() -> new RuntimeException("Incidencia no encontrada"));

        incident.setTitle(title);
        incident.setDescription(description);
        incident.setPriority(priority);
        return incidentRepository.save(incident);
    }

    public void deleteIncident(Long companyId, Long incidentId) {
        Incident incident = incidentRepository.findByIdAndCompanyId(incidentId, companyId)
            .orElseThrow(() -> new RuntimeException("Incidencia no encontrada"));
        incidentRepository.delete(incident);
    }

    // ─── Supabase Storage ────────────────────────────────────────────────────

    /**
     * Sube un archivo de imagen a Supabase Storage y devuelve la URL pública.
     *
     * Usamos HttpClient (Java 11+) para hacer la petición REST a Supabase.
     * La API de Supabase Storage sigue el estándar S3.
     *
     * Ruta dentro del bucket (nombre en {@code application.properties}): {@code {companyId}/{uuid}.jpg}
     */
    private String uploadToSupabase(MultipartFile photo, Long companyId)
            throws IOException {

        String baseUrl = normalizeSupabaseProjectUrl(supabaseUrl);
        if (baseUrl.isBlank()) {
            throw new RuntimeException(
                "SOLDMATE_SUPABASE_URL / SUPABASE_URL vacía o inválida. Usa la raíz del proyecto, p. ej. https://xxxx.supabase.co"
            );
        }

        // Nombre único dentro del bucket (sin prefijo duplicado del nombre del bucket)
        String objectPath = String.format("%d/%s.jpg", companyId, UUID.randomUUID());

        // POST {SUPABASE_PROJECT}/storage/v1/object/{bucket}/{path}
        // Si SUPABASE_URL incluye /rest/v1, PostgREST responde PGRST125 ("Invalid path").
        String uploadUrl = String.format(
            "%s/storage/v1/object/%s/%s",
            baseUrl, supabaseBucket, objectPath
        );

        HttpClient client = HttpClient.newHttpClient();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("Authorization", "Bearer " + supabaseAnonKey)
            // Supabase exige `apikey` en casi todas las peticiones al API; sin él suele fallar la subida.
            .header("apikey", supabaseAnonKey)
            .header("Content-Type", photo.getContentType() != null
                ? photo.getContentType() : "image/jpeg")
            // BodyPublishers.ofByteArray convierte el archivo a bytes para enviarlo
            .POST(HttpRequest.BodyPublishers.ofByteArray(photo.getBytes()))
            .build();

        try {
            HttpResponse<String> response = client.send(
                request, HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new RuntimeException(
                    "Error al subir imagen a Supabase: " + response.body()
                );
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Subida interrumpida");
        }

        // Devolvemos la URL pública de la imagen
        return String.format(
            "%s/storage/v1/object/public/%s/%s",
            baseUrl, supabaseBucket, objectPath
        );
    }

    /**
     * La URL del proyecto debe ser la raíz (https://xxx.supabase.co), no /rest/v1 ni /storage/v1.
     */
    private static String normalizeSupabaseProjectUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String u = raw.trim();
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        String[] mistakenSuffixes = {
            "/rest/v1", "/graphql/v1", "/auth/v1", "/storage/v1",
        };
        for (String suffix : mistakenSuffixes) {
            if (u.endsWith(suffix)) {
                u = u.substring(0, u.length() - suffix.length());
                while (u.endsWith("/")) {
                    u = u.substring(0, u.length() - 1);
                }
            }
        }
        return u;
    }
}
