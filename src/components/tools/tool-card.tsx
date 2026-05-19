"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Mail,
  User,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ToolRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopiert`);
  } catch {
    toast.error("Konnte nicht kopieren");
  }
}

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function CredentialField({
  icon: Icon,
  value,
  label,
  masked = false,
}: {
  icon: typeof Mail;
  value: string;
  label: string;
  masked?: boolean;
}) {
  const [visible, setVisible] = useState(!masked);
  const display = visible ? value : "•".repeat(Math.min(value.length, 12));

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/40 px-2.5 py-2 text-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs",
          !visible && "tracking-widest",
        )}
        title={visible ? value : ""}
      >
        {display}
      </span>
      {masked && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title={visible ? "Verbergen" : "Anzeigen"}
        >
          {visible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => copy(value, label)}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Kopieren"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ToolCard({
  tool,
  onClick,
}: {
  tool: ToolRow;
  onClick: () => void;
}) {
  const host = hostname(tool.url);
  return (
    <Card
      onClick={onClick}
      className="group flex cursor-pointer flex-col gap-3 border-border/60 bg-card p-4 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight">
            {tool.name}
          </div>
          {host && (
            <div className="truncate text-xs text-muted-foreground">
              {host}
            </div>
          )}
        </div>
        {tool.category && (
          <Badge
            variant="outline"
            className="shrink-0 border-border/60 bg-card text-[10px] font-medium text-muted-foreground"
          >
            {tool.category}
          </Badge>
        )}
      </div>

      {tool.url && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full justify-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <a href={tool.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Öffnen
          </a>
        </Button>
      )}

      <div
        className="space-y-1.5"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {tool.login_email && (
          <CredentialField
            icon={Mail}
            value={tool.login_email}
            label="E-Mail"
          />
        )}
        {tool.login_username && (
          <CredentialField
            icon={User}
            value={tool.login_username}
            label="Username"
          />
        )}
        {tool.login_password && (
          <CredentialField
            icon={KeyRound}
            value={tool.login_password}
            label="Passwort"
            masked
          />
        )}
      </div>
    </Card>
  );
}
