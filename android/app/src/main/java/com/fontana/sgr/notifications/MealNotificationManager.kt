package com.fontana.sgr.notifications

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.util.*

/**
* Manager responsible for modern runtime permissions management (Android 13/14+)
* and scheduling resilient Exact Alarms via setExactAndAllowWhileIdle.
*/
object MealNotificationManager {

  private const val TAG = "MEAL_NOTIF_MANAGER"
  const val REQUEST_CODE_POST_NOTIFICATIONS = 111

  @SuppressLint("ScheduleExactAlarm")
  fun scheduleNextMealPreciseAlarm(
    context: Context,
    mealType: String,
    cutoffTimeStr: String,
    obraId: String
    ) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (!alarmManager.canScheduleExactAlarms()) {
        Log.w(TAG, "Exact alarm permission missing! Skipping scheduling until user approves.")
        return
      }
    }

    val parts = cutoffTimeStr.split(":")
    if (parts.size != 2) return
    val hour = parts[0].toIntOrNull() ?: 8
    val minute = parts[1].toIntOrNull() ?: 30

    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)

      if (timeInMillis <= System.currentTimeMillis()) {
        add(Calendar.DAY_OF_YEAR, 1)
      }
    }

    val requestCode = 2000 + mealType.hashCode()
    val intent = Intent(context, MealAlarmReceiver::class.java).apply {
      putExtra("meal_type", mealType)
      putExtra("schedule_time", cutoffTimeStr)
      putExtra("obra_id", obraId)
    }
    val pendingIntent = PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          calendar.timeInMillis,
          pendingIntent
          )
        Log.d(TAG, "Exact alarm scheduled successfully.")
      } else {
        alarmManager.setExact(
          AlarmManager.RTC_WAKEUP,
          calendar.timeInMillis,
          pendingIntent
          )
      }
    } catch (e: SecurityException) {
      Log.e(TAG, "SecurityException: exact alarm schedule rejected by system boundaries.", e)
    }
  }

  fun checkAndRequestNotificationsPermission(activity: Activity): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val status = ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
      if (status != PackageManager.PERMISSION_GRANTED) {
        Log.d(TAG, "POST_NOTIFICATIONS permission not granted. Requesting...")
        ActivityCompat.requestPermissions(
          activity,
          arrayOf(Manifest.permission.POST_NOTIFICATIONS),
          REQUEST_CODE_POST_NOTIFICATIONS
          )
        return false
      }
    }
    return true
  }

  fun checkAndRequestExactAlarmPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (!alarmManager.canScheduleExactAlarms()) {
        Log.w(TAG, "Exact alarms are disabled. Redirecting to settings page.")
        val intent = Intent().apply {
          action = Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
          data = Uri.parse("package:" + context.packageName)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return false
      }
    }
    return true
  }
}
