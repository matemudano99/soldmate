package com.soldmate.dev;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * Operaciones destructivas multi-tenant para la consola DEV.
 * Borra datos por {@code company_id} en orden seguro (FKs sin CASCADE).
 */
@Service
public class DevPlatformService {

    /** Tablas con company_id que requieren lógica especial (no borrado masivo). */
    private static final Set<String> SKIP_COMPANY_ID_PURGE = Set.of("companies", "users");

    private final JdbcTemplate jdbc;

    public DevPlatformService(JdbcTemplate jdbcTemplate) {
        this.jdbc = jdbcTemplate;
    }

    @Transactional
    public void deleteAllCompanyData(long companyId) {
        jdbc.update("UPDATE documents SET linked_user_id = NULL WHERE company_id = ?", companyId);
        jdbc.update("UPDATE documents SET uploaded_by_id = NULL WHERE company_id = ?", companyId);
        jdbc.update("UPDATE activity_logs SET actor_id = NULL WHERE company_id = ?", companyId);

        deleteAllRowsWithCompanyId(companyId);

        jdbc.update("""
            DELETE FROM users u
            WHERE u.company_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM user_company_memberships m WHERE m.user_id = u.id
              )
            """, companyId);

        jdbc.update("""
            UPDATE users u SET company_id = (
              SELECT m.company_id FROM user_company_memberships m
              WHERE m.user_id = u.id
              ORDER BY m.id ASC LIMIT 1
            )
            WHERE u.company_id = ?
              AND EXISTS (SELECT 1 FROM user_company_memberships m WHERE m.user_id = u.id)
            """, companyId);

        jdbc.update("DELETE FROM companies WHERE id = ?", companyId);
    }

    /**
     * Elimina filas en cualquier tabla pública con columna {@code company_id}
     * (incluye tablas legacy como {@code company_locations} no definidas en migraciones).
     */
    private void deleteAllRowsWithCompanyId(long companyId) {
        List<String> tables = jdbc.queryForList("""
            SELECT DISTINCT table_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name = 'company_id'
            ORDER BY table_name
            """, String.class);

        for (String table : tables) {
            if (SKIP_COMPANY_ID_PURGE.contains(table)) {
                continue;
            }
            deleteFromTableIfExists(table, "company_id = ?", companyId);
        }
    }

    private void deleteFromTableIfExists(String table, String whereSql, Object... args) {
        Boolean exists = jdbc.queryForObject(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = ?
            )
            """,
            Boolean.class,
            table
        );
        if (Boolean.TRUE.equals(exists)) {
            jdbc.update("DELETE FROM " + table + " WHERE " + whereSql, args);
        }
    }

    @Transactional
    public void deleteUserFully(long userId) {
        jdbc.update("UPDATE documents SET linked_user_id = NULL WHERE linked_user_id = ?", userId);
        jdbc.update("UPDATE documents SET uploaded_by_id = NULL WHERE uploaded_by_id = ?", userId);
        jdbc.update("UPDATE activity_logs SET actor_id = NULL WHERE actor_id = ?", userId);
        jdbc.update("DELETE FROM vacation_requests WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM user_company_memberships WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }
}
