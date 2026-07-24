package com.fontana.sgr

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.fontana.sgr.notifications.MealNotificationManager
import com.fontana.sgr.notifications.SGRFirebaseMessagingService
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream

/**
 * Native entry point. Hosts the SGR Fontana web app (PWA) inside a WebView
 * and wires up native notification permissions and pending FCM token sync.
 *
 * TODO: replace PRODUCTION_URL below with the real deployed URL of the app
 * (the same domain configured in public/.well-known/assetlinks.json).
 */
class MainActivity : AppCompatActivity() {

  private lateinit var webView: WebView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    webView = WebView(this)
    setContentView(webView)

    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.useWideViewPort = true
    webView.settings.loadWithOverviewMode = true
    webView.webViewClient = WebViewClient()

    // Native download handler: without this, the WebView silently discards any file
    // download triggered by the web app (PDFs via jsPDF/Blob or the remote cardápio file).
    webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
      handleNativeDownload(url, userAgent, contentDisposition, mimeType)
    }

    webView.addJavascriptInterface(SGRNativeBridge(this, webView), "SGRNativeBridge")
    webView.loadUrl(PRODUCTION_URL)

    MealNotificationManager.checkAndRequestNotificationsPermission(this)

    SGRFirebaseMessagingService.registerPendingTokenIfNeeded(this)
  }

  override fun onBackPressed() {
    if (webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }

  /**
   * Handles downloads triggered inside the WebView.
   * - data: URIs (base64) come from PDFs generated in memory on the web side (jsPDF) and are
   *   decoded and written directly to the device's Downloads folder.
   * - http/https URLs (e.g. remote cardápio file) are delegated to the system DownloadManager.
   */
  private fun handleNativeDownload(url: String, userAgent: String, contentDisposition: String?, mimeType: String?) {
    try {
      if (url.startsWith("data:")) {
        val marker = "base64,"
        val idx = url.indexOf(marker)
        if (idx == -1) return
        val base64Data = url.substring(idx + marker.length)
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        val fileName = "SGR_Documento_" + System.currentTimeMillis() + ".pdf"
        saveBytesToDownloads(bytes, fileName, mimeType ?: "application/pdf")
      } else {
        val request = DownloadManager.Request(Uri.parse(url))
        val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
        request.setMimeType(mimeType)
        val cookies = CookieManager.getInstance().getCookie(url)
        request.addRequestHeader("cookie", cookies)
        request.addRequestHeader("User-Agent", userAgent)
        request.setDescription("Baixando documento SGR...")
        request.setTitle(fileName)
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_NOTIFY_COMPLETED)
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

        val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
        Toast.makeText(applicationContext, "Download iniciado! Verifique as notificações.", Toast.LENGTH_LONG).show()
      }
    } catch (e: Exception) {
      Toast.makeText(applicationContext, "Erro ao baixar arquivo: " + e.message, Toast.LENGTH_SHORT).show()
    }
  }

  private fun saveBytesToDownloads(bytes: ByteArray, fileName: String, mimeType: String) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val resolver = contentResolver
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
          put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
          put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri != null) {
          resolver.openOutputStream(uri)?.use { it.write(bytes) }
        }
      } else {
        @Suppress("DEPRECATION")
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val file = File(downloadsDir, fileName)
        FileOutputStream(file).use { it.write(bytes) }
      }
      Toast.makeText(applicationContext, "Arquivo salvo em Downloads: " + fileName, Toast.LENGTH_LONG).show()
    } catch (e: Exception) {
      Toast.makeText(applicationContext, "Erro ao salvar arquivo: " + e.message, Toast.LENGTH_SHORT).show()
    }
  }

  /**
   * Bridge exposed to the web app as window.SGRNativeBridge so it can tell the native side
   * which user is currently logged in (see src/components/AccountSettingsModal.tsx). This app
   * never uses Firebase Authentication - this simply persists the plain email locally so
   * SGRFirebaseMessagingService can attach it to FCM tokens written to Firestore (collection
   * fcmTokens). No native sign-in happens here.
   */
  class SGRNativeBridge(private val activity: MainActivity, private val webView: WebView) {
    private val context: Context get() = activity
    @JavascriptInterface
    fun setCurrentUser(email: String?) {
      if (email.isNullOrBlank()) return
      SGRFirebaseMessagingService.saveCurrentUserEmail(context, email)
    }
    @JavascriptInterface
    fun isBiometricAvailable(): Boolean {
      val biometricManager = BiometricManager.from(activity)
      return biometricManager.canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
      ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    @JavascriptInterface
    fun authenticateBiometric() {
      activity.runOnUiThread {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            super.onAuthenticationSucceeded(result)
            notifyWeb(true, null)
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            super.onAuthenticationError(errorCode, errString)
            notifyWeb(false, errString.toString())
          }
        })

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
          .setTitle("Biometria SGR Fontana")
          .setSubtitle("Confirme sua identidade para continuar")
          .setNegativeButtonText("Cancelar")
          .setAllowedAuthenticators(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
          )
          .build()

        biometricPrompt.authenticate(promptInfo)
      }
    }

    private fun notifyWeb(success: Boolean, error: String?) {
      webView.post {
        val safeError = (error ?: "").replace("\\", "\\\\").replace("'", "\\'")
        val js = "window.dispatchEvent(new CustomEvent('sgr-native-biometric-result', { detail: { success: " + success + ", error: '" + safeError + "' } }));"
        webView.evaluateJavascript(js, null)
      }
    }
    
  }

  companion object {
    private const val PRODUCTION_URL = "https://app-restaurante-fontana.vercel.app/"
  }
}
