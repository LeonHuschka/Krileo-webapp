"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function SignupForm() {
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(data: SignupFormData) {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check deine E-Mail
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Wir haben dir einen Bestätigungs-Link geschickt. Klick ihn, um deinen
            Account zu aktivieren.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Zurück zum Login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
          K
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {APP_NAME} Account erstellen
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Trag deine Daten ein, um loszulegen
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Vollständiger Name</Label>
            <Input
              id="fullName"
              placeholder="Max Mustermann"
              className="bg-secondary/50"
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">E-Mail</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="du@krileo.de"
              className="bg-secondary/50"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Passwort</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Mindestens 6 Zeichen"
              className="bg-secondary/50"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Account erstellen..."
              : "Registrieren"}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Schon einen Account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline underline-offset-4"
        >
          Anmelden
        </Link>
      </p>
    </div>
  );
}
