package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Fichero de clientes del TPV: alta/edición, búsqueda para autocompletar y upsert al tomar pedidos. */
@Service
@Transactional
public class TpvCustomerService {

    public record CustomerInput(String name, String phone, String email, String address, String city,
                                String postalCode, String taxId, String notes) {}

    private final TpvCustomerRepository customerRepository;
    private final CompanyRepository companyRepository;
    private final ActivityLogger activityLogger;

    public TpvCustomerService(TpvCustomerRepository customerRepository,
                              CompanyRepository companyRepository,
                              ActivityLogger activityLogger) {
        this.customerRepository = customerRepository;
        this.companyRepository = companyRepository;
        this.activityLogger = activityLogger;
    }

    @Transactional(readOnly = true)
    public List<TpvCustomer> list(Long companyId) {
        return customerRepository.findByCompany_IdOrderByNameAsc(companyId);
    }

    @Transactional(readOnly = true)
    public TpvCustomer get(Long companyId, Long id) {
        return customerRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cliente no encontrado"));
    }

    /** Búsqueda para autocompletar: por nombre y por teléfono (contiene), unidos sin duplicar. */
    @Transactional(readOnly = true)
    public List<TpvCustomer> search(Long companyId, String q) {
        if (q == null || q.isBlank()) return List.of();
        String term = q.trim();
        List<TpvCustomer> byName = customerRepository
            .findTop10ByCompany_IdAndNameContainingIgnoreCaseOrderByNameAsc(companyId, term);
        List<TpvCustomer> byPhone = customerRepository
            .findTop10ByCompany_IdAndPhoneContainingOrderByNameAsc(companyId, term);
        java.util.LinkedHashMap<Long, TpvCustomer> merged = new java.util.LinkedHashMap<>();
        for (TpvCustomer c : byName) merged.put(c.getId(), c);
        for (TpvCustomer c : byPhone) merged.putIfAbsent(c.getId(), c);
        return merged.values().stream().limit(10).toList();
    }

    public TpvCustomer create(Long companyId, String email, CustomerInput in) {
        if (in == null || in.name() == null || in.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre es obligatorio");
        }
        if (in.phone() == null || in.phone().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El teléfono es obligatorio");
        }
        TpvCustomer c = new TpvCustomer();
        c.setCompany(company(companyId));
        apply(c, in);
        c = customerRepository.save(c);
        activityLogger.log(companyId, email, "TPV_CUSTOMER", "CREADO", c.getName());
        return c;
    }

    public TpvCustomer update(Long companyId, String email, Long id, CustomerInput in) {
        TpvCustomer c = get(companyId, id);
        apply(c, in);
        c = customerRepository.save(c);
        activityLogger.log(companyId, email, "TPV_CUSTOMER", "MODIFICADO", c.getName());
        return c;
    }

    public void delete(Long companyId, String email, Long id) {
        TpvCustomer c = get(companyId, id);
        String name = c.getName();
        customerRepository.delete(c);
        activityLogger.log(companyId, email, "TPV_CUSTOMER", "ELIMINADO", name);
    }

    /**
     * Crea o actualiza un cliente a partir de los datos de un pedido (clave: teléfono). Devuelve su id
     * o null si no hay datos suficientes (sin nombre o sin teléfono no se guarda en el fichero).
     */
    public Long upsertFromOrder(Long companyId, String name, String phone, String address) {
        if (name == null || name.isBlank() || phone == null || phone.isBlank()) {
            return null;
        }
        TpvCustomer c = customerRepository.findFirstByCompany_IdAndPhone(companyId, phone.trim()).orElse(null);
        if (c == null) {
            c = new TpvCustomer();
            c.setCompany(company(companyId));
        }
        c.setName(name.trim());
        c.setPhone(phone.trim());
        if (address != null && !address.isBlank()) c.setAddress(address.trim());
        c = customerRepository.save(c);
        return c.getId();
    }

    private void apply(TpvCustomer c, CustomerInput in) {
        if (in.name() != null && !in.name().isBlank()) c.setName(in.name().trim());
        if (in.phone() != null) c.setPhone(blankToNull(in.phone()));
        if (in.email() != null) c.setEmail(blankToNull(in.email()));
        if (in.address() != null) c.setAddress(blankToNull(in.address()));
        if (in.city() != null) c.setCity(blankToNull(in.city()));
        if (in.postalCode() != null) c.setPostalCode(blankToNull(in.postalCode()));
        if (in.taxId() != null) c.setTaxId(blankToNull(in.taxId()));
        if (in.notes() != null) c.setNotes(blankToNull(in.notes()));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private Company company(Long companyId) {
        return companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
    }
}
