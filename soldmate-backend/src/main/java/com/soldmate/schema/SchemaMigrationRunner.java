package com.soldmate.schema;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Versionador de esquema propio (sin Flyway).
 *
 * Regla:
 * - Cada paso lleva una "version" única.
 * - Si ya está registrada en schema_version, no vuelve a ejecutar.
 * - Las migraciones deben ser idempotentes.
 */
@Component
@Order(10)
public class SchemaMigrationRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrationRunner.class);

    private final SchemaVersionRepository schemaVersionRepository;
    private final JdbcTemplate jdbcTemplate;

    public SchemaMigrationRunner(SchemaVersionRepository schemaVersionRepository,
                                 JdbcTemplate jdbcTemplate) {
        this.schemaVersionRepository = schemaVersionRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<MigrationStep> steps = List.of(
            new MigrationStep("001", "Initialize schema versioning table", this::initialize),
            new MigrationStep("002", "Add performance indexes for core ERP queries", this::addPerformanceIndexes),
            new MigrationStep("003", "Add data integrity constraints for core tables", this::addDataIntegrityConstraints),
            new MigrationStep("004", "Create planning and analytics tables", this::createPlanningTables),
            new MigrationStep("005", "Add profile and business metadata columns", this::addBusinessMetadataColumns)
        );

        for (MigrationStep step : steps) {
            if (schemaVersionRepository.existsByVersion(step.version())) {
                continue;
            }

            log.info("Applying schema step {} - {}", step.version(), step.description());
            try {
                step.action().run();

                SchemaVersion version = new SchemaVersion();
                version.setVersion(step.version());
                version.setDescription(step.description());
                version.setAppliedAt(Instant.now());
                schemaVersionRepository.save(version);
            } catch (Exception e) {
                log.warn("Schema step {} skipped (insufficient privileges or already applied): {}", step.version(), e.getMessage());
            }
        }
    }

    private void initialize() {
        // Paso base para dejar registrada la infraestructura del versionador.
        // Los próximos cambios se añaden como nuevos MigrationStep.
    }

    private void addPerformanceIndexes() {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_products_company_id ON products (company_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_company_active ON suppliers (company_id, active)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_company_category_active ON suppliers (company_id, category, active)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_company_created_at ON incidents (company_id, created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_company_status_created_at ON incidents (company_id, status, created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_company_settings_company_active ON company_settings (company_id, active)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_company_settings_company_group_active ON company_settings (company_id, setting_group, active)");
    }

    private void addDataIntegrityConstraints() {
        // products
        addConstraintIfMissing(
            "products_name_not_blank_chk",
            "ALTER TABLE products ADD CONSTRAINT products_name_not_blank_chk CHECK (length(trim(name)) > 0) NOT VALID"
        );
        addConstraintIfMissing(
            "products_current_stock_non_negative_chk",
            "ALTER TABLE products ADD CONSTRAINT products_current_stock_non_negative_chk CHECK (current_stock >= 0) NOT VALID"
        );
        addConstraintIfMissing(
            "products_min_stock_non_negative_chk",
            "ALTER TABLE products ADD CONSTRAINT products_min_stock_non_negative_chk CHECK (min_stock >= 0) NOT VALID"
        );
        addConstraintIfMissing(
            "products_vat_rate_range_chk",
            "ALTER TABLE products ADD CONSTRAINT products_vat_rate_range_chk CHECK (vat_rate >= 0 AND vat_rate <= 100) NOT VALID"
        );

        // suppliers
        addConstraintIfMissing(
            "suppliers_name_not_blank_chk",
            "ALTER TABLE suppliers ADD CONSTRAINT suppliers_name_not_blank_chk CHECK (length(trim(name)) > 0) NOT VALID"
        );

        // incidents
        addConstraintIfMissing(
            "incidents_title_not_blank_chk",
            "ALTER TABLE incidents ADD CONSTRAINT incidents_title_not_blank_chk CHECK (length(trim(title)) > 0) NOT VALID"
        );

        // company_settings
        addConstraintIfMissing(
            "company_settings_key_not_blank_chk",
            "ALTER TABLE company_settings ADD CONSTRAINT company_settings_key_not_blank_chk CHECK (length(trim(setting_key)) > 0) NOT VALID"
        );
        addConstraintIfMissing(
            "company_settings_value_not_blank_chk",
            "ALTER TABLE company_settings ADD CONSTRAINT company_settings_value_not_blank_chk CHECK (length(trim(value)) > 0) NOT VALID"
        );
        addConstraintIfMissing(
            "company_settings_group_not_blank_chk",
            "ALTER TABLE company_settings ADD CONSTRAINT company_settings_group_not_blank_chk CHECK (length(trim(setting_group)) > 0) NOT VALID"
        );
    }

    private void createPlanningTables() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS calendar_events (
              id BIGSERIAL PRIMARY KEY,
              title VARCHAR(255) NOT NULL,
              notes TEXT,
              event_date DATE NOT NULL,
              event_time TIME,
              source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
              company_id BIGINT NOT NULL REFERENCES companies(id)
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS sale_records (
              id BIGSERIAL PRIMARY KEY,
              sale_date DATE NOT NULL,
              total NUMERIC(12,2) NOT NULL DEFAULT 0,
              channel VARCHAR(50) NOT NULL DEFAULT 'DINING',
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              company_id BIGINT NOT NULL REFERENCES companies(id)
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS shift_plans (
              id BIGSERIAL PRIMARY KEY,
              shift_date DATE NOT NULL,
              shift_name VARCHAR(120) NOT NULL,
              staff_required INT NOT NULL DEFAULT 2,
              notes TEXT,
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              company_id BIGINT NOT NULL REFERENCES companies(id)
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS purchase_suggestions (
              id BIGSERIAL PRIMARY KEY,
              target_date DATE NOT NULL,
              item_name VARCHAR(255) NOT NULL,
              recommendation VARCHAR(255) NOT NULL,
              expected_demand VARCHAR(32) NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              company_id BIGINT NOT NULL REFERENCES companies(id)
            )
            """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_company_date ON calendar_events(company_id, event_date)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_sale_records_company_date ON sale_records(company_id, sale_date)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_shift_plans_company_date ON shift_plans(company_id, shift_date)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_purchase_suggestions_company_date ON purchase_suggestions(company_id, target_date)");
    }

    private void addBusinessMetadataColumns() {
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_phone VARCHAR(120)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_email VARCHAR(255)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_line VARCHAR(255)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(120)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32)");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone VARCHAR(120) DEFAULT 'Europe/Madrid'");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION");
        jdbcTemplate.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS opening_hours_json TEXT");
    }

    private void addConstraintIfMissing(String constraintName, String addConstraintSql) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM pg_constraint WHERE conname = ?",
            Integer.class,
            constraintName
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(addConstraintSql);
    }

    private record MigrationStep(String version, String description, Runnable action) {
    }
}

