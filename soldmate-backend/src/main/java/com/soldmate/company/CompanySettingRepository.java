package com.soldmate.company;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

/**
 * CompanySettingRepository: acceso a la tabla company_settings.
 *
 * Spring Data JPA genera el SQL automáticamente desde los nombres de método.
 */
public interface CompanySettingRepository extends JpaRepository<CompanySetting, Long> {

    /** Todos los ajustes activos de una empresa. */
    List<CompanySetting> findByCompanyIdAndActiveTrue(Long companyId);

    /** Ajustes activos de una empresa filtrados por grupo. */
    List<CompanySetting> findByCompanyIdAndGroupAndActiveTrue(Long companyId, String group);

    /** Busca un ajuste concreto por empresa y clave. */
    Optional<CompanySetting> findByCompanyIdAndKey(Long companyId, String key);

    /** Busca por ID garantizando pertenencia al tenant. */
    Optional<CompanySetting> findByIdAndCompanyId(Long id, Long companyId);
}
