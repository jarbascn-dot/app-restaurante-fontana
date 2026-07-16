package com.fontana.sgr

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.fontana.sgr.notifications.MealNotificationManager
import com.fontana.sgr.notifications.SGRFirebaseMessagingService
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

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
