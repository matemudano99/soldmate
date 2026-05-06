package com.soldmate.activity;

import com.soldmate.auth.User;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityLogger {

    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;

    public ActivityLogger(ActivityLogRepository activityLogRepository, UserRepository userRepository, CompanyRepository companyRepository) {
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
    }

    /**
     * Registra una acción en el sistema.
     * Se usa REQUIRES_NEW para que el log se guarde independientemente de si la transacción exterior falla,
     * aunque en la mayoría de los casos no es crítico. Dejaremos REQUIRED.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void log(Long companyId, String userEmail, String entityType, String action, String title) {
        if (companyId == null) return;
        
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company == null) return;

        User user = null;
        String actorName = "Sistema";
        String actorEmail = userEmail;

        if (userEmail != null && !userEmail.isBlank()) {
            user = userRepository.findByEmail(userEmail).orElse(null);
            if (user != null) {
                String first = user.getFirstName();
                String last = user.getLastName();
                String full = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
                actorName = full.isBlank() ? user.getEmail() : full;
                actorEmail = user.getEmail();
            }
        }

        ActivityLog log = new ActivityLog(company, user, actorName, actorEmail, entityType, action, title);
        activityLogRepository.save(log);
    }
}
