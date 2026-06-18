/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let fallbackTimeoutId: any = null;

/**
 * Robust cross-platform helper to request permissions and schedule background
 * and foreground notification triggers.
 */
export async function scheduleNotification(
  time: string,
  title: string,
  body: string,
  email?: string
) {
  const userParam = email || 'guest';

  // Persist locally in localStorage for robust client fallback reads
  localStorage.setItem(`sgr_notify_enabled_${userParam}`, 'true');
  localStorage.setItem(`sgr_notify_time_${userParam}`, time);

  const isSWSupported = 'serviceWorker' in navigator;
  const isNotificationSupported = 'Notification' in window;

  if (!isSWSupported || !isNotificationSupported) {
    console.warn('[Scheduler] Service Workers ou Notifications não são totalmente suportados por esta plataforma.');
    runLocalFallback(time, title, body);
    return;
  }

  try {
    // Request permission if not already denied or granted
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[Scheduler] Permissão para notificações negada pelo usuário ou sistema:', permission);
      return;
    }

    // Register our customizable sw.js
    let reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    // Wait until controller is ready to receive messages
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }

    // Relay notification specs to background thread
    const sw = navigator.serviceWorker.controller || reg.active;
    if (sw) {
      sw.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        email: userParam,
        time,
        title,
        body,
        timing: 'mesmo_dia'
      });
      console.log(`[Scheduler] Agendamento enviado com sucesso para o Service Worker: ${time} para ${userParam}`);
    } else {
      console.warn('[Scheduler] Não há um service worker controlador pronto.');
    }
  } catch (error) {
    console.error('[Scheduler] Erro crítico no fluxo de agendamento de notificações:', error);
  }

  // Always boot up foreground memory fallback
  runLocalFallback(time, title, body);
}

function runLocalFallback(time: string, title: string, body: string) {
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }

  const [cfgHour, cfgMin] = time.split(':').map(Number);
  if (isNaN(cfgHour) || isNaN(cfgMin)) return;

  const now = new Date();
  const target = new Date();
  target.setHours(cfgHour, cfgMin, 0, 0);

  // If time is already in past today, set for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const delayMs = target.getTime() - now.getTime();
  console.log(`[Scheduler Fallback] Agendamento em primeiro plano ativo para daqui a ${Math.round(delayMs / 1000)} segundos`);

  if (delayMs > 0 && delayMs < 2147483647) {
    fallbackTimeoutId = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon.png'
        });
      } else {
        console.log(`[Notification Fallback Fired] ${title}: ${body}`);
      }
      // Stagger tomorrow's timer
      runLocalFallback(time, title, body);
    }, delayMs);
  }
}
