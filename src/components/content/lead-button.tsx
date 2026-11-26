"use client";

import { useState, useTransition } from "react";
import { addLead } from "@/app/d/actions";

/** "Eine neue Kundin kam über Instagram" – one tap, two optional fields. */
export function LeadButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await addLead({ token, service, amount });
      if (r.ok) {
        setMsg("💚 Danke! Ist eingetragen.");
        setOpen(false);
        setService("");
        setAmount("");
      } else setMsg(r.error);
    });
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMsg(null);
          }}
          className="w-full rounded-2xl border-2 border-[#C99A45] bg-white/60 px-6 py-5 text-xl font-medium text-[#2F4A3F]"
        >
          💚 Neue Kundin über Instagram
        </button>
        {msg && <p className="mt-3 text-center font-medium text-emerald-700">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[#C99A45] bg-white/70 p-5">
      <p className="text-lg font-medium">Eine Kundin hat gesagt, sie kennt uns von Instagram?</p>
      <label className="block">
        <span className="text-base">Was hat sie gebucht? (kann leer bleiben)</span>
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="mt-1 w-full rounded-xl border border-black/20 bg-white px-4 py-3 text-lg"
          placeholder="z. B. Head Spa"
        />
      </label>
      <label className="block">
        <span className="text-base">Betrag in € (kann leer bleiben)</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-black/20 bg-white px-4 py-3 text-lg"
          placeholder="89"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="flex-1 rounded-xl bg-[#2F4A3F] px-4 py-4 text-lg font-medium text-[#F7E5C5] disabled:opacity-60"
        >
          {pending ? "Speichert …" : "Eintragen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-4 text-lg">
          Abbrechen
        </button>
      </div>
      {msg && <p className="text-red-700">{msg}</p>}
    </div>
  );
}
