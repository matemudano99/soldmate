package com.soldmate.incidents;

import com.soldmate.auth.User;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.storage.SupabaseStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

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
    private final com.soldmate.activity.ActivityLogger activityLogger;
    private final SupabaseStorageService storageService;

    public IncidentService(IncidentRepository incidentRepository,
                           UserRepository userRepository,
                           CompanyRepository companyRepository,
                           com.soldmate.activity.ActivityLogger activityLogger,
                           SupabaseStorageService storageService) {
        this.incidentRepository = incidentRepository;
        this.userRepository     = userRepository;
        this.companyRepository  = companyRepository;
        this.activityLogger     = activityLogger;
        this.storageService     = storageService;
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

        incident = incidentRepository.save(incident);
        activityLogger.log(companyId, reportedBy, "INCIDENT", "CREADO", incident.getTitle());
        return incident;
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
        String photoUrl = storageService.upload(photo, companyId, ".jpg");

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

        incident = incidentRepository.save(incident);
        activityLogger.log(companyId, reportedBy, "INCIDENT", "CREADO", incident.getTitle());
        return incident;
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
        incident = incidentRepository.save(incident);
        activityLogger.log(companyId, null, "INCIDENT", "MODIFICADO", incident.getTitle() + " (" + newStatus.name() + ")");
        return incident;
    }

    public Incident updateIncident(Long companyId, Long incidentId,
                                   String title, String description,
                                   Incident.Priority priority) {
        Incident incident = incidentRepository.findByIdAndCompanyId(incidentId, companyId)
            .orElseThrow(() -> new RuntimeException("Incidencia no encontrada"));

        incident.setTitle(title);
        incident.setDescription(description);
        incident.setPriority(priority);
        incident = incidentRepository.save(incident);
        activityLogger.log(companyId, null, "INCIDENT", "MODIFICADO", incident.getTitle());
        return incident;
    }

    public void deleteIncident(Long companyId, Long incidentId) {
        Incident incident = incidentRepository.findByIdAndCompanyId(incidentId, companyId)
            .orElseThrow(() -> new RuntimeException("Incidencia no encontrada"));
        incidentRepository.delete(incident);
        activityLogger.log(companyId, null, "INCIDENT", "ELIMINADO", incident.getTitle());
    }

}
