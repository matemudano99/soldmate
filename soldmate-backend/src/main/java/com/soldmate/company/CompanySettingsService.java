package com.soldmate.company;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/**
 * CompanySettingsService: lógica de negocio para los ajustes de empresa.
 *
 * Responsabilidades:
 *   1. Crear los ajustes por defecto cuando se registra una empresa nueva
 *   2. Leer, crear y actualizar ajustes existentes
 *
 * @Transactional: si algo falla dentro del método, todos los cambios
 * en la BD se deshacen automáticamente (rollback).
 * Muy importante cuando hacemos varias operaciones seguidas.
 */
@Service
@Transactional
public class CompanySettingsService {

    private final CompanySettingRepository settingRepository;
    private final CompanyRepository        companyRepository;

    public CompanySettingsService(CompanySettingRepository settingRepository,
                                  CompanyRepository companyRepository) {
        this.settingRepository = settingRepository;
        this.companyRepository = companyRepository;
    }

    // ─── Inicialización ──────────────────────────────────────────────────────

    /**
     * Crea los ajustes por defecto para una empresa nueva.
     * Se llama automáticamente desde AuthController.register().
     *
     * Los valores por defecto están pensados para España:
     *   - IVA 10% para alimentación y hostelería
     *   - IVA 21% para bebidas alcohólicas y otros
     */
    public void createDefaultSettings(Company company) {
        String ES = company.getCountry();
        boolean isSpain = "ES".equalsIgnoreCase(ES);

        // ── Tipos de IVA ──
        List<CompanySetting> vatSettings = List.of(
            new CompanySetting(company, "VAT_FOOD",     isSpain ? "10.00" : "0.00",  "IVA alimentación",  "VAT"),
            new CompanySetting(company, "VAT_ALCOHOL",  isSpain ? "21.00" : "0.00",  "IVA bebidas alc.",  "VAT"),
            new CompanySetting(company, "VAT_GENERAL",  isSpain ? "21.00" : "0.00",  "IVA general",       "VAT"),
            new CompanySetting(company, "VAT_REDUCED",  isSpain ? "10.00" : "0.00",  "IVA reducido",      "VAT")
        );

        // ── Categorías de producto ──
        List<CompanySetting> categorySettings = List.of(
            new CompanySetting(company, "CAT_FOOD",       "Alimentación", "Alimentación",    "CATEGORY"),
            new CompanySetting(company, "CAT_DRINKS",     "Bebidas",      "Bebidas",         "CATEGORY"),
            new CompanySetting(company, "CAT_CLEANING",   "Limpieza",     "Limpieza",        "CATEGORY"),
            new CompanySetting(company, "CAT_PACKAGING",  "Envases",      "Envases",         "CATEGORY")
        );

        // ── Estados de pedido ──
        List<CompanySetting> orderStatuses = List.of(
            new CompanySetting(company, "ORDER_RECEIVED",   "Recibido",    "Recibido",    "ORDER_STATUS"),
            new CompanySetting(company, "ORDER_PREPARING",  "En cocina",   "En cocina",   "ORDER_STATUS"),
            new CompanySetting(company, "ORDER_READY",      "Listo",       "Listo",       "ORDER_STATUS"),
            new CompanySetting(company, "ORDER_DELIVERED",  "Entregado",   "Entregado",   "ORDER_STATUS"),
            new CompanySetting(company, "ORDER_CANCELLED",  "Cancelado",   "Cancelado",   "ORDER_STATUS")
        );

        // Añadimos orden de visualización
        setDisplayOrder(vatSettings);
        setDisplayOrder(categorySettings);
        setDisplayOrder(orderStatuses);

        // Guardamos todos los ajustes en la BD de una sola vez
        settingRepository.saveAll(vatSettings);
        settingRepository.saveAll(categorySettings);
        settingRepository.saveAll(orderStatuses);
    }

    // ─── Lectura ─────────────────────────────────────────────────────────────

    /** Devuelve todos los ajustes activos de una empresa. */
    @Transactional(readOnly = true)
    public List<CompanySetting> getAllSettings(Long companyId) {
        return settingRepository.findByCompanyIdAndActiveTrue(companyId);
    }

    /** Devuelve los ajustes de un grupo concreto. */
    @Transactional(readOnly = true)
    public List<CompanySetting> getSettingsByGroup(Long companyId, String group) {
        return settingRepository.findByCompanyIdAndGroupAndActiveTrue(companyId, group.toUpperCase());
    }

    // ─── Creación ────────────────────────────────────────────────────────────

    /** Crea un ajuste personalizado (ej: nueva categoría de producto). */
    public CompanySetting createSetting(Long companyId, String key, String value,
                                        String label, String group) {
        Company company = companyRepository.findById(companyId)
            .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));

        // Comprobamos que no exista ya ese key para esa empresa
        if (settingRepository.findByCompanyIdAndKey(companyId, key).isPresent()) {
            throw new RuntimeException("Ya existe un ajuste con la clave: " + key);
        }

        CompanySetting setting = new CompanySetting(company, key, value, label, group.toUpperCase());
        return settingRepository.save(setting);
    }

    // ─── Actualización ───────────────────────────────────────────────────────

    /**
     * Actualiza el valor de un ajuste existente.
     * Solo puede actualizar ajustes de su propia empresa (companyId del JWT).
     */
    public CompanySetting updateSetting(Long companyId, Long settingId,
                                        String value, String label) {
        CompanySetting setting = settingRepository.findByIdAndCompanyId(settingId, companyId)
            .orElseThrow(() -> new RuntimeException("Ajuste no encontrado"));

        setting.setValue(value);
        if (label != null && !label.isBlank()) {
            setting.setLabel(label);
        }

        return settingRepository.save(setting);
    }

    // ─── Eliminación suave ───────────────────────────────────────────────────

    /** Desactiva un ajuste (no lo borra físicamente de la BD). */
    public void deactivateSetting(Long companyId, Long settingId) {
        CompanySetting setting = settingRepository.findByIdAndCompanyId(settingId, companyId)
            .orElseThrow(() -> new RuntimeException("Ajuste no encontrado"));

        setting.setActive(false);
        settingRepository.save(setting);
    }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private void setDisplayOrder(List<CompanySetting> settings) {
        for (int i = 0; i < settings.size(); i++) {
            settings.get(i).setDisplayOrder(i);
        }
    }
}
