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

