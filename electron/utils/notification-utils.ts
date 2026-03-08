import { Notification } from 'electron';

export function showNotification(title: string, body: string, onClick?: () => void) {
  if (!Notification.isSupported()) {
    console.warn('Notification is not supported on this platform');
    return;
  }

  const notification = new Notification({
    title,
    body,
    silent: false, // Play sound by default
  });

  if (onClick) {
    notification.on('click', onClick);
  }

  notification.show();
}
