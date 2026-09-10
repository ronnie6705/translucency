import { useEffect, useRef, type ReactNode } from "react";
let modalCount = 0;
let previousOverflow = "";
// Use the same native-dialog lifecycle as Rhythm's flow and live-timer modals.
export function TaskModal({
  label,
  onClose,
  children,
  wide = false,
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (modalCount++ === 0) previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      if (--modalCount === 0) document.body.style.overflow = previousOverflow;
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`task-modal rhythm-module${wide ? " task-modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
