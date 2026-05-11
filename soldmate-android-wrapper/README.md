# Soldmate Android Web Wrapper

Aplicacion Android nativa minima (sin Expo) que abre la web de Soldmate dentro de un `WebView`.

## Caracteristicas

- Navegacion web dentro de la app
- Boton atras nativo (retrocede en historial del WebView)
- Soporte de seleccion de archivos para formularios (`input type=file`)
- Configuracion de release para generar APK desde Android Studio

## Configuracion

La URL se define en `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "WEB_URL", "\"https://app.soldmate.es\"")
```

Cambia esa URL por tu dominio real antes de compilar.

## Icono del launcher

Los `ic_launcher.png` en `app/src/main/res/mipmap-*` se generan desde el logo web (`soldmate-frontend/apps/next/public/logo.png`). Para regenerarlos tras cambiar el logo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-launcher-icons.ps1
```

## Generar APK

1. Abre Android Studio
2. `Open` -> selecciona `soldmate-android-wrapper`
3. Espera sync de Gradle
4. `Build` -> `Generate Signed Bundle / APK` -> `APK`

## Notas

- Requiere HTTPS en produccion
- Si tu web usa login por cookie, revisa politicas `SameSite` y `Secure`
