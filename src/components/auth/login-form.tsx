"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  loginSchema,
  magicLinkSchema,
  type LoginFormData,
  type MagicLinkFormData,
} from "@/lib/validations/auth";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_NAME } from "@/lib/constants";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const passwordForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const magicForm = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  async function onPasswordLogin(data: LoginFormData) {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function onMagicLink(data: MagicLinkFormData) {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <Image
          src="/krileo-logo.png"
          alt={APP_NAME}
          width={180}
          height={180}
          className="mx-auto mb-4 h-32 w-auto"
          priority
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Willkommen zurück
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Melde dich bei {APP_NAME} an
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="password">Passwort</TabsTrigger>
            <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
          </TabsList>

          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <TabsContent value="password">
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordLogin)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="du@krileo.de"
                  className="bg-secondary/50"
                  {...passwordForm.register("email")}
                />
                {passwordForm.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  className="bg-secondary/50"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting
                  ? "Anmelden..."
                  : "Anmelden"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic-link">
            {magicLinkSent ? (
              <div className="rounded-lg bg-primary/10 px-3 py-4 text-center text-sm text-primary">
                Check deine E-Mails — wir haben dir einen Login-Link geschickt.
              </div>
            ) : (
              <form
                onSubmit={magicForm.handleSubmit(onMagicLink)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="magic-email">E-Mail</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="du@krileo.de"
                    className="bg-secondary/50"
                    {...magicForm.register("email")}
                  />
                  {magicForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {magicForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={magicForm.formState.isSubmitting}
                >
                  {magicForm.formState.isSubmitting
                    ? "Senden..."
                    : "Magic Link senden"}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Noch keinen Account?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline underline-offset-4"
        >
          Registrieren
        </Link>
      </p>
    </div>
  );
}
