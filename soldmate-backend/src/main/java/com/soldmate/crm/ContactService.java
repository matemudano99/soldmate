package com.soldmate.crm;

import com.soldmate.auth.User;
import com.soldmate.auth.UserCompanyMembership;
import com.soldmate.auth.UserCompanyMembershipRepository;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ContactService {

    private final ContactRepository contactRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final UserCompanyMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;

    public ContactService(ContactRepository contactRepository,
                          CompanyRepository companyRepository,
                          UserRepository userRepository,
                          UserCompanyMembershipRepository membershipRepository,
                          PasswordEncoder passwordEncoder) {
        this.contactRepository = contactRepository;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ─── Lectura ─────────────────────────────────────────────────────────────

    public List<Contact> getAll(Long companyId) {
        return contactRepository.findByCompanyIdOrderByFullNameAsc(companyId);
    }

    public Contact getById(Long companyId, Long id) {
        return contactRepository.findByIdAndCompanyId(id, companyId)
            .orElseThrow(() -> new RuntimeException("Contacto no encontrado: " + id));
    }

    // ─── Creación ─────────────────────────────────────────────────────────────

    public Contact create(Long companyId, ContactRequest req) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada: " + companyId));

        Contact contact = new Contact();
        contact.setCompany(company);
        applyRequest(contact, req);
        maybeCreateUserForContact(company, req);

        return contactRepository.save(contact);
    }

    // ─── Actualización ────────────────────────────────────────────────────────

    public Contact update(Long companyId, Long id, ContactRequest req) {
        Contact contact = getById(companyId, id);
        applyRequest(contact, req);
        return contactRepository.save(contact);
    }

    public Contact toggleActive(Long companyId, Long id) {
        Contact contact = getById(companyId, id);
        contact.setActive(!contact.getActive());
        return contactRepository.save(contact);
    }

    // ─── Eliminación ─────────────────────────────────────────────────────────

    public void delete(Long companyId, Long id) {
        Contact contact = getById(companyId, id);
        contactRepository.delete(contact);
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private void applyRequest(Contact c, ContactRequest req) {
        c.setFullName(req.fullName());
        if (req.email()      != null) c.setEmail(req.email());
        if (req.phone()      != null) c.setPhone(req.phone());
        if (req.avatarUrl()  != null) c.setAvatarUrl(req.avatarUrl());
        if (req.role()       != null) c.setRole(req.role());
        if (req.department() != null) c.setDepartment(req.department());
        if (req.location()   != null) c.setLocation(req.location());
        if (req.progress()   != null) c.setProgress(req.progress());
        if (req.active()     != null) c.setActive(req.active());
        if (req.notes()      != null) c.setNotes(req.notes());
        if (req.joinDate()   != null) c.setJoinDate(req.joinDate());
        if (req.rating()     != null) c.setRating(req.rating());
        if (req.projects()   != null) c.setProjects(req.projects());
    }

    // ─── DTO ─────────────────────────────────────────────────────────────────

    public record ContactRequest(
        String fullName,
        String email,
        String phone,
        String avatarUrl,
        String role,
        String department,
        String location,
        Integer progress,
        Boolean active,
        String notes,
        String joinDate,
        Double rating,
        String projects
    ) {}

    private void maybeCreateUserForContact(Company company, ContactRequest req) {
        if (req.email() == null || req.email().isBlank()) return;

        String email = req.email().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) return;

        String[] nameParts = req.fullName() != null ? req.fullName().trim().split("\\s+", 2) : new String[0];
        String firstName = nameParts.length > 0 ? nameParts[0] : "Empleado";
        String lastName = nameParts.length > 1 ? nameParts[1] : "";

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode("ChangeMe!" + UUID.randomUUID().toString().substring(0, 8)));
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setCompany(company);
        user.setRole(resolveRole(req.role()));
        userRepository.save(user);
        membershipRepository.save(UserCompanyMembership.of(user, company, user.getRole()));
    }

    private User.Role resolveRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) return User.Role.EMPLOYEE;
        String normalized = rawRole.trim().toUpperCase();
        return switch (normalized) {
            case "OWNER" -> User.Role.OWNER;
            case "MANAGER", "ENCARGADO" -> User.Role.MANAGER;
            case "SUPERVISOR" -> User.Role.SUPERVISOR;
            case "VIEWER", "LECTOR" -> User.Role.VIEWER;
            case "EMPLOYEE", "STAFF", "EMPLEADO" -> User.Role.EMPLOYEE;
            default -> User.Role.EMPLOYEE;
        };
    }
}
