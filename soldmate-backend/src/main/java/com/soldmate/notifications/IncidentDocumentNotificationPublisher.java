package com.soldmate.notifications;

import com.soldmate.config.AsyncConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Publica notificaciones persistidas sin bloquear el hilo de la petición HTTP.
 * Demuestra uso de {@link Async} y un {@link java.util.concurrent.Executor} dedicado.
 */
@Component
public class IncidentDocumentNotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(IncidentDocumentNotificationPublisher.class);

    private final NotificationWriterService notificationWriterService;

    public IncidentDocumentNotificationPublisher(NotificationWriterService notificationWriterService) {
        this.notificationWriterService = notificationWriterService;
    }

    @Async(AsyncConfiguration.SOLDMATE_ASYNC_EXECUTOR)
    public void publishIncidentCreated(Long companyId, String title, boolean withPhoto) {
        try {
            String body = withPhoto
                ? "Nueva incidencia con imagen adjunta."
                : "Nueva incidencia registrada en el sistema.";
            notificationWriterService.createForCompany(companyId, "INFO", "Incidencia: " + title, body);
        } catch (Exception e) {
            log.error("Fallo al crear notificación asíncrona de incidencia (empresa {})", companyId, e);
        }
    }

    @Async(AsyncConfiguration.SOLDMATE_ASYNC_EXECUTOR)
    public void publishDocumentUploaded(Long companyId, String documentName, String docType) {
        try {
            String body = "Tipo: " + (docType != null ? docType : "—") + ". Disponible en el módulo de documentos.";
            notificationWriterService.createForCompany(
                companyId,
                "INFO",
                "Documento subido: " + documentName,
                body
            );
        } catch (Exception e) {
            log.error("Fallo al crear notificación asíncrona de documento (empresa {})", companyId, e);
        }
    }
}
