import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  addToast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ addToast: () => {} });

export const useToast = () => useContext(Ctx);

let nextId = 1; // monotonic ID allows duplicate messages to coexist

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // stable callback identity prevents ToastItem unnecessary re-renders
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // auto-dismiss toast after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} className="text-green-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
    info: <Info size={16} className="text-blue-400" />,
  };

  const borderColors: Record<ToastType, string> = {
    success: 'border-green-600',
    error: 'border-red-600',
    info: 'border-blue-600',
  };

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 bg-[#1a1a1a] border ${borderColors[toast.type]} rounded-lg shadow-lg text-sm text-[#e0e0e0] animate-slide-up`}
    >
      <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-[#666] hover:text-[#ccc] shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
