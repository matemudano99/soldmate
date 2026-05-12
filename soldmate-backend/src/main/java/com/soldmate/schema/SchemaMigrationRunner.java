package com.soldmate.schema;

import com.soldmate.auth.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

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
            new MigrationStep("005", "Add profile and business metadata columns", this::addBusinessMetadataColumns),
            new MigrationStep("006", "Add suppliers type segmentation", this::addSupplierTypeColumn),
            new MigrationStep("007", "Harden tenant indexes for high-traffic queries", this::addTenantIsolationIndexes),
            new MigrationStep("008", "Create notifications table", this::createNotificationsTable),
            new MigrationStep("009", "Create search indexes for global search", this::addSearchIndexes),
            new MigrationStep("010", "Sync users.role constraint with backend enum", this::syncUsersRoleConstraint),
            new MigrationStep("011", "Create inventory_categories for product taxonomy", this::createInventoryCategoriesTable),
            new MigrationStep("012", "Product supplier FK and inventory_categories hardening", this::migrateProductSupplierAndInventoryCategories)
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

    private void addSupplierTypeColumn() {
        jdbcTemplate.execute("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(32) DEFAULT 'SUPPLIER'");
        jdbcTemplate.execute("UPDATE suppliers SET supplier_type='SUPPLIER' WHERE supplier_type IS NULL");
    }

    private void addTenantIsolationIndexes() {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_contacts_company_active ON contacts(company_id, active)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_contacts_company_created_at ON contacts(company_id, created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_company_created_at ON calendar_events(company_id, created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company_id, name)");
    }

    private void createNotificationsTable() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGSERIAL PRIMARY KEY,
                company_id BIGINT NOT NULL REFERENCES companies(id),
                type VARCHAR(32) NOT NULL DEFAULT 'INFO',
                title VARCHAR(255) NOT NULL,
                body TEXT,
                read_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_notifications_company_created ON notifications(company_id, created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_notifications_company_unread ON notifications(company_id, read_at) WHERE read_at IS NULL");
    }

    private void addSearchIndexes() {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(company_id, LOWER(name))");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_title_lower ON incidents(company_id, LOWER(title))");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_name_lower ON suppliers(company_id, LOWER(name))");
    }

    /**
     * Evita desalineaciones backend ↔ DB:
     * - normaliza `users.role`
     * - corrige valores inválidos a EMPLOYEE
     * - recrea `users_role_check` usando los roles reales del enum User.Role
     */
    private void syncUsersRoleConstraint() {
        List<String> allowedRoles = Arrays.stream(User.Role.values())
            .map(Enum::name)
            .toList();
        String inClause = allowedRoles.stream()
            .map(role -> "'" + role + "'")
            .collect(Collectors.joining(", "));

        jdbcTemplate.execute("UPDATE users SET role = UPPER(TRIM(role)) WHERE role IS NOT NULL");
        jdbcTemplate.execute("UPDATE users SET role = 'EMPLOYEE' WHERE role IS NULL OR role = '' OR role NOT IN (" + inClause + ")");
        jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        jdbcTemplate.execute("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (" + inClause + "))");
    }

    private void createInventoryCategoriesTable() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS inventory_categories (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              name VARCHAR(120) NOT NULL,
              sort_order INTEGER NOT NULL DEFAULT 0
            )
            """);
        jdbcTemplate.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_categories_company_name ON inventory_categories(company_id, name)"
        );
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_inventory_categories_company ON inventory_categories(company_id)");
    }

    /**
     * Proveedor por producto (no por categoría). Asegura columnas si la tabla existía sin migración 011.
     */
    private void migrateProductSupplierAndInventoryCategories() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS inventory_categories (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              name VARCHAR(120) NOT NULL,
              sort_order INTEGER NOT NULL DEFAULT 0
            )
            """);
        jdbcTemplate.execute("ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0");
        jdbcTemplate.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_categories_company_name ON inventory_categories(company_id, name)"
        );
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_inventory_categories_company ON inventory_categories(company_id)");
        jdbcTemplate.execute("ALTER TABLE inventory_categories DROP COLUMN IF EXISTS supplier_id");
        jdbcTemplate.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id BIGINT");
        jdbcTemplate.execute("""
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'products_supplier_id_fkey'
              ) THEN
                ALTER TABLE products
                  ADD CONSTRAINT products_supplier_id_fkey
                  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
              END IF;
            END $$
            """);
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

