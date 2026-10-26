import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelSection } from "@/components/ui/panel";
import { Wordmark } from "@/components/ui/wordmark";

/** A full-page message in one centred panel: loading, not found, misconfigured. */
export function RoomMessage({
  title,
  text,
  action,
  children,
}: {
  title?: string;
  text: string;
  action?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col px-4 sm:px-6">
      <nav className="flex h-16 items-center">
        <Link href="/">
          <Wordmark />
        </Link>
      </nav>
      <div className="grid flex-1 place-items-center py-10">
        <Panel className="w-full max-w-[440px]">
          <PanelSection className="flex flex-col gap-3 p-8" aria-live="polite">
            {title && <h1 className="m-0 text-title">{title}</h1>}
            <p className="m-0 text-body text-ink-muted">{text}</p>
            {children}
            {action && (
              <Link href={action.href} className={buttonClasses({ variant: "outline", className: "mt-2 self-start" })}>
                {action.label}
              </Link>
            )}
          </PanelSection>
        </Panel>
      </div>
    </main>
  );
}
