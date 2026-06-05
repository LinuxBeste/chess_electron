import { useStoreValue } from '../hooks/useStore';

export default function ToastContainer() {
  const toasts = useStoreValue('toasts');
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
