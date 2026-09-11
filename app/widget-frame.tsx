'use client';
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { widgetOptions, type WidgetOptions } from '@/lib/website-integration';
import './website-integration.css';
export function WidgetFrame({
  options,
  children,
  className = '',
}: {
  options?: Partial<WidgetOptions>;
  children: ReactNode;
  className?: string;
}) {
  const o = widgetOptions(options),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!o.embed || window.parent === window) return;
    const el = ref.current;
    if (!el) return;
    const send = () =>
      window.parent.postMessage(
        {
          type: 'eventdesk:resize',
          height: Math.ceil(el.getBoundingClientRect().height + 32),
        },
        '*',
      );
    const observer = new ResizeObserver(send);
    observer.observe(el);
    send();
    return () => observer.disconnect();
  }, [o.embed]);
  return (
    <div
      ref={ref}
      className={`eventdesk-public-widget ${o.embed ? 'widget-embedded' : ''} ${o.placeholders ? 'widget-placeholders' : ''} ${o.wideButtons ? 'widget-wide-buttons' : ''} ${className}`}
      style={
        {
          '--widget-text': o.textColor,
          '--widget-button': o.buttonColor,
          '--widget-button-text': o.buttonTextColor,
          '--widget-border': o.borderColor,
          '--widget-input-bg': o.inputBackground,
          '--widget-radius': o.borderRadius + 'px',
          '--widget-border-width': o.borderWidth + 'px',
          '--widget-label-size': o.labelSize + 'px',
          '--widget-label-weight': o.labelWeight,
          fontFamily: o.font,
          maxWidth: o.maxWidth,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
