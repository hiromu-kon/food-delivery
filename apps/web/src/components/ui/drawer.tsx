'use client';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

function DrawerContent({
  className,
  children,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const startY = React.useRef<number | null>(null);
  const suppressClick = React.useRef(false);
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const distance = startY.current === null ? 0 : Math.max(0, event.clientY - startY.current);
    startY.current = null;
    setDragging(false);
    setDragY(0);
    if (distance > 80) closeRef.current?.click();
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="drawer-overlay"
        className="bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-50 duration-150 motion-reduce:animate-none"
      />
      <DialogPrimitive.Content
        data-slot="drawer"
        className={cn(
          'bg-base shadow-overlay data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-32px)] w-full max-w-140 flex-col rounded-t-lg pb-[max(12px,env(safe-area-inset-bottom))] duration-150 outline-none motion-reduce:animate-none',
          !dragging && 'transition-transform motion-reduce:transition-none',
          className,
        )}
        style={{ ...style, ...(dragY > 0 && { transform: `translateY(${dragY}px)` }) }}
        {...props}
      >
        <button
          type="button"
          aria-label="シートを閉じる"
          className="flex h-10 w-full shrink-0 touch-none items-center justify-center rounded-t-lg outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-(--border-color-focus)"
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            startY.current = event.clientY;
            suppressClick.current = false;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (startY.current === null) return;
            const distance = Math.max(0, event.clientY - startY.current);
            if (Math.abs(event.clientY - startY.current) > 8) suppressClick.current = true;
            setDragY(distance);
          }}
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            startY.current = null;
            setDragging(false);
            setDragY(0);
            suppressClick.current = true;
          }}
          onClick={() => {
            if (!suppressClick.current) closeRef.current?.click();
            suppressClick.current = false;
          }}
        >
          <span className="h-1 w-10 rounded-full bg-(--border-color-strong)" aria-hidden />
        </button>
        <DialogPrimitive.Close asChild>
          <IconButton ref={closeRef} aria-label="閉じる" className="absolute top-10 right-2">
            <XIcon />
          </IconButton>
        </DialogPrimitive.Close>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-3">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-heading-m pr-10', className)} {...props} />;
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body-m text-secondary', className)}
      {...props}
    />
  );
}

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger };
