# Soldmate Mobile (Expo)

La app móvil ya está montada y usa las pantallas compartidas del paquete `app`.

## Ejecutar

Desde `soldmate-frontend`:

```bash
npm run mobile
```

O directamente:

```bash
npm run start -w soldmate-expo
```

## Configurar API

1. Copia `.env.example` a `.env` en esta carpeta (`apps/expo`).
2. Ajusta `EXPO_PUBLIC_API_URL` según tu entorno:
   - iOS simulator / web local: `http://localhost:28080`
   - Android emulator: `http://10.0.2.2:28080`
   - Dispositivo físico: `http://<IP_LAN_PC>:28080`

## Flujo actual

- Login / Register
- Dashboard
- Incidencias (lista + nueva)
- Proveedores
- Configuración de empresa

La autenticación usa el mismo store de Zustand que web (`packages/app/lib/store.ts`).

## Generar APK (paso a paso)

1. Instala EAS CLI:

```bash
npm i -g eas-cli
```

2. Inicia sesión en Expo:

```bash
eas login
```

3. Ve a esta carpeta:

```bash
cd apps/expo
```

4. Configura EAS por primera vez:

```bash
eas build:configure
```

5. Edita `app.json`:
   - Cambia `android.package` por uno único de tu marca (ej: `com.tudominio.soldmate`).
   - Reemplaza `extra.eas.projectId` con el ID real que te devuelve Expo.

6. Edita `eas.json`:
   - Reemplaza `EXPO_PUBLIC_API_URL` por tu backend público (`https://...up.railway.app`).

7. Lanza build APK:

```bash
eas build -p android --profile preview
```

8. Cuando termine, Expo mostrará una URL para descargar el `.apk`.

9. Instala el `.apk` en Android y prueba login real.

## Publicación Play Store (AAB)

Para tienda usa perfil `production`:

```bash
eas build -p android --profile production
```

Ese build genera un `.aab` (Google Play).

