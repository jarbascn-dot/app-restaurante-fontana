package com.fontana.sgr.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.fontana.sgr.MainActivity

/**
 * Service to receive and process Firebase Cloud Messaging (FCM) push notifications
 * with ultra-resilient lifecycle handling (even if app is closed or terminated).
 */
class SGRFirebaseMessagingService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    Log.d(TAG, "New FCM Token generated: " + token)
    savePendingToken(applicationContext, token)
    sendRegistrationToServer(token)
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)
    Log.d(TAG, "Push message received from server: " + remoteMessage.messageId)

    if (remoteMessage.data.isNotEmpty()) {
      val title = remoteMessage.data["title"] ?: "Reserva SGR"
      val body = remoteMessage.data["body"] ?: "Atencao: horario de confeccao da refeicao."
      val mealType = remoteMessage.data["mealType"] ?: "refeicao"
      sendVisualNotification(title, body, mealType)
    } else {
      remoteMessage.notification?.let {
        sendVisualNotification(it.title ?: "SGR Fontana", it.body ?: "", "refeicao")
      }
    }
  }

  private fun sendVisualNotification(title: String, messageBody: String, mealType: String) {
    val channelId = CHANNEL_PUSH_HIGH_ID
    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelName = "SGR Confirmacoes Rapidas"
      val channelDesc = "Avisos emergenciais, liberacao de cardapios e status de reservas SGR."
      val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
        description = channelDesc
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
      }
      notificationManager.createNotificationChannel(channel)
    }

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("tab_target", "colaborador")
      putExtra("meal_type", mealType)
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      System.currentTimeMillis().toInt(),
      intent,
      PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
    )

    val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    val notificationBuilder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(messageBody)
      .setAutoCancel(true)
      .setSound(defaultSoundUri)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setContentIntent(pendingIntent)
      .setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))

    val notificationId = System.currentTimeMillis().toInt()
    notificationManager.notify(notificationId, notificationBuilder.build())
  }

  /**
   * Saves the FCM token to the SAME Firestore location the backend (api/send-notifications.ts /
   * netlify/functions/send-notifications.ts) reads from: collection "fcmTokens", document id =
   * sanitized lowercase email, field "userId" = raw lowercase email (matching the format used in
   * notificationQueue.userId). This app never uses Firebase Authentication, so the native side
   * relies on the email the web app reports via SGRNativeBridge.setCurrentUser(email), persisted
   * in SharedPreferences (see MainActivity.SGRNativeBridge).
   * IMPORTANT: firestore.rules requires this document to have EXACTLY these 3 keys:
   * token, userId, updatedAt (see isValidFCMToken in firestore.rules). Do not add extra fields.
   */
  private fun sendRegistrationToServer(token: String) {
    val email = getCurrentUserEmail(applicationContext)
    if (email == null) {
      Log.w(TAG, "No current user email known yet. Token stored locally, will sync after login.")
      return
    }
    writeTokenToFirestore(email, token)
  }

  private fun writeTokenToFirestore(email: String, token: String) {
    val docId = sanitizeEmailForDocId(email)
    val data = hashMapOf(
      "token" to token,
      "userId" to email,
      "updatedAt" to FieldValue.serverTimestamp()
    )
    FirebaseFirestore.getInstance().collection("fcmTokens").document(docId)
      .set(data, SetOptions.merge())
      .addOnSuccessListener {
        Log.d(TAG, "FCM token synced to fcmTokens/" + docId)
        clearPendingToken(applicationContext)
      }
      .addOnFailureListener { e ->
        Log.e(TAG, "Failed to sync FCM token to Firestore", e)
      }
  }

  companion object {
    private const val TAG = "FCM_SERVICE"
    const val CHANNEL_PUSH_HIGH_ID = "sgr_high_push_channel"
    private const val PREFS_NAME = "sgr_fcm_prefs"
    private const val KEY_PENDING_TOKEN = "pending_fcm_token"
    private const val KEY_CURRENT_USER_EMAIL = "current_user_email"

    private fun savePendingToken(context: Context, token: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_PENDING_TOKEN, token).apply()
    }

    private fun clearPendingToken(context: Context) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().remove(KEY_PENDING_TOKEN).apply()
    }

    /**
     * Called by MainActivity.SGRNativeBridge.setCurrentUser(email) whenever the web app
     * reports which user is currently logged in. Persists the email so this service can
     * later attach it to the FCM token, and immediately tries to flush any pending token.
     */
    fun saveCurrentUserEmail(context: Context, email: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_CURRENT_USER_EMAIL, email.trim().lowercase()).apply()
      registerPendingTokenIfNeeded(context)
    }

    private fun getCurrentUserEmail(context: Context): String? {
      return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(KEY_CURRENT_USER_EMAIL, null)
    }

    /**
     * Sanitizes an email the same way the web app does when building Firestore document ids
     * (see src/lib/notificationScheduler.ts): lowercase, trim, non-alphanumeric chars -> '_'.
     */
    private fun sanitizeEmailForDocId(email: String): String {
      return email.trim().lowercase().replace(Regex("[^a-zA-Z0-9]"), "_")
    }

    fun registerPendingTokenIfNeeded(context: Context) {
      val email = getCurrentUserEmail(context) ?: return
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val pendingToken = prefs.getString(KEY_PENDING_TOKEN, null) ?: return
      val docId = sanitizeEmailForDocId(email)

      val data = hashMapOf(
        "token" to pendingToken,
        "userId" to email,
        "updatedAt" to FieldValue.serverTimestamp()
      )
      FirebaseFirestore.getInstance().collection("fcmTokens").document(docId)
        .set(data, SetOptions.merge())
        .addOnSuccessListener {
          Log.d(TAG, "Pending FCM token synced to fcmTokens/" + docId)
          clearPendingToken(context)
        }
        .addOnFailureListener { e ->
          Log.e(TAG, "Failed to sync pending FCM token", e)
        }
    }
  }
}
