package com.soldmate.seed;

import com.soldmate.auth.User;
import com.soldmate.auth.UserCompanyMembership;
import com.soldmate.auth.UserCompanyMembershipRepository;
import com.soldmate.auth.UserRepository;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.company.CompanySettingsService;
import com.soldmate.crm.Contact;
import com.soldmate.crm.ContactRepository;
import com.soldmate.incidents.Incident;
import com.soldmate.incidents.IncidentRepository;
import com.soldmate.inventory.Product;
import com.soldmate.inventory.ProductRepository;
import com.soldmate.inventory.Supplier;
import com.soldmate.inventory.SupplierRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Component
public class DemoDataSeeder implements CommandLineRunner {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final UserCompanyMembershipRepository membershipRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final IncidentRepository incidentRepository;
    private final ContactRepository contactRepository;
    private final CompanySettingsService settingsService;
    private final PasswordEncoder passwordEncoder;

    @Value("${soldmate.seed.enabled:true}")
    private boolean seedEnabled;

    public DemoDataSeeder(CompanyRepository companyRepository,
                          UserRepository userRepository,
                          UserCompanyMembershipRepository membershipRepository,
                          SupplierRepository supplierRepository,
                          ProductRepository productRepository,
                          IncidentRepository incidentRepository,
                          ContactRepository contactRepository,
                          CompanySettingsService settingsService,
                          PasswordEncoder passwordEncoder) {
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.incidentRepository = incidentRepository;
        this.contactRepository = contactRepository;
        this.settingsService = settingsService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!seedEnabled) {
            return;
        }

        Company demoCompany = ensureCompany("B00000001", "La Terracita Demo", "ES");
        User owner = ensureUser(demoCompany, "owner.demo@soldmate.local", "Mateo", "Mudano", User.Role.OWNER);
        User staff = ensureUser(demoCompany, "staff.demo@soldmate.local", "Mario", "Lopez", User.Role.EMPLOYEE);

        if (settingsService.getAllSettings(demoCompany.getId()).isEmpty()) {
            settingsService.createDefaultSettings(demoCompany);
        }

        ensureSupplier(demoCompany, "Distribuciones Iberica", "Bebidas");
        ensureSupplier(demoCompany, "Mercado Fresco SL", "Alimentacion");
        ensureSupplier(demoCompany, "Limpieza Hosteleria Plus", "Limpieza");

        ensureProduct(demoCompany, "Tomate triturado lata", "Alimentacion", Product.Unit.UNIT, "10.00", "24.000", "15.000");
        ensureProduct(demoCompany, "Aceite de oliva virgen", "Alimentacion", Product.Unit.L, "10.00", "5.000", "8.000");
        ensureProduct(demoCompany, "Cerveza barril 30L", "Bebidas", Product.Unit.BOX, "21.00", "3.000", "4.000");
        ensureProduct(demoCompany, "Detergente cocina", "Limpieza", Product.Unit.UNIT, "21.00", "12.000", "6.000");
        ensureProduct(demoCompany, "Servilletas 40x40", "Envases", Product.Unit.BOX, "21.00", "2.000", "3.000");

        if (!incidentRepository.existsByCompanyId(demoCompany.getId())) {
            createIncident(demoCompany, owner, "Fuga leve en camara frigorifica", "Revisar junta de puerta", Incident.Priority.HIGH, Incident.Status.OPEN);
            createIncident(demoCompany, staff, "Campana extractora con ruido", "Vibracion al arrancar en velocidad alta", Incident.Priority.MEDIUM, Incident.Status.IN_PROGRESS);
            createIncident(demoCompany, owner, "Mantenimiento preventivo horno", "Revision trimestral completada", Incident.Priority.LOW, Incident.Status.CLOSED);
        }

        if (contactRepository.countByCompanyId(demoCompany.getId()) == 0) {
            seedContacts(demoCompany);
        }
    }

    private void seedContacts(Company company) {
        createContact(company, "Henry Paulista",   "henry.p@mail.com",    "+34 612 001 001", "Senior Creative Director", "Design",    true,  100, "Jan 2020", 4.9, "https://i.pravatar.cc/150?img=11");
        createContact(company, "Evan Jefferson",   "evan.j@mail.com",     "+34 612 001 002", "UI/UX Designer",            "Design",    true,   82, "Jun 2021", 4.7, "https://i.pravatar.cc/150?img=12");
        createContact(company, "Laila Mohammed",   "laila.m@mail.com",    "+34 612 001 003", "Product Manager",           "Product",   true,   91, "Mar 2021", 4.8, "https://i.pravatar.cc/150?img=5");
        createContact(company, "Jack Robertson",   "jack.r@mail.com",     "+34 612 001 004", "Junior Developer",          "Engineering",false, 45, "Sep 2023", 3.9, null);
        createContact(company, "Sofia Reyes",      "sofia.r@mail.com",    "+34 612 001 005", "Marketing Lead",            "Marketing", true,   78, "Feb 2022", 4.5, "https://i.pravatar.cc/150?img=47");
        createContact(company, "Carlos Mendoza",   "carlos.m@mail.com",   "+34 612 001 006", "Backend Engineer",          "Engineering",true,  95, "Nov 2020", 4.6, "https://i.pravatar.cc/150?img=15");
    }

    private void createContact(Company company, String fullName, String email, String phone,
                                String role, String department, boolean active,
                                int progress, String joinDate, double rating, String avatarUrl) {
        Contact c = new Contact();
        c.setCompany(company);
        c.setFullName(fullName);
        c.setEmail(email);
        c.setPhone(phone);
        c.setRole(role);
        c.setDepartment(department);
        c.setActive(active);
        c.setProgress(progress);
        c.setJoinDate(joinDate);
        c.setRating(rating);
        c.setAvatarUrl(avatarUrl);
        c.setLocation("Madrid, ES");
        contactRepository.save(c);
    }

    private Company ensureCompany(String taxId, String name, String country) {
        return companyRepository.findByTaxId(taxId).orElseGet(() -> {
            Company company = new Company();
            company.setTaxId(taxId);
            company.setName(name);
            company.setCountry(country);
            company.setCurrency("EUR");
            company.setSubscriptionTier(Company.SubscriptionTier.PREMIUM);
            return companyRepository.save(company);
        });
    }

    private User ensureUser(Company company, String email, String firstName, String lastName, User.Role role) {
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setCompany(company);
            u.setEmail(email);
            u.setFirstName(firstName);
            u.setLastName(lastName);
            u.setRole(role);
            u.setPassword(passwordEncoder.encode("Demo12345!"));
            return userRepository.save(u);
        });
        if (!membershipRepository.existsByUser_IdAndCompany_Id(user.getId(), company.getId())) {
            membershipRepository.save(UserCompanyMembership.of(user, company, role));
        }
        return user;
    }

    private void ensureSupplier(Company company, String name, String category) {
        supplierRepository.findByCompanyIdAndNameIgnoreCase(company.getId(), name).orElseGet(() -> {
            Supplier supplier = new Supplier();
            supplier.setCompany(company);
            supplier.setName(name);
            supplier.setCategory(category);
            supplier.setContactEmail("compras@" + company.getName().toLowerCase().replace(" ", "") + ".local");
            supplier.setContactPhone("+34900000111");
            supplier.setActive(true);
            return supplierRepository.save(supplier);
        });
    }

    private void ensureProduct(Company company, String name, String category, Product.Unit unit, String vatRate, String currentStock, String minStock) {
        productRepository.findByCompanyIdAndNameIgnoreCase(company.getId(), name).orElseGet(() -> {
            Product product = new Product();
            product.setCompany(company);
            product.setName(name);
            product.setCategory(category);
            product.setUnit(unit);
            product.setVatRate(new BigDecimal(vatRate));
            product.setCurrentStock(new BigDecimal(currentStock));
            product.setMinStock(new BigDecimal(minStock));
            return productRepository.save(product);
        });
    }

    private void createIncident(Company company, User reporter, String title, String description, Incident.Priority priority, Incident.Status status) {
        Incident incident = new Incident();
        incident.setCompany(company);
        incident.setReportedBy(reporter);
        incident.setTitle(title);
        incident.setDescription(description);
        incident.setPriority(priority);
        incident.setStatus(status);
        incidentRepository.save(incident);
    }
}
