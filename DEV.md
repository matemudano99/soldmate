# 💻 Soldmate - Documentación Técnica (DEV.md)

Este documento es una guía profunda de arquitectura y convenciones de código para desarrolladores o IA que trabajen en el proyecto **Soldmate**. Está redactado basándose estrictamente en el código actual del repositorio.

---

## 🏗️ Arquitectura General

El sistema consta de un **backend monolítico en Spring Boot** y un **frontend desacoplado en Next.js (App Router)**. La infraestructura se apoya en Supabase, que actúa únicamente como base de datos relacional PostgreSQL remota y repositorio de almacenamiento de archivos (S3).

### 🏢 Aislamiento Multi-Tenant (Seguridad Crítica)
Soldmate es una plataforma B2B Software-as-a-Service (SaaS). El diseño de la base de datos y la seguridad giran en torno al concepto de **Multi-Tenancy** puro basado en columnas lógicas (Shared Schema):

1. **La Entidad `Company`**: Toda la información generada en el ERP le pertenece a un restaurante o empresa (`Company`).
2. **Claves foráneas estrictas**: Absolutamente todas las entidades persistentes (`User`, `Product`, `Supplier`, `Incident`, `Document`, `CalendarEvent`, `ActivityLog`) tienen una relación `@ManyToOne` obligatoria hacia `Company`.
3. **Aislamiento en Consultas**: 
   - El ID de la empresa del usuario NO se envía desde el cliente (para evitar manipulaciones). 
   - Cuando un usuario hace login, el JWT generado incluye de forma segura y encriptada su `companyId`.
   - Todos los controladores en Spring extraen este ID directamente del token usando `jwtUtil.extractCompanyId(token)`.
   - Todas las llamadas al repositorio incluyen la validación de pertenencia. Ej: `findByCompanyIdAndId(companyId, id)`. De este modo, es matemáticamente imposible que un usuario vea o altere datos de otro restaurante.

---

## 🔐 Autenticación y Autorización

- **Stateless Authentication**: No hay sesiones en memoria. El servidor firma un JWT con `soldmate.jwt.secret` que dura 24h.
- **Flujo de Petición**: El frontend manda el JWT por la cabecera `Authorization: Bearer <token>`. El backend (mediante `JwtFilter`) lo valida y establece el `SecurityContext`.
- **RBAC (Role-Based Access Control)**:
  - Existen roles estrictos definidos en la entidad `User`: `OWNER`, `MANAGER`, `EMPLOYEE`.
  - Operaciones destructivas (Borrar documentos, usuarios, productos) están protegidas mediante la anotación de Spring Security `@PreAuthorize("hasRole('OWNER')")`.

---

## 📦 Desglose de Módulos (Backend)

### 1. Actividad Universal (`com.soldmate.activity`)
- **Funcionamiento**: Funciona como un _Audit Log_. Existe una tabla genérica `ActivityLog`.
- **Implementación**: El servicio `ActivityLogger` se inyecta en el resto de los módulos y provee un método asíncrono para grabar `CREADO`, `MODIFICADO` o `ELIMINADO`.
- **Mapeo UI**: Cada registro almacena un `entityType` (`INCIDENT`, `DOCUMENT`, `USER`, `SUPPLIER`, `TASK`). El frontend traduce este tipo a iconos específicos (`Wrench`, `FileText`, `Users`) y genera oraciones humanizadas (ej. *"Mateo Mudano modificó Documento «Factura_luz»"*).

### 2. Gestión Documental (`com.soldmate.documents`)
- **Bucket Central**: Los ficheros se suben a Supabase Storage (Bucket configurado en `soldmate.supabase.bucket`, normalmente `"incidents"` o `"documents"`).
- **Proceso Interno**:
  1. El usuario sube el `MultipartFile`.
  2. `DocumentService` detecta el MIME type en memoria y categoriza el formato interno (`PDF`, `XLSX`, `IMG`, `DOCX`, etc.).
  3. Se hace un POST (vía estándar de Java `HttpClient`) al Storage de Supabase, inyectando el `anon_key` de Supabase, y agrupando por ruta: `{companyId}/{UUID}.{extensión}`.
  4. Se guarda la URL pública retornada en PostgreSQL junto a sus metadatos (tamaño, categoría, subidor).

### 3. CRM e Incidencias (`com.soldmate.incidents` / `com.soldmate.calendar`)
- Las incidencias (`Incident`) disponen de un flujo de estado rígido: `OPEN` → `IN_PROGRESS` → `CLOSED`. Manejan prioridades (`LOW`, `NORMAL`, `URGENT`) y soportan foto adjunta vía Supabase.
- La Agenda (`CalendarEvent`) almacena registros con Fecha (`LocalDate`) y Hora (`LocalTime`).

### 4. Inventario y Proveedores (`com.soldmate.inventory`)
- Gestión de Stock de `Product` y ficha de `Supplier`.
- **Soft Deletion**: Los proveedores y productos no se destruyen de base de datos para no romper historiales (aunque en el MVP el DELETE de Producto sea hard-delete, los proveedores soportan desactivación: `active=false`).
- **Fiscalidad Inicial**: El modelo contempla tipos de IVA (`vatRate`), p.e. `10.00` para hostelería o `21.00` general.

---

## 💻 Arquitectura Frontend (React / Next.js)

### Tecnologías Clave y Capas
1. **Páginas y Rutas**: Todo reside en `apps/next/app`. Cada módulo tiene su carpeta con un `page.tsx`. Son componentes `"use client"` fuertemente apoyados en CSR (Client-Side Rendering) tras la carga.
2. **Llamadas API**: Gestionadas centralmente por `packages/app/lib/api.ts`. Esta capa envuelve la función `authFetch`, que automáticamente incrusta el JWT del `localStorage` en los *headers*.
3. **Gestor de Estado (Zustand)**: `packages/app/lib/store.ts` maneja el estado global para la autenticación (guardando token, rol y datos de sesión). Incluye middleware de persistencia en `localStorage` (`soldmate-auth`).
4. **Data Fetching (React Query)**: `QueryClient` está configurado en el layout raíz. Se utilizan `useQuery` y `useMutation` a lo largo de toda la aplicación para cachear listas (Ej: la tabla de Documentos o de Empleados) y re-refrescarlas automáticamente (`invalidateQueries`).
5. **UI Kit y Estética**: 
   - Tonos predeterminados: Fondo grisáceo premium (`bg-[#eef1f8]`), Textos muy oscuros (`text-[#1e2040]`), y acentos vibrantes (`text-[#4f6ef7]`).
   - Iconografía estricta usando `lucide-react`. 
   - El estado de la barra lateral (Sidebar) se maneja localmente (`sm_navbar_collapsed` en memoria) para sobrevivir al refresco de páginas.

## 🚀 Guía de Despliegue

La solución está completamente _dockerizada_ en el directorio raíz.

1. **Variables Obligatorias**:
   El archivo `application.properties` (o el `.env` de docker) debe definir:
   - `SOLDMATE_JWT_SECRET` (Mínimo 32 caracteres)
   - `SOLDMATE_SUPABASE_URL` y `SOLDMATE_SUPABASE_ANON_KEY`.
   - Postgres connection URL.
2. **Comando Universal**: 
   `docker compose up --build -d` levanta:
   - `soldmate-db` (Postgres oficial)
   - `soldmate-backend` (Maven multi-stage -> .jar ejecutado en Alpine). Puerto interno 8080 expuesto al host como 28080.
   - `soldmate-frontend` (Next.js Standalone Build). Puerto interno 3000 expuesto al host como 23000.
