package com.soldmate.company;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanySettingsServiceTenantTest {

    @Mock
    private CompanySettingRepository settingRepository;

    @Mock
    private CompanyRepository companyRepository;

    @InjectMocks
    private CompanySettingsService service;

    private CompanySetting sampleSetting;

    @BeforeEach
    void setUp() {
        sampleSetting = new CompanySetting();
        sampleSetting.setId(50L);
        sampleSetting.setValue("10.00");
        sampleSetting.setLabel("IVA");
    }

    @Test
    void updateSetting_scopesByCompanyId_andRejectsCrossTenantAccess() {
        Long companyA = 1L;
        Long settingId = 50L;

        when(settingRepository.findByIdAndCompanyId(settingId, companyA))
            .thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(
            RuntimeException.class,
            () -> service.updateSetting(companyA, settingId, "21.00", "IVA general")
        );

        assertEquals("Ajuste no encontrado", ex.getMessage());
        verify(settingRepository).findByIdAndCompanyId(settingId, companyA);
        verify(settingRepository, never()).save(sampleSetting);
    }

    @Test
    void deactivateSetting_scopesByCompanyId_beforeSoftDelete() {
        Long companyA = 1L;
        Long settingId = 50L;

        when(settingRepository.findByIdAndCompanyId(settingId, companyA))
            .thenReturn(Optional.of(sampleSetting));

        service.deactivateSetting(companyA, settingId);

        assertEquals(false, sampleSetting.isActive());
        verify(settingRepository).findByIdAndCompanyId(settingId, companyA);
        verify(settingRepository).save(sampleSetting);
    }
}
