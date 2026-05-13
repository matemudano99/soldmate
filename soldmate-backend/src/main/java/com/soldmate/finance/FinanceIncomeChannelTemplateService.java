package com.soldmate.finance;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class FinanceIncomeChannelTemplateService {

    public static final int MAX_TEMPLATES = 30;
    public static final int MAX_NAME_LEN = 80;

    private final CompanyRepository companyRepository;
    private final ObjectMapper objectMapper;

    public FinanceIncomeChannelTemplateService(CompanyRepository companyRepository, ObjectMapper objectMapper) {
        this.companyRepository = companyRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<String> listNames(Long companyId) {
        Company c = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        return parseNames(c.getIncomeChannelTemplatesJson());
    }

    @Transactional
    public void replaceNames(Long companyId, List<String> names) {
        Company c = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        LinkedHashMap<String, String> deduped = dedupePreserveOrder(names);
        if (deduped.size() > MAX_TEMPLATES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo " + MAX_TEMPLATES + " canales en plantilla");
        }
        writeJson(c, new ArrayList<>(deduped.values()));
        companyRepository.save(c);
    }

    /**
     * Añade nombres nuevos al final, sin quitar los existentes (comparación sin distinguir mayúsculas).
     */
    @Transactional
    public void mergeNames(Long companyId, List<String> namesFromClosure) {
        Company c = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        LinkedHashMap<String, String> merged = dedupePreserveOrder(parseNames(c.getIncomeChannelTemplatesJson()));
        for (String n : namesFromClosure) {
            String t = truncate(trim(n));
            if (t.isEmpty()) {
                continue;
            }
            String key = normalizeKey(t);
            merged.putIfAbsent(key, t);
        }
        List<String> values = new ArrayList<>(merged.values());
        if (values.size() > MAX_TEMPLATES) {
            values = new ArrayList<>(values.subList(0, MAX_TEMPLATES));
        }
        writeJson(c, values);
        companyRepository.save(c);
    }

    private List<String> parseNames(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(json, new TypeReference<>() {});
            if (list == null) {
                return List.of();
            }
            List<String> out = new ArrayList<>();
            for (String s : list) {
                String t = truncate(trim(s));
                if (!t.isEmpty()) {
                    out.add(t);
                }
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private void writeJson(Company c, List<String> names) {
        try {
            c.setIncomeChannelTemplatesJson(objectMapper.writeValueAsString(names));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar plantilla de canales");
        }
    }

    private static LinkedHashMap<String, String> dedupePreserveOrder(List<String> names) {
        LinkedHashMap<String, String> map = new LinkedHashMap<>();
        if (names == null) {
            return map;
        }
        for (String raw : names) {
            String t = truncate(trim(raw));
            if (t.isEmpty()) {
                continue;
            }
            String key = normalizeKey(t);
            map.putIfAbsent(key, t);
        }
        return map;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String truncate(String s) {
        if (s.length() <= MAX_NAME_LEN) {
            return s;
        }
        return s.substring(0, MAX_NAME_LEN);
    }

    private static String normalizeKey(String s) {
        return s.toLowerCase(Locale.ROOT);
    }
}
