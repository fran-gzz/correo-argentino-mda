export type ToastType = 'alert-info' | 'alert-success' | 'alert-warning' | 'alert-error';

export function showToast(message: string, type: ToastType = 'alert-info', durationMs: number = 3000) {
  const container = document.getElementById('global-toast-container');
  if (!container) return;

  const toastDiv = document.createElement('div');
  toastDiv.className = `alert ${type} shadow-lg slide-in-right`;
  
  const span = document.createElement('span');
  span.textContent = message;
  
  toastDiv.appendChild(span);
  container.appendChild(toastDiv);

  setTimeout(() => {
    toastDiv.classList.replace('slide-in-right', 'slide-out-right');
    toastDiv.addEventListener('animationend', () => {
      toastDiv.remove();
    });
  }, durationMs);
}
