"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/app/(app)/settings/actions";
import type { UserProfileRow } from "@/lib/types/database";

type FormData = { full_name: string; avatar_url: string };

export function ProfileForm({ profile }: { profile: UserProfileRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormData>({
    defaultValues: {
      full_name: profile.full_name ?? "",
      avatar_url: profile.avatar_url ?? "",
    },
  });

  function onSubmit(values: FormData) {
    startTransition(async () => {
      try {
        await updateMyProfile({
          full_name: values.full_name,
          avatar_url: values.avatar_url || null,
        });
        toast.success("Profil aktualisiert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="max-w-md space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input id="full_name" {...form.register("full_name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
        <Input
          id="avatar_url"
          placeholder="https://…"
          {...form.register("avatar_url")}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
