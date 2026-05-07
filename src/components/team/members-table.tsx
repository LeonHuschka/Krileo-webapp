"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { USER_ROLES } from "@/lib/constants";
import { setMemberRole } from "@/app/(app)/team/actions";
import type { UserProfileRow, UserRole } from "@/lib/types/database";

function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MembersTable({
  members,
  canEdit,
  currentUserId,
}: {
  members: UserProfileRow[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeRole(id: string, role: UserRole) {
    startTransition(async () => {
      try {
        await setMemberRole(id, role);
        toast.success("Rolle aktualisiert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mitglied</TableHead>
            <TableHead>Rolle</TableHead>
            <TableHead>Beigetreten</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {initials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {m.full_name || "—"}
                      {m.id === currentUserId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (du)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {canEdit && m.id !== currentUserId ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m.id, v as UserRole)}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {m.role}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(m.created_at).toLocaleDateString("de-DE")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
