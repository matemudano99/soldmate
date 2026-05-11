# APK tipo "acceso a web" (sin Expo)

Si quieres una app Android estable que simplemente abra tu plataforma web, usa un wrapper nativo con `WebView`.

## Requisitos

- Android Studio instalado
- URL pública HTTPS de tu app, por ejemplo: `https://app.soldmate.es`

## Crear proyecto Android

1. Android Studio -> `New Project` -> `Empty Views Activity`
2. Nombre recomendado: `SoldmateWeb`
3. Package name recomendado: `com.soldmate.web`
4. Min SDK: 24 o superior

## `AndroidManifest.xml`

En `app/src/main/AndroidManifest.xml` añade permisos y declara la activity:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<application ... >
    <activity
        android:name=".MainActivity"
        android:exported="true"
        android:screenOrientation="portrait">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

## Layout con WebView

En `app/src/main/res/layout/activity_main.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</FrameLayout>
```

## `MainActivity.kt`

En `app/src/main/java/com/soldmate/web/MainActivity.kt`:

```kotlin
package com.soldmate.web

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean = false
        }
        webView.webChromeClient = WebChromeClient()
        webView.loadUrl("https://app.soldmate.es")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }
}
```

## Generar APK

1. `Build` -> `Generate Signed Bundle / APK`
2. Selecciona `APK`
3. Crea o usa un `keystore`
4. `release` build

## Recomendaciones para tu web

- Mantener sesión con cookies seguras (`SameSite=Lax` o `None`+`Secure` según dominio).
- Activar HTTPS obligatorio.
- Si usas subida de archivos, probar cámara/galería en Android 13+.
- Mostrar pantalla offline en la web para cuando no haya red.
