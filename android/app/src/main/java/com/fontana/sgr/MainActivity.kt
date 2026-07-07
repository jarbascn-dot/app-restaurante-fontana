package com.fontana.sgr

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.fontana.sgr.notifications.MealNotificationManager
import com.fontana.sgr.notifications.SGRFirebaseMessagingService

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
    webView.webViewClient = WebViewClient()
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

  companion object {
    private const val PRODUCTION_URL = "https://REPLACE_WITH_YOUR_DOMAIN.com/"
  }
}
