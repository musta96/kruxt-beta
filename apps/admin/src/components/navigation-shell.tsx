"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function isNavigationActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" || pathname === "" : pathname === href || pathname.startsWith(href + "/");
}

export function MobileNavigation({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => { close.current(); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (desktop.matches) close.current(); };
    desktop.addEventListener("change", resize);
    resize();
    return () => {
      desktop.removeEventListener("change", resize);
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="mobile-navigation"
      aria-label="Main navigation"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/60 lg:hidden"
    >
      <div className="h-full w-72 max-w-[calc(100vw-3rem)]" onClick={(event) => {
        if ((event.target as HTMLElement).closest("a[href]")) onClose();
      }}>
        {children}
      </div>
    </dialog>
  );
}

