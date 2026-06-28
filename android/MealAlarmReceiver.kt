package com.fontana.sgr.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.fontana.sgr.MainActivity // Substitute with your actual package name

/**
 * BroadcastReceiver responsible for waking the system at precise meal times (AlarmManager matching).
 * Works reliably even in Android Doze Mode / battery saving regimes.
 */
class MealAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        Log.d(TAG, "Exact alarm awakened! Shaking CPU to run notification core.")

        val mealType = intent.getStringExtra("meal_type") ?: "Almoço"
        val obraId = intent.getStringExtra("obra_id") ?: "o-sede"
        val scheduleTime = intent.getStringExtra("schedule_time") ?: "12:00"

        // Fire physical system notification
        triggerLocalNotification(context, mealType, scheduleTime)

        // Reschedule for next day (guaranteeing continuous exact daily tracking)
        MealNotificationManager.scheduleNextMealPreciseAlarm(context, mealType, scheduleTime, obraId)
    }

    private fun triggerLocalNotification(context: Context, mealType: String, scheduleTime: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = CHANNEL_ALARM_EXACT_ID

        // Channel creation with Max Importance
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = "SGR Alarmes de Refeições"
            val channelDesc = "Avisos e alarmes cirúrgicos com vibração máxima para o horário limite de suas reservas."
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
                description = channelDesc
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 600) // Double warning vibrations
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Action when notification is tapped
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("action", "check_reserva")
            putExtra("meal_type", mealType)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        // Build premium, visible high-vibration notification layout
        val titleStr = "⚠️ Limite para Reserva: $mealType"
        val bodyStr = "O horário para reservar ou alterar seu $mealType encerra em instantes ($scheduleTime). Verifique seu SGR Fontana!"

        val builder = NotificationCompat.Builder(context, channelId)
            // Replace with your real icon resources e.g. R.drawable.ic_notification_chef
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(titleStr)
            .setContentText(bodyStr)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 400, 200, 400))
            .setPriority(NotificationCompat.PRIORITY_MAX) // Heads up banner
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyStr))

        val notificationId = 5500 + mealType.hashCode()
        notificationManager.notify(notificationId, builder.build())
    }

    companion object {
        private const val TAG = "ALARM_RECEIVER"
        const val CHANNEL_ALARM_EXACT_ID = "sgr_local_exact_alarm_channel"
    }
}
