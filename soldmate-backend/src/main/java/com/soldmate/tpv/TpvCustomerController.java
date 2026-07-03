package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Fichero de clientes del TPV. Lectura para autenticados; editar requiere SUPERVISOR+. */
@RestController
@RequestMapping("/api/v1/tpv/customers")
public class TpvCustomerController {

    private final TpvCustomerService customerService;
    private final TpvSalesService salesService;
    private final JwtUtil jwtUtil;

    public TpvCustomerController(TpvCustomerService customerService, TpvSalesService salesService, JwtUtil jwtUtil) {
        this.customerService = customerService;
        this.salesService = salesService;
        this.jwtUtil = jwtUtil;
    }

    public record CustomerResponse(Long id, String name, String phone, String email, String address,
                                   String city, String postalCode, String taxId, String notes) {
        static CustomerResponse from(TpvCustomer c) {
            return new CustomerResponse(c.getId(), c.getName(), c.getPhone(), c.getEmail(), c.getAddress(),
                c.getCity(), c.getPostalCode(), c.getTaxId(), c.getNotes());
        }
    }

    public record CustomerRequest(@NotBlank String name, @NotBlank String phone, String email, String address,
                                  String city, String postalCode, String taxId, String notes) {
        TpvCustomerService.CustomerInput toInput() {
            return new TpvCustomerService.CustomerInput(name, phone, email, address, city, postalCode, taxId, notes);
        }
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<CustomerResponse> list(@RequestHeader("Authorization") String auth) {
        return customerService.list(companyId(auth)).stream().map(CustomerResponse::from).toList();
    }

    @GetMapping("/search")
    @PreAuthorize("isAuthenticated()")
    public List<CustomerResponse> search(@RequestHeader("Authorization") String auth, @RequestParam("q") String q) {
        return customerService.search(companyId(auth), q).stream().map(CustomerResponse::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public CustomerResponse get(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        return CustomerResponse.from(customerService.get(companyId(auth), id));
    }

    @GetMapping("/{id}/orders")
    @PreAuthorize("isAuthenticated()")
    public List<TpvSalesService.SaleSummary> orders(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        customerService.get(companyId(auth), id); // valida pertenencia
        return salesService.listSalesByCustomer(companyId(auth), id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<CustomerResponse> create(@RequestHeader("Authorization") String auth,
                                                   @RequestBody CustomerRequest req) {
        TpvCustomer c = customerService.create(companyId(auth), email(auth), req.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(CustomerResponse.from(c));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public CustomerResponse update(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                   @RequestBody CustomerRequest req) {
        return CustomerResponse.from(customerService.update(companyId(auth), email(auth), id, req.toInput()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<Void> delete(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        customerService.delete(companyId(auth), email(auth), id);
        return ResponseEntity.noContent().build();
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
