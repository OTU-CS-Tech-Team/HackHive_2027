"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/constants";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onError, onExpire }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    // The form mounts this only on its last step, so it can mount, unmount and
    // mount again: every mount renders a widget and every unmount removes it.
    useEffect(() => {
      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onVerifyRef.current(token),
          "error-callback": () => onErrorRef.current?.(),
          "expired-callback": () => onExpireRef.current?.(),
        });
      };

      let script: HTMLScriptElement | null = null;
      if (window.turnstile) {
        renderWidget();
      } else {
        script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
        if (!script) {
          script = document.createElement("script");
          script.src = SCRIPT_SRC;
          script.async = true;
          document.head.appendChild(script);
        }
        script.addEventListener("load", renderWidget);
      }

      return () => {
        script?.removeEventListener("load", renderWidget);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, []);

    return (
      <div className="flex justify-center">
        <div ref={containerRef} />
      </div>
    );
  }
);
