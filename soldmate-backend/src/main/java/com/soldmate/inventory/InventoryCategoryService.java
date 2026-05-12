package com.soldmate.inventory;

import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class InventoryCategoryService {

    public static final String NONE_NAME = "Ninguna";

    private static final List<String> DEFAULT_NAMES = List.of("Bebidas", "Limpieza", "Otro", NONE_NAME);

    private final InventoryCategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;

    public InventoryCategoryService(
        InventoryCategoryRepository categoryRepository,
        CompanyRepository companyRepository,
        ProductRepository productRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.companyRepository = companyRepository;
        this.productRepository = productRepository;
    }

    @Transactional
    public List<InventoryCategory> listEnsuringDefaults(Long companyId) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        ensureDefaultCategories(companyId, company);
        return categoryRepository.findByCompanyIdOrderBySortOrderAscNameAsc(companyId);
    }

    @Transactional
    public void ensureDefaultCategories(Long companyId, Company company) {
        if (categoryRepository.countByCompanyId(companyId) > 0) {
            return;
        }
        int order = 0;
        for (String name : DEFAULT_NAMES) {
            InventoryCategory c = new InventoryCategory();
            c.setCompany(company);
            c.setName(name);
            c.setSortOrder(order++);
            categoryRepository.save(c);
        }
    }

    @Transactional
    public InventoryCategory create(Long companyId, String rawName) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        ensureDefaultCategories(companyId, company);
        String name = normalizeName(rawName);
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre no puede estar vacío");
        }
        if (categoryRepository.countByCompanyIdAndNameIgnoreCase(companyId, name) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoría con ese nombre");
        }
        InventoryCategory c = new InventoryCategory();
        c.setCompany(company);
        c.setName(name);
        c.setSortOrder(100);
        return categoryRepository.save(c);
    }

    @Transactional
    public InventoryCategory update(Long companyId, Long categoryId, String rawNewName) {
        InventoryCategory c = categoryRepository.findByIdAndCompanyId(categoryId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        if (rawNewName != null && !rawNewName.isBlank()) {
            String newName = normalizeName(rawNewName);
            if (!newName.equalsIgnoreCase(c.getName())
                && categoryRepository.countByCompanyIdAndNameIgnoreCase(companyId, newName) > 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoría con ese nombre");
            }
            if (!newName.equals(c.getName())) {
                String oldName = c.getName();
                c.setName(newName);
                for (Product p : productRepository.findByCompanyIdAndCategory(companyId, oldName)) {
                    p.setCategory(newName);
                }
            }
        }
        return categoryRepository.save(c);
    }

    @Transactional
    public void delete(Long companyId, Long categoryId) {
        InventoryCategory c = categoryRepository.findByIdAndCompanyId(categoryId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        if (NONE_NAME.equalsIgnoreCase(c.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se puede eliminar la categoría «Ninguna»");
        }
        InventoryCategory ninguna = categoryRepository.findByCompanyIdAndNameIgnoreCase(companyId, NONE_NAME)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falta categoría Ninguna"));
        for (Product p : productRepository.findByCompanyIdAndCategory(companyId, c.getName())) {
            p.setCategory(ninguna.getName());
        }
        categoryRepository.delete(c);
    }

    private static String normalizeName(String raw) {
        if (raw == null) return "";
        return raw.trim();
    }
}
