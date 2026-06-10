/**
 * ToastContainer — renders a stack of transient notification messages
 * at the top of the viewport.
 *
 * Reads from the observable store's `toasts` array.  Each toast has
 * a 4-second auto-dismiss timer managed by the store itself.
 */

import { useStoreValue } from '../hooks/useStore';
import logger from '../logger';

export default function ToastContainer() {
  const toasts = useStoreValue('toasts');
  if (toasts.length > 0) logger.debug('ToastContainer rendering ' + toasts.length + ' toasts');
  return (
    <div className="toast-bar">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
