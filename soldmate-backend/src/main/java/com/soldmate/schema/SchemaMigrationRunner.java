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
            new MigrationStep("012", "Product supplier FK and inventory_categories hardening", this::migrateProductSupplierAndInventoryCategories),
            new MigrationStep("013", "Create daily_finance_entries for manual daily totals", this::createDailyFinanceEntriesTable),
            new MigrationStep("014", "Extend daily_finance_entries and add daily_finance_lines", this::extendDailyFinanceAndCreateLines),
            new MigrationStep("015", "Cash register daily model and fix Europe/Malaga timezone", this::migrateFinanceCashRegisterDailyModel),
            new MigrationStep("016", "Finance dynamic income channels json", this::migrateFinanceIncomeChannelsJson),
            new MigrationStep("017", "Company income channel name templates for daily finance", this::migrateCompanyIncomeChannelTemplates),
            new MigrationStep("018", "RBAC five roles, user profile fields, vacations, document user link", this::rbacFiveRolesUserProfileVacationsDocuments),
            new MigrationStep("019", "DEV platform role and dev console support", this::devPlatformRole),
            new MigrationStep("020", "User presence last_seen_at for online indicators", this::addUserLastSeenAt),
            new MigrationStep("021", "Vacation approval workflow: status and decision fields", this::addVacationApprovalColumns),
            new MigrationStep("022", "TPV POS: catalog, orders, lines and payments", this::createTpvTables),
            new MigrationStep("023", "TPV sala: mesas, modificadores y datos de cliente", this::createTpvSalaTables),
            new MigrationStep("024", "TPV: variantes de artículo (tamaños Simple/Doble)", this::createMenuItemVariants),
            new MigrationStep("025", "TPV clientes: fichero de clientes y vínculo comanda→cliente", this::createTpvCustomers),
            new MigrationStep("026", "TPV: marca de cocina por artículo (ticket de cocina)", this::addMenuItemKitchenFlag),
            new MigrationStep("027", "TPV: disponibilidad de artículo (agotado) y auto-agotar por stock", this::addMenuItemAvailability),
            new MigrationStep("028", "TPV: grupos de combinados aplicables por artículo", this::addMenuItemModifierGroups),
            new MigrationStep("029", "TPV: línea de quita (sin X) en combinados", this::addOrderLineRemoval),
            new MigrationStep("030", "TPV: arqueo de caja (apertura, movimientos y cierre)", this::createTpvCashTables),
            new MigrationStep("031", "TPV: KDS de cocina (estado de comanda y de línea)", this::createTpvKitchenState),
            new MigrationStep("032", "TPV: descuentos por línea y de ticket", this::addTpvDiscounts)
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

    private void createDailyFinanceEntriesTable() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS daily_finance_entries (
                id BIGSERIAL PRIMARY KEY,
                company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                entry_date DATE NOT NULL,
                revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
                expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
                notes VARCHAR(500),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT ux_daily_finance_company_date UNIQUE (company_id, entry_date)
            )
            """);
        jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_daily_finance_company_date ON daily_finance_entries(company_id, entry_date DESC)"
        );
    }

    private void extendDailyFinanceAndCreateLines() {
        jdbcTemplate.execute("""
            ALTER TABLE daily_finance_entries
              ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS card_amount NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS other_amount NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS covers INTEGER,
              ADD COLUMN IF NOT EXISTS ticket_count INTEGER,
              ADD COLUMN IF NOT EXISTS refunds NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS discounts NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS vat_collected NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS vat_paid NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
              ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
              ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255)
            """);
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS daily_finance_lines (
                id BIGSERIAL PRIMARY KEY,
                company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                entry_date DATE NOT NULL,
                kind VARCHAR(16) NOT NULL,
                category VARCHAR(64) NOT NULL,
                amount NUMERIC(14,2) NOT NULL,
                vat_amount NUMERIC(14,2),
                note VARCHAR(200),
                sort_order INT NOT NULL DEFAULT 0,
                CONSTRAINT chk_daily_finance_line_kind CHECK (kind IN ('REVENUE','EXPENSE'))
            )
            """);
        jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_daily_finance_lines_company_date ON daily_finance_lines(company_id, entry_date)"
        );
    }

    /**
     * Cierre de caja diario: nuevos campos, elimina líneas legacy y columnas antiguas.
     * Corrige timezone inválido Europe/Malaga (no existe en IANA → Madrid).
     */
    private void migrateFinanceCashRegisterDailyModel() {
        jdbcTemplate.execute("""
            UPDATE companies SET timezone = 'Europe/Madrid'
            WHERE lower(trim(timezone)) = 'europe/malaga'
            """);
        jdbcTemplate.execute("""
            ALTER TABLE daily_finance_entries
              ADD COLUMN IF NOT EXISTS cash_opening NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_dataphone NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_just_eat NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_glovo NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_uber_eats NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS cash_closing NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS expense_lines_json TEXT
            """);
        jdbcTemplate.execute("""
            ALTER TABLE daily_finance_entries
              ADD COLUMN IF NOT EXISTS cash_opening NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_dataphone NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_just_eat NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_glovo NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS income_uber_eats NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS cash_closing NUMERIC(14,2),
              ADD COLUMN IF NOT EXISTS expense_lines_json TEXT
            """);
        if (Boolean.TRUE.equals(columnExists("daily_finance_entries", "cash_amount"))) {
            jdbcTemplate.execute("""
                UPDATE daily_finance_entries SET
                  cash_opening = COALESCE(cash_opening, cash_amount, 0),
                  income_dataphone = COALESCE(income_dataphone, card_amount, 0),
                  income_just_eat = COALESCE(income_just_eat, 0),
                  income_glovo = COALESCE(income_glovo, 0),
                  income_uber_eats = COALESCE(income_uber_eats, 0),
                  cash_closing = COALESCE(cash_closing, other_amount, 0)
                """);
        } else {
            jdbcTemplate.execute("""
                UPDATE daily_finance_entries SET
                  cash_opening = COALESCE(cash_opening, 0),
                  income_dataphone = COALESCE(income_dataphone, 0),
                  income_just_eat = COALESCE(income_just_eat, 0),
                  income_glovo = COALESCE(income_glovo, 0),
                  income_uber_eats = COALESCE(income_uber_eats, 0),
                  cash_closing = COALESCE(cash_closing, 0)
                """);
        }
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries SET expense_lines_json = '[]'
            WHERE expense_lines_json IS NULL
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries SET expense_lines_json =
              ('[{"detail":"Importación histórica","amount":' || trim(to_char(expenses, 'FM9999999999990.00')) || '}]')
            WHERE (expense_lines_json IS NULL OR expense_lines_json = '' OR expense_lines_json = '[]')
              AND expenses IS NOT NULL AND expenses > 0
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries SET revenue =
              COALESCE(income_dataphone, 0) + COALESCE(income_just_eat, 0)
              + COALESCE(income_glovo, 0) + COALESCE(income_uber_eats, 0)
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries e SET expenses = COALESCE((
              SELECT SUM((elem->>'amount')::numeric)
              FROM jsonb_array_elements(e.expense_lines_json::jsonb) AS elem
            ), 0)
            """);
        jdbcTemplate.execute("DROP TABLE IF EXISTS daily_finance_lines");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS cash_amount");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS card_amount");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS other_amount");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS covers");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS ticket_count");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS refunds");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS discounts");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS vat_collected");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries DROP COLUMN IF EXISTS vat_paid");
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries SET
              cash_opening = COALESCE(cash_opening, 0),
              income_dataphone = COALESCE(income_dataphone, 0),
              income_just_eat = COALESCE(income_just_eat, 0),
              income_glovo = COALESCE(income_glovo, 0),
              income_uber_eats = COALESCE(income_uber_eats, 0),
              cash_closing = COALESCE(cash_closing, 0)
            """);
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN cash_opening SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN cash_opening SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_dataphone SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_dataphone SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_just_eat SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_just_eat SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_glovo SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_glovo SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_uber_eats SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_uber_eats SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN cash_closing SET DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN cash_closing SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN expense_lines_json SET DEFAULT '[]'");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN expense_lines_json SET NOT NULL");
    }

    private void migrateFinanceIncomeChannelsJson() {
        jdbcTemplate.execute("""
            ALTER TABLE daily_finance_entries
              ADD COLUMN IF NOT EXISTS income_channels_json TEXT
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries SET income_channels_json = '[]'
            WHERE income_channels_json IS NULL OR trim(income_channels_json) = ''
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries
            SET income_channels_json = (
              '[' ||
              CASE WHEN COALESCE(income_dataphone,0) > 0
                THEN '{"name":"Datáfono (TPV)","amount":' || trim(to_char(income_dataphone, 'FM9999999999990.00')) || '}'
                ELSE '' END ||
              CASE WHEN COALESCE(income_just_eat,0) > 0
                THEN CASE WHEN COALESCE(income_dataphone,0) > 0 THEN ',' ELSE '' END ||
                     '{"name":"Just Eat","amount":' || trim(to_char(income_just_eat, 'FM9999999999990.00')) || '}'
                ELSE '' END ||
              CASE WHEN COALESCE(income_glovo,0) > 0
                THEN CASE WHEN COALESCE(income_dataphone,0) > 0 OR COALESCE(income_just_eat,0) > 0 THEN ',' ELSE '' END ||
                     '{"name":"Glovo","amount":' || trim(to_char(income_glovo, 'FM9999999999990.00')) || '}'
                ELSE '' END ||
              CASE WHEN COALESCE(income_uber_eats,0) > 0
                THEN CASE WHEN COALESCE(income_dataphone,0) > 0 OR COALESCE(income_just_eat,0) > 0 OR COALESCE(income_glovo,0) > 0 THEN ',' ELSE '' END ||
                     '{"name":"Uber Eats","amount":' || trim(to_char(income_uber_eats, 'FM9999999999990.00')) || '}'
                ELSE '' END ||
              ']'
            )
            WHERE income_channels_json = '[]'
            """);
        jdbcTemplate.execute("""
            UPDATE daily_finance_entries
            SET income_channels_json = '[{"name":"Datáfono (TPV)","amount":0.00}]'
            WHERE income_channels_json = '[]'
            """);
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_channels_json SET DEFAULT '[]'");
        jdbcTemplate.execute("ALTER TABLE daily_finance_entries ALTER COLUMN income_channels_json SET NOT NULL");
    }

    private void migrateCompanyIncomeChannelTemplates() {
        jdbcTemplate.execute("""
            ALTER TABLE companies
              ADD COLUMN IF NOT EXISTS income_channel_templates_json TEXT
            """);
        jdbcTemplate.execute("""
            UPDATE companies SET income_channel_templates_json = '[]'
            WHERE income_channel_templates_json IS NULL OR trim(income_channel_templates_json) = ''
            """);
        jdbcTemplate.execute("ALTER TABLE companies ALTER COLUMN income_channel_templates_json SET DEFAULT '[]'");
        jdbcTemplate.execute("ALTER TABLE companies ALTER COLUMN income_channel_templates_json SET NOT NULL");
    }

    /**
     * Cinco roles (sin STAFF), columnas de perfil en users, vacaciones, vínculo documento→usuario.
     */
    private void rbacFiveRolesUserProfileVacationsDocuments() {
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(32)");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(160)");
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule_note VARCHAR(512)");

        jdbcTemplate.execute("UPDATE users SET role = 'EMPLOYEE' WHERE role = 'STAFF'");
        jdbcTemplate.execute("UPDATE user_company_memberships SET role = 'EMPLOYEE' WHERE role = 'STAFF'");

        jdbcTemplate.execute("""
            UPDATE users SET role = 'EMPLOYEE'
            WHERE role IS NULL OR trim(role) = ''
               OR UPPER(trim(role)) NOT IN ('OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER')
            """);
        jdbcTemplate.execute("""
            UPDATE user_company_memberships SET role = 'EMPLOYEE'
            WHERE role IS NULL OR trim(role) = ''
               OR UPPER(trim(role)) NOT IN ('OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER')
            """);

        String roles = "'OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER'";
        jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        jdbcTemplate.execute("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (" + roles + "))");

        jdbcTemplate.execute("ALTER TABLE user_company_memberships DROP CONSTRAINT IF EXISTS user_company_memberships_role_check");
        jdbcTemplate.execute(
            "ALTER TABLE user_company_memberships ADD CONSTRAINT user_company_memberships_role_check CHECK (role IN (" + roles + "))"
        );

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS vacation_requests (
                id BIGSERIAL PRIMARY KEY,
                company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                notes VARCHAR(500),
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_vacation_requests_company ON vacation_requests(company_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_vacation_requests_user ON vacation_requests(user_id)");

        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS linked_user_id BIGINT");
        jdbcTemplate.execute("""
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'documents_linked_user_id_fkey'
              ) THEN
                ALTER TABLE documents
                  ADD CONSTRAINT documents_linked_user_id_fkey
                  FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
              END IF;
            END $$
            """);
    }

    /**
     * Rol DEV en users (no en membresías). Usuario dev de plataforma para consola multi-tenant.
     */
    private void addUserLastSeenAt() {
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP");
    }

    private void addVacationApprovalColumns() {
        jdbcTemplate.execute("ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PENDING'");
        jdbcTemplate.execute("ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS decided_by VARCHAR(255)");
        jdbcTemplate.execute("ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP");
        jdbcTemplate.execute("ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS decision_note VARCHAR(500)");
        addConstraintIfMissing(
            "vacation_requests_status_chk",
            "ALTER TABLE vacation_requests ADD CONSTRAINT vacation_requests_status_chk CHECK (status IN ('PENDING','APPROVED','REJECTED'))"
        );
    }

    private void createTpvTables() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_menu_categories (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              name VARCHAR(120) NOT NULL,
              sort_order INT NOT NULL DEFAULT 0,
              color VARCHAR(16),
              active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_menu_items (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              category_id BIGINT NOT NULL REFERENCES tpv_menu_categories(id),
              name VARCHAR(160) NOT NULL,
              price NUMERIC(12,2) NOT NULL DEFAULT 0,
              vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
              sells_as_product_id BIGINT,
              active BOOLEAN NOT NULL DEFAULT TRUE,
              sort_order INT NOT NULL DEFAULT 0,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_menu_item_ingredients (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              menu_item_id BIGINT NOT NULL REFERENCES tpv_menu_items(id) ON DELETE CASCADE,
              product_id BIGINT NOT NULL REFERENCES products(id),
              quantity NUMERIC(10,3) NOT NULL DEFAULT 0
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_orders (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
              channel VARCHAR(16) NOT NULL DEFAULT 'DINE_IN',
              business_day DATE NOT NULL,
              opened_by VARCHAR(255),
              opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
              closed_at TIMESTAMP,
              subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
              tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
              total NUMERIC(12,2) NOT NULL DEFAULT 0,
              note VARCHAR(500),
              version BIGINT
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_order_lines (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              order_id BIGINT NOT NULL REFERENCES tpv_orders(id) ON DELETE CASCADE,
              menu_item_id BIGINT,
              name_snapshot VARCHAR(160) NOT NULL,
              qty NUMERIC(10,3) NOT NULL DEFAULT 1,
              unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
              vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
              line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
              note VARCHAR(200),
              voided BOOLEAN NOT NULL DEFAULT FALSE
            )
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_payments (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              order_id BIGINT NOT NULL REFERENCES tpv_orders(id) ON DELETE CASCADE,
              method VARCHAR(20) NOT NULL DEFAULT 'CASH',
              amount NUMERIC(12,2) NOT NULL DEFAULT 0,
              tip NUMERIC(12,2) NOT NULL DEFAULT 0,
              change_given NUMERIC(12,2) NOT NULL DEFAULT 0,
              platform VARCHAR(32),
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              created_by VARCHAR(255)
            )
            """);

        // Índices por tenant / consultas del cierre Z
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_menu_categories_company ON tpv_menu_categories(company_id, sort_order)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_menu_items_company_cat ON tpv_menu_items(company_id, category_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_ingredients_item ON tpv_menu_item_ingredients(company_id, menu_item_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_orders_company_day ON tpv_orders(company_id, business_day)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_order_lines_order ON tpv_order_lines(company_id, order_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_payments_order ON tpv_payments(company_id, order_id)");

        // CHECK de enums (Java los persiste como texto)
        addConstraintIfMissing(
            "tpv_orders_status_chk",
            "ALTER TABLE tpv_orders ADD CONSTRAINT tpv_orders_status_chk CHECK (status IN ('OPEN','IN_PROGRESS','SERVED','BILLED','PAID','CLOSED','VOID'))"
        );
        addConstraintIfMissing(
            "tpv_orders_channel_chk",
            "ALTER TABLE tpv_orders ADD CONSTRAINT tpv_orders_channel_chk CHECK (channel IN ('DINE_IN','TAKEAWAY','DELIVERY'))"
        );
        addConstraintIfMissing(
            "tpv_payments_method_chk",
            "ALTER TABLE tpv_payments ADD CONSTRAINT tpv_payments_method_chk CHECK (method IN ('CASH','CARD','TRANSFER','OTHER','DELIVERY_PLATFORM'))"
        );
    }

    /**
     * Fase 2 del TPV: gestión de sala (mesas con plano editable), modificadores/combinados
     * (líneas hijas de una línea padre) y datos de cliente para pedidos a domicilio/recoger.
     */
    private void createTpvSalaTables() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_tables (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              label VARCHAR(60) NOT NULL,
              zone VARCHAR(60) NOT NULL DEFAULT 'Salón',
              seats INT NOT NULL DEFAULT 4,
              pos_x INT NOT NULL DEFAULT 40,
              pos_y INT NOT NULL DEFAULT 40,
              width INT NOT NULL DEFAULT 90,
              height INT NOT NULL DEFAULT 90,
              shape VARCHAR(12) NOT NULL DEFAULT 'RECT',
              sort_order INT NOT NULL DEFAULT 0,
              active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_tables_company ON tpv_tables(company_id, zone, sort_order)");
        addConstraintIfMissing(
            "tpv_tables_shape_chk",
            "ALTER TABLE tpv_tables ADD CONSTRAINT tpv_tables_shape_chk CHECK (shape IN ('RECT','ROUND'))"
        );

        // Comanda → mesa y datos de cliente (para llevar / domicilio)
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS table_id BIGINT REFERENCES tpv_tables(id) ON DELETE SET NULL");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(160)");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(40)");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS customer_address VARCHAR(300)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_orders_company_table ON tpv_orders(company_id, table_id)");

        // Modificador/combinado: línea hija apuntando a su línea padre
        jdbcTemplate.execute("ALTER TABLE tpv_order_lines ADD COLUMN IF NOT EXISTS parent_line_id BIGINT");

        // Marcas de carta: categorías de modificadores y artículos que admiten combinados
        jdbcTemplate.execute("ALTER TABLE tpv_menu_categories ADD COLUMN IF NOT EXISTS is_modifier_group BOOLEAN NOT NULL DEFAULT FALSE");
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS allows_modifiers BOOLEAN NOT NULL DEFAULT FALSE");
    }

    /**
     * Variantes de tamaño de un artículo (p. ej. una hamburguesa con Simple/Doble como un único producto).
     * Se guardan como JSON en el propio artículo: [{"label":"Simple","price":10.90},{"label":"Doble","price":12.90}].
     */
    private void createMenuItemVariants() {
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS variants_json TEXT");
    }

    /**
     * Fichero de clientes del TPV (para pedidos a domicilio/recoger: autocompletado y datos de
     * facturación) y vínculo opcional comanda→cliente.
     */
    private void createTpvCustomers() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_customers (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              name VARCHAR(160) NOT NULL,
              phone VARCHAR(40),
              email VARCHAR(255),
              address VARCHAR(300),
              city VARCHAR(120),
              postal_code VARCHAR(16),
              tax_id VARCHAR(32),
              notes TEXT,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_customers_company ON tpv_customers(company_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_customers_company_phone ON tpv_customers(company_id, phone)");

        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES tpv_customers(id) ON DELETE SET NULL");
    }

    /**
     * Marca por artículo de si debe imprimirse en el ticket de cocina. Preconfigura como cocina los
     * artículos de categorías que no son modificadores ni bebidas (el resto se ajusta desde la carta).
     */
    private void addMenuItemKitchenFlag() {
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS kitchen BOOLEAN NOT NULL DEFAULT FALSE");
        jdbcTemplate.execute("""
            UPDATE tpv_menu_items i SET kitchen = TRUE
              FROM tpv_menu_categories c
              WHERE i.category_id = c.id
                AND c.is_modifier_group = FALSE
                AND lower(c.name) NOT LIKE 'bebida%'
            """);
    }

    /**
     * Disponibilidad por artículo: {@code available} (agotado manual con un toque) y {@code auto_sold_out}
     * (se considera agotado cuando su stock vinculado llega a 0).
     */
    private void addMenuItemAvailability() {
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE");
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS auto_sold_out BOOLEAN NOT NULL DEFAULT FALSE");
    }

    /**
     * Qué grupos de combinados (categorías de modificadores) aplican a cada artículo, como JSON array
     * de ids de categoría. NULL/vacío = aplican todos los grupos (comportamiento anterior).
     */
    private void addMenuItemModifierGroups() {
        jdbcTemplate.execute("ALTER TABLE tpv_menu_items ADD COLUMN IF NOT EXISTS modifier_groups_json TEXT");
    }

    /** Marca de línea "de quita" (p. ej. "Sin cebolla"): combinado sin precio que solo informa a cocina. */
    private void addOrderLineRemoval() {
        jdbcTemplate.execute("ALTER TABLE tpv_order_lines ADD COLUMN IF NOT EXISTS removal BOOLEAN NOT NULL DEFAULT FALSE");
    }

    /** Arqueo de caja: sesión (apertura con fondo, cierre con conteo y descuadre) y movimientos de efectivo. */
    private void createTpvCashTables() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_cash_sessions (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              business_day DATE NOT NULL,
              status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
              opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
              opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
              opened_by VARCHAR(255),
              counted_cash NUMERIC(12,2),
              expected_cash NUMERIC(12,2),
              difference NUMERIC(12,2),
              closed_at TIMESTAMP,
              closed_by VARCHAR(255),
              note VARCHAR(500)
            )
            """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_cash_sessions_company ON tpv_cash_sessions(company_id, status)");
        addConstraintIfMissing(
            "tpv_cash_sessions_status_chk",
            "ALTER TABLE tpv_cash_sessions ADD CONSTRAINT tpv_cash_sessions_status_chk CHECK (status IN ('OPEN','CLOSED'))"
        );

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS tpv_cash_movements (
              id BIGSERIAL PRIMARY KEY,
              company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              session_id BIGINT NOT NULL REFERENCES tpv_cash_sessions(id) ON DELETE CASCADE,
              type VARCHAR(8) NOT NULL,
              amount NUMERIC(12,2) NOT NULL DEFAULT 0,
              reason VARCHAR(200),
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              created_by VARCHAR(255)
            )
            """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_cash_movements_session ON tpv_cash_movements(company_id, session_id)");
        addConstraintIfMissing(
            "tpv_cash_movements_type_chk",
            "ALTER TABLE tpv_cash_movements ADD CONSTRAINT tpv_cash_movements_type_chk CHECK (type IN ('IN','OUT'))"
        );
    }

    /**
     * KDS de cocina: estado de la comanda en cocina ({@code kitchen_status}) y, por línea, si va a cocina
     * ({@code kitchen}, snapshot para que el tablero no consulte la carta) y si está marcada como hecha.
     */
    private void createTpvKitchenState() {
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(12) NOT NULL DEFAULT 'NONE'");
        jdbcTemplate.execute("ALTER TABLE tpv_order_lines ADD COLUMN IF NOT EXISTS kitchen BOOLEAN NOT NULL DEFAULT FALSE");
        jdbcTemplate.execute("ALTER TABLE tpv_order_lines ADD COLUMN IF NOT EXISTS kitchen_done BOOLEAN NOT NULL DEFAULT FALSE");
        addConstraintIfMissing(
            "tpv_orders_kitchen_status_chk",
            "ALTER TABLE tpv_orders ADD CONSTRAINT tpv_orders_kitchen_status_chk CHECK (kitchen_status IN ('NONE','PENDING','PREPARING','READY','SERVED'))"
        );
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_tpv_orders_kitchen ON tpv_orders(company_id, kitchen_status)");

        // Backfill: marca como de cocina las líneas cuyo artículo es de cocina (padres) y sus combinados (hijas).
        jdbcTemplate.execute("""
            UPDATE tpv_order_lines l SET kitchen = TRUE
              FROM tpv_menu_items i
              WHERE l.menu_item_id = i.id AND i.kitchen = TRUE AND l.parent_line_id IS NULL
            """);
        jdbcTemplate.execute("""
            UPDATE tpv_order_lines c SET kitchen = TRUE
              FROM tpv_order_lines p
              WHERE c.parent_line_id = p.id AND p.kitchen = TRUE
            """);
        // Las comandas abiertas con platos de cocina entran al tablero como pendientes.
        jdbcTemplate.execute("""
            UPDATE tpv_orders o SET kitchen_status = 'PENDING'
              WHERE o.status = 'OPEN'
                AND EXISTS (SELECT 1 FROM tpv_order_lines l WHERE l.order_id = o.id AND l.kitchen = TRUE AND l.voided = FALSE)
            """);
    }

    /** Descuentos: porcentaje por línea (100 = invitar) y descuento de ticket (% o importe) con motivo. */
    private void addTpvDiscounts() {
        jdbcTemplate.execute("ALTER TABLE tpv_order_lines ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) NOT NULL DEFAULT 'NONE'");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0");
        jdbcTemplate.execute("ALTER TABLE tpv_orders ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(200)");
        addConstraintIfMissing(
            "tpv_orders_discount_type_chk",
            "ALTER TABLE tpv_orders ADD CONSTRAINT tpv_orders_discount_type_chk CHECK (discount_type IN ('NONE','PERCENT','AMOUNT'))"
        );
    }

    private void devPlatformRole() {
        String userRoles = "'DEV','OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER'";
        String membershipRoles = "'OWNER','MANAGER','SUPERVISOR','EMPLOYEE','VIEWER'";

        jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        jdbcTemplate.execute("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (" + userRoles + "))");

        jdbcTemplate.execute("ALTER TABLE user_company_memberships DROP CONSTRAINT IF EXISTS user_company_memberships_role_check");
        jdbcTemplate.execute(
            "ALTER TABLE user_company_memberships ADD CONSTRAINT user_company_memberships_role_check CHECK (role IN (" + membershipRoles + "))"
        );
    }

    private boolean columnExists(String table, String column) {
        Integer c = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """,
                Integer.class,
                table,
                column
        );
        return c != null && c > 0;
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

