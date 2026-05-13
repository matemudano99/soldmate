package com.soldmate.notifications;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistencia de notificaciones de sistema en una transacción independiente,
 * invocada desde hilos del pool asíncrono.
 */
@Service
public class NotificationWriterService {

    private static final Logger log = LoggerFactory.getLogger(NotificationWriterService.class);

    private final NotificationRepository notificationRepository;
    private final CompanyRepository companyRepository;

    public NotificationWriterService(NotificationRepository notificationRepository,
                                     CompanyRepository companyRepository) {
        this.notificationRepository = notificationRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createForCompany(Long companyId, String type, String title, String body) {
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company == null) {
            log.warn("No se creó notificación: empresa {} inexistente", companyId);
            return;
        }
        notificationRepository.save(new Notification(company, type, title, body));
    }
}
