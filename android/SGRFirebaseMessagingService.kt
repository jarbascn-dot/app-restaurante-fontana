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
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.fontana.sgr.MainActivity // Substitute with your actual package name

/**
 * Service to receive and process Firebase Cloud Messaging (FCM) push notifications
 * with ultra-resilient lifecycle handling (even if app is closed or terminated).
 */
class SGRFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM Token generated: $token")
        // Always send token to backend to associate it with the logged colaborador / CPF
        sendRegistrationToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "Push message received from server: ${remoteMessage.messageId}")

        // Check if message contains a data payload (recommended for reliable background processing)
        if (remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "Reserva SGR"
            val body = remoteMessage.data["body"] ?: "Atenção: Horário de confecção da refeição."
            val mealType = remoteMessage.data["mealType"] ?: "refeicao"
            sendVisualNotification(title, body, mealType)
        } else {
            // Fallback to standard FCM notification payload if no data object
            remoteMessage.notification?.let {
                sendVisualNotification(it.title ?: "SGR Fontana", it.body ?: "", "refeicao")
            }
        }
    }

    private fun sendVisualNotification(title: String, messageBody: String, mealType: String) {
        val channelId = CHANNEL_PUHS_HIGH_ID
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create the notification channel (Android 8.0 Oreo+) with High Importance
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = "SGR Confirmações Rápidas"
            val channelDesc = "Avisos emergenciais, liberação de cardápios e status de reservas SGR."
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
                description = channelDesc
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Tap action: opens MainActivity
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

        // sound resource
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        // Build premium high-impact visual notification card
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            // Replace with your real icon resources e.g. R.drawable.ic_sgr_logo
            .setSmallIcon(android.R.drawable.ic_dialog_info) 
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))

        // Trigger notification event
        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    private fun sendRegistrationToServer(token: String) {
        // Implement API call to save current token inside device settings or employee profile in Firestore.
        // E.g.: MyApiService.updatePushToken(token)
    }

    companion object {
        private const val TAG = "FCM_SERVICE"
        const val CHANNEL_PUHS_HIGH_ID = "sgr_high_push_channel"
    }
}
