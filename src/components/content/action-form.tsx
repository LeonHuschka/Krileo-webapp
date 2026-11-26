"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

type Result = { error?: string } | void;

/**
 * A form that runs a server action and reports the outcome as a toast.
 * The action returns { error } instead of throwing (messages of thrown
 * errors are hidden in production).
 */
export function ActionForm({
  action,
  children,
  className,
  success,
  confirm,
  reset,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  success?: string;
  confirm?: string;
  reset?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(form, submitter);
        start(async () => {
          const r = await action(fd);
          if (r && r.error) toast.error(r.error);
          else {
            if (success) toast.success(success);
            if (reset) form.reset();
          }
        });
      }}
    >
      <fieldset disabled={pending} className={pending ? "contents opacity-60" : "contents"}>
        {children}
      </fieldset>
    </form>
  );
}
