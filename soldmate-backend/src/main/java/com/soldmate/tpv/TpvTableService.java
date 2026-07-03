package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Gestión de mesas del plano de sala del TPV. */
@Service
@Transactional
public class TpvTableService {

    /** Datos editables de una mesa (alta/edición desde el plano). */
    public record TableInput(String label, String zone, Integer seats, Integer posX, Integer posY,
                             Integer width, Integer height, String shape, Integer sortOrder, Boolean active) {}

    private final TpvTableRepository tableRepository;
    private final CompanyRepository companyRepository;
    private final ActivityLogger activityLogger;

    public TpvTableService(TpvTableRepository tableRepository,
                           CompanyRepository companyRepository,
                           ActivityLogger activityLogger) {
        this.tableRepository = tableRepository;
        this.companyRepository = companyRepository;
        this.activityLogger = activityLogger;
    }

    @Transactional(readOnly = true)
    public List<TpvTable> list(Long companyId) {
        return tableRepository.findByCompany_IdOrderBySortOrderAscIdAsc(companyId);
    }

    public TpvTable create(Long companyId, String email, TableInput in) {
        if (in == null || in.label() == null || in.label().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de mesa obligatorio");
        }
        TpvTable t = new TpvTable();
        t.setCompany(company(companyId));
        apply(t, in);
        t = tableRepository.save(t);
        activityLogger.log(companyId, email, "TPV_TABLE", "CREADO", t.getLabel());
        return t;
    }

    public TpvTable update(Long companyId, String email, Long id, TableInput in) {
        TpvTable t = tableRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa no encontrada"));
        apply(t, in);
        t = tableRepository.save(t);
        return t;
    }

    public void delete(Long companyId, String email, Long id) {
        TpvTable t = tableRepository.findByIdAndCompany_Id(id, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa no encontrada"));
        String label = t.getLabel();
        tableRepository.delete(t);
        activityLogger.log(companyId, email, "TPV_TABLE", "ELIMINADO", label);
    }

    /** Crea un plano de ejemplo (Salón, Terraza, Barra). Idempotente: no hace nada si ya hay mesas. */
    public List<TpvTable> seedDefaultLayout(Long companyId, String email) {
        if (tableRepository.countByCompany_Id(companyId) > 0) {
            return list(companyId);
        }
        Company company = company(companyId);
        int sort = 0;

        // Salón: 6 mesas en cuadrícula 3×2
        for (int i = 0; i < 6; i++) {
            int col = i % 3, row = i / 3;
            createSeed(company, "Mesa " + (i + 1), "Salón", 4,
                40 + col * 130, 40 + row * 130, 90, 90, TpvTable.Shape.RECT, sort++);
        }
        // Terraza: 4 mesas redondas
        for (int i = 0; i < 4; i++) {
            createSeed(company, "T" + (i + 1), "Terraza", 2,
                40 + (i % 4) * 130, 40, 90, 90, TpvTable.Shape.ROUND, sort++);
        }
        // Barra: 4 taburetes en fila
        for (int i = 0; i < 4; i++) {
            createSeed(company, "B" + (i + 1), "Barra", 1,
                40 + i * 80, 40, 60, 60, TpvTable.Shape.ROUND, sort++);
        }
        activityLogger.log(companyId, email, "TPV_TABLE", "CREADO", "Plano de ejemplo (14 mesas)");
        return list(companyId);
    }

    private void createSeed(Company company, String label, String zone, int seats,
                            int x, int y, int w, int h, TpvTable.Shape shape, int sort) {
        TpvTable t = new TpvTable();
        t.setCompany(company);
        t.setLabel(label);
        t.setZone(zone);
        t.setSeats(seats);
        t.setPosX(x);
        t.setPosY(y);
        t.setWidth(w);
        t.setHeight(h);
        t.setShape(shape);
        t.setSortOrder(sort);
        tableRepository.save(t);
    }

    private void apply(TpvTable t, TableInput in) {
        if (in.label() != null && !in.label().isBlank()) t.setLabel(in.label().trim());
        if (in.zone() != null && !in.zone().isBlank()) t.setZone(in.zone().trim());
        if (in.seats() != null) t.setSeats(Math.max(0, in.seats()));
        if (in.posX() != null) t.setPosX(in.posX());
        if (in.posY() != null) t.setPosY(in.posY());
        if (in.width() != null) t.setWidth(Math.max(40, in.width()));
        if (in.height() != null) t.setHeight(Math.max(40, in.height()));
        if (in.shape() != null && !in.shape().isBlank()) {
            try {
                t.setShape(TpvTable.Shape.valueOf(in.shape().trim().toUpperCase()));
            } catch (IllegalArgumentException ignored) {
                // forma desconocida: se deja la actual
            }
        }
        if (in.sortOrder() != null) t.setSortOrder(in.sortOrder());
        if (in.active() != null) t.setActive(in.active());
    }

    private Company company(Long companyId) {
        return companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
    }
}
