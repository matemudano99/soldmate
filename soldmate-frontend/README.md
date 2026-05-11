# Soldmate — ERP Modular para Hostelería

ERP multi-tenant para restaurantes, bares y cafeterías.  
Stack: Java 21 + Spring Boot 3.4 · Next.js · Supabase

---

## Estructura del proyecto

```
soldmate/
├── soldmate-backend/          # API REST en Java (Spring Boot)
│   └── src/main/java/com/soldmate/
│       ├── auth/              # JWT, SecurityConfig, User
│       ├── company/           # Company, NifCifValidator
│       ├── inventory/         # Product, InventoryController
│       └── incidents/         # Incident
│
└── soldmate-frontend/         # Frontend web (Next.js)
    ├── apps/
    │   └── next/              # Next.js 14 (panel de administración)
    └── packages/
        └── app/               # Código compartido (lógica + componentes)
            ├── screens/       # Pantallas (LoginScreen, DashboardScreen…)
            ├── components/    # Componentes UI reutilizables
            ├── hooks/         # useInventory, useUpdateStock…
            └── lib/           # api.ts (llamadas al backend), store.ts
```

---

## Puesta en marcha

### 1 — Supabase (base de datos)

1. Crea un proyecto en https://supabase.com (plan Free)
2. En **Settings → Database**, copia:
   - Host (termina en `.supabase.co`)
   - Password de la base de datos
3. En **Settings → API**, copia la `anon public key`
4. En **Storage**, crea un bucket llamado `incidents`

### 2 — Backend (Spring Boot)

```bash
cd soldmate-backend

# Edita application.properties con tus datos de Supabase
nano src/main/resources/application.properties

# Arranca el servidor (requiere Java 21 y Maven instalados)
./mvnw spring-boot:run
```

El servidor arranca en `http://localhost:8080`.

**Probar el registro:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Bar El Patio",
    "taxId": "B12345678",
    "country": "ES",
    "email": "admin@elpatio.com",
    "password": "mipassword123",
    "firstName": "Carmen",
    "lastName": "García"
  }'
```

### 3 — Frontend Web (Next.js)

```bash
cd soldmate-frontend

# Instala dependencias de todo el monorepo
yarn install

# Crea el archivo de variables de entorno
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > apps/next/.env.local

# Arranca el servidor de desarrollo
npm run web
# Accede en http://localhost:3000
```

---

## Endpoints de la API

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/register` | Registra empresa + dueño | No |
| POST | `/api/v1/auth/login` | Login, devuelve JWT | No |
| GET | `/api/v1/inventory` | Lista productos de la empresa | JWT |
| POST | `/api/v1/inventory` | Crea producto (solo OWNER) | JWT |
| PATCH | `/api/v1/inventory/{id}/stock` | Actualiza stock | JWT |
| GET | `/api/v1/incidents` | Lista incidencias | JWT |
| POST | `/api/v1/incidents` | Crea incidencia (+foto) | JWT |

---

## Lógica de IVA (España)

En el backend, el campo `vatRate` de `Product` acepta:
- `10.00` → IVA reducido (alimentos, hostelería)
- `21.00` → IVA general (otros productos)

La tabla `CompanySettings` (siguiente sprint) permitirá al dueño
configurar sus propios tipos de IVA por categoría.

---

## Seguridad multi-tenant

Todos los endpoints filtran por `company_id` extraído del JWT:
```java
// El usuario NUNCA puede ver datos de otra empresa
productRepository.findByIdAndCompanyId(id, companyId)
```

Si alguien manipula el `id` en la URL, el servidor devuelve 404
en lugar de exponer datos de otra empresa.

---

## Próximos pasos (post-MVP)

- [ ] Módulo de facturación con cálculo de IVA
- [ ] Tabla `CompanySettings` para IVA y categorías configurables
- [ ] Notificaciones push (stock bajo, incidencias críticas)
- [ ] Analytics de consumo para plan PREMIUM
- [ ] Exportación de inventario a CSV/Excel
