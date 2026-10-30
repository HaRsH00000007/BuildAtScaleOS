"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx } from "@/components/ui";
import type { ActionState } from "@/lib/actions";
import { computeFinancials, formatINR, parseAmount } from "@/lib/finance";
import { createClientInline, createProject, type InlineClientState } from "./actions";
import { Dialog } from "./workspace-forms";

// Harmony's "Add New Project" wizard (screenshots, 2026-10-29): Basic Details → Project Value → Department & Members,
// with Back / Next Step and a live Summary on the right of steps 2 and 3. One form posts every step at the end; hidden
// steps stay in the DOM so their fields are submitted. Templates, scopes and department hours are not part of
// BuildAtScaleOS, so step 3 picks members by department and says what is missing.

type Option = { id: string; name: string };
type Person = Option & { departmentId: string | null; designation: string | null };

const STEPS = ["Basic Details", "Project Value", "Department & Members"] as const;
const FIELD_STEP: Record<string, number> = { name: 0, clientId: 0, billingType: 0, startDate: 1, endDate: 1, value: 1, otherIncome: 1, directExpenses: 1 };
const TYPES = [
  { value: "RETAINER", label: "Retainer", hint: "Billed every month. The project value is the monthly fee." },
  { value: "PROJECT", label: "Project", hint: "One fixed contract. The project value is the total fee." },
  { value: "PAY_AS_YOU_GO", label: "Pay as you go", hint: "Billed on hours worked. Enter the expected value." },
];

export function ProjectWizard({
  clients: initialClients,
  people,
  departments,
  canAddClient,
  currentUserId,
  today,
  cancelHref,
}: {
  clients: Option[];
  people: Person[];
  departments: Option[];
  canAddClient: boolean;
  currentUserId: string;
  today: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createProject, {});
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState(initialClients);
  const [addingClient, setAddingClient] = useState(false);
  const [v, setV] = useState({
    name: "",
    clientId: "",
    billingType: "",
    isBillable: true,
    isPublic: false,
    startDate: today,
    endDate: "",
    value: "",
    otherIncome: "",
    directExpenses: "",
  });
  const [managerIds, setManagerIds] = useState<string[]>([currentUserId]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  // Server-side errors: show them and go back to the first step that has one.
  useEffect(() => {
    const fe = state.fieldErrors ?? {};
    const keys = Object.keys(fe).filter((k) => fe[k]?.[0]);
    if (keys.length === 0) return;
    setErrors(Object.fromEntries(keys.map((k) => [k, fe[k]![0]!])));
    setStep(Math.min(...keys.map((k) => FIELD_STEP[k] ?? 0)));
  }, [state]);

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (v.name.trim().length < 2) e.name = "Project name is required";
      if (!v.clientId) e.clientId = "Select a client";
      if (!v.billingType) e.billingType = "Select a project type";
    }
    if (s === 1) {
      if (!v.startDate) e.startDate = "Enter the project start date";
      if (!v.endDate) e.endDate = "Enter the project end date";
      else if (v.startDate && v.endDate < v.startDate) e.endDate = "End date must be on or after the start date";
      if (v.value.trim() === "") e.value = "Enter the project value";
      for (const k of ["value", "otherIncome", "directExpenses"] as const) if (Number.isNaN(parseAmount(v[k]))) e[k] = "Enter an amount in rupees, e.g. 80000";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const money = (s: string) => (Number.isNaN(parseAmount(s)) ? 0 : parseAmount(s));
  const f = computeFinancials({ value: money(v.value), otherIncome: money(v.otherIncome), directExpenses: money(v.directExpenses), adhocExpenses: 0 });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6">
        <form action={formAction} noValidate className="flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between px-6 pt-6 pb-2 sm:px-8">
            <h1 className="text-2xl font-bold text-ink">Add New Project</h1>
            <Link href={cancelHref} aria-label="Close" className="text-3xl leading-none text-slate-500 hover:text-ink">
              ×
            </Link>
          </div>
          <Stepper step={step} />

          <div className="flex-1 bg-cream px-4 py-6 sm:px-8">
            {state.error && !Object.keys(state.fieldErrors ?? {}).length && (
              <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {state.error}
              </div>
            )}

            {/* Step 1: Basic Details */}
            <div className={cx(step !== 0 && "hidden")}>
              <Panel title="Add Project Details" subtitle="Choose a client, specify the project type, and designate a manager for your new project.">
                <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  <WField label="Project Name" required error={errors.name} htmlFor="name">
                    <input id="name" name="name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Start Typing" className="input h-12" />
                  </WField>
                  <WField
                    label="Select Client"
                    required
                    error={errors.clientId}
                    htmlFor="clientId"
                    aside={
                      canAddClient && (
                        <button type="button" onClick={() => setAddingClient(true)} className="text-sm font-bold text-brand-700 hover:underline">
                          +Add Client
                        </button>
                      )
                    }
                  >
                    <select id="clientId" name="clientId" value={v.clientId} onChange={(e) => set("clientId", e.target.value)} className="input h-12">
                      <option value="">Select</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </WField>
                  <WField label="Select Project Type" required error={errors.billingType} htmlFor="billingType" hint={TYPES.find((t) => t.value === v.billingType)?.hint}>
                    <select id="billingType" name="billingType" value={v.billingType} onChange={(e) => set("billingType", e.target.value)} className="input h-12">
                      <option value="">Select</option>
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </WField>
                  <WField label="Select Project Managers" htmlFor="managers" hint="You stay a manager so you can keep editing the project.">
                    <MultiSelect id="managers" options={people} selected={managerIds} onChange={setManagerIds} placeholder="Select a manager" lockedId={currentUserId} />
                  </WField>
                  <Toggle label="Billable" name="isBillable" checked={v.isBillable} onChange={(c) => set("isBillable", c)} />
                  <Toggle label="Public Project" name="isPublic" checked={v.isPublic} onChange={(c) => set("isPublic", c)} hint="Everyone who signs in can open it, not only its members." />
                </div>
                {managerIds.map((id) => (
                  <input key={id} type="hidden" name="managerIds" value={id} />
                ))}
              </Panel>
            </div>

            {/* Step 2: Project Value */}
            <div className={cx("grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]", step !== 1 && "hidden")}>
              <Panel title="Add Project Value" subtitle="Specify the project value">
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <WField label="Project Start Date" required error={errors.startDate} htmlFor="startDate">
                    <input id="startDate" name="startDate" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} className="input h-12" />
                  </WField>
                  <WField label="Project End Date" required error={errors.endDate} htmlFor="endDate">
                    <input id="endDate" name="endDate" type="date" min={v.startDate} value={v.endDate} onChange={(e) => set("endDate", e.target.value)} className="input h-12" />
                  </WField>
                </div>
                <div className="mt-5 space-y-5">
                  <Money id="value" label="Project Value" required info={v.billingType === "RETAINER" ? "The monthly retainer fee." : "The total fee agreed with the client."} value={v.value} onChange={(s) => set("value", s)} error={errors.value} />
                  <Money id="otherIncome" label="Additional Income" info="Income on top of the project value, such as a one-off setup fee." value={v.otherIncome} onChange={(s) => set("otherIncome", s)} error={errors.otherIncome} />
                  <Money id="directExpenses" label="Direct Expenses (if any)" info="Costs you pay out for this project, such as ad spend or tools." value={v.directExpenses} onChange={(s) => set("directExpenses", s)} error={errors.directExpenses} />
                </div>
              </Panel>
              <Summary>
                <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 font-bold text-ink">
                  <span>▾ Total Project Value:</span>
                  <span className="font-display text-lg">{formatINR(f.totalValue)}</span>
                </div>
                <dl className="mt-3 space-y-2 text-sm text-slate-500">
                  <SumRow label="Project Value:" value={formatINR(f.value)} />
                  <SumRow label="Other Income:" value={formatINR(f.otherIncome)} />
                  <SumRow label="Additional Cost:" value={formatINR(f.directExpenses)} />
                </dl>
              </Summary>
            </div>

            {/* Step 3: Department & Members */}
            <div className={cx("grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]", step !== 2 && "hidden")}>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Notice title="Templates">Project templates (departments, hours and default people) aren&apos;t in BuildAtScaleOS yet.</Notice>
                  <Notice title="Scopes">Scopes and department hours aren&apos;t in BuildAtScaleOS yet, so allocated cost can&apos;t be worked out.</Notice>
                </div>
                <DepartmentPicker departments={departments} people={people} managerIds={managerIds} memberIds={memberIds} onChange={setMemberIds} />
                {memberIds
                  .filter((id) => !managerIds.includes(id))
                  .map((id) => (
                    <input key={id} type="hidden" name="memberIds" value={id} />
                  ))}
              </div>
              <Summary>
                <dl className="space-y-2.5 text-sm text-slate-600">
                  <SumRow label="Project Value:" value={formatINR(f.value)} />
                  <SumRow label="+ Other Income:" value={formatINR(f.otherIncome)} />
                  <SumRow label="− Direct Expenses:" value={formatINR(f.directExpenses)} />
                  <SumRow label="− Billable Allocated Cost:" value="Not tracked" />
                  <div className="flex justify-between gap-3 pt-1 font-bold text-brand-700">
                    <dt>= Estimated Profit % :</dt>
                    <dd>
                      {formatINR(f.estimatedProfit)} ({f.estimatedProfitPct == null ? "—" : `${f.estimatedProfitPct.toFixed(1)}%`})
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">Before labour cost. Profit % is of the total project value.</p>
              </Summary>
            </div>

            <input type="hidden" name="isBillable" value={String(v.isBillable)} />
            <input type="hidden" name="isPublic" value={String(v.isPublic)} />
          </div>

          <div className="flex justify-end gap-3 border-t border-cream-200 bg-white px-6 py-4 sm:px-8">
            {step === 0 ? (
              <Link href={cancelHref} className={buttonClass("secondary")}>
                Cancel
              </Link>
            ) : (
              <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("secondary")}>
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => validate(step) && setStep(step + 1)} className={buttonClass("primary")}>
                Next Step
              </button>
            ) : (
              <FinalSubmit />
            )}
          </div>
        </form>
      </div>

      {addingClient && (
        <AddClientDialog
          onClose={() => setAddingClient(false)}
          onSaved={(c) => {
            setClients((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
            set("clientId", c.id);
            setAddingClient(false);
          }}
        />
      )}
    </>
  );
}

function FinalSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Creating…" : "Submit"}
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto px-6 py-5 sm:px-16">
      {STEPS.map((label, i) => (
        <li key={label} className={cx("flex items-center gap-2", i < STEPS.length - 1 && "flex-1")}>
          <span
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm",
              i < step ? "border-emerald-500 bg-emerald-500 text-white" : i === step ? "border-brand-600 bg-white" : "border-slate-300 bg-white",
            )}
            aria-current={i === step ? "step" : undefined}
          >
            {i < step ? "✓" : <span className={cx("h-3 w-3 rounded-full", i === step ? "bg-brand-600" : "bg-slate-300")} />}
          </span>
          <span className={cx("text-sm whitespace-nowrap", i <= step ? "font-bold text-ink" : "text-slate-400")}>{label}</span>
          {i < STEPS.length - 1 && <span className={cx("h-0.5 min-w-6 flex-1", i < step ? "bg-brand-600" : "bg-slate-200")} />}
        </li>
      ))}
    </ol>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 sm:p-8">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mb-6 text-slate-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Summary({ children }: { children: ReactNode }) {
  return (
    <aside className="h-fit rounded-2xl bg-white p-6 lg:sticky lg:top-0">
      <h2 className="mb-4 text-lg font-bold text-ink">Summary</h2>
      {children}
    </aside>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-ink">{title}</span>
        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] text-slate-600">Not available</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{children}</p>
    </div>
  );
}

function WField({ label, required, error, htmlFor, hint, aside, children }: { label: string; required?: boolean; error?: string; htmlFor: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm text-ink">
        {label}
        {required && "*"}
      </label>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {aside}
      </div>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Money({ id, label, required, info, value, onChange, error }: { id: string; label: string; required?: boolean; info: string; value: string; onChange: (s: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center gap-1.5 text-sm text-ink">
        {label}
        {required && "*"}
        <span title={info} aria-label={info} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-400 text-[10px] text-slate-500">
          i
        </span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-600">₹</span>
        <input id={id} name={id} inputMode="decimal" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} className="input h-12 pl-8" />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function Toggle({ label, name, checked, onChange, hint }: { label: string; name: string; checked: boolean; onChange: (c: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <span id={`${name}-label`} className="text-ink">
          {label}
        </span>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${name}-label`}
        onClick={() => onChange(!checked)}
        className={cx("relative h-9 w-16 shrink-0 rounded-full transition", checked ? "bg-brand-300" : "bg-slate-200")}
      >
        <span className={cx("absolute top-1 h-7 w-7 rounded-full shadow transition-all", checked ? "left-8 bg-brand-700" : "left-1 bg-white")} />
      </button>
    </div>
  );
}

/** Dropdown with checkboxes; the chosen people show as chips. `lockedId` (the creator) cannot be removed. */
function MultiSelect({ id, options, selected, onChange, placeholder, lockedId }: { id: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void; placeholder: string; lockedId?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const names = options.filter((o) => selected.includes(o.id));
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="input flex min-h-12 items-center justify-between gap-2 text-left">
        <span className="flex flex-wrap gap-1">
          {names.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            names.map((n) => (
              <span key={n.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                {n.name}
              </span>
            ))
          )}
        </span>
        <span className="text-slate-500">⌄</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-cream-200 bg-white p-2 shadow-lg">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="input mb-2" autoFocus />
          <ul className="max-h-56 overflow-y-auto text-sm">
            {shown.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={o.id === lockedId}
                      onChange={() => onChange(checked ? selected.filter((s) => s !== o.id) : [...selected, o.id])}
                    />
                    {o.name}
                    {o.id === lockedId && <span className="text-xs text-slate-400">(you)</span>}
                  </label>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-1.5 text-slate-500">No one matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Harmony's department list: each department expands to its people; ticked people join as members. */
function DepartmentPicker({ departments, people, managerIds, memberIds, onChange }: { departments: Option[]; people: Person[]; managerIds: string[]; memberIds: string[]; onChange: (ids: string[]) => void }) {
  const groups = [
    ...departments.map((d) => ({ id: d.id, name: d.name, people: people.filter((p) => p.departmentId === d.id) })),
    { id: "none", name: "No department", people: people.filter((p) => !p.departmentId) },
  ].filter((g) => g.people.length > 0);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.id));
  const toggle = (id: string) => onChange(memberIds.includes(id) ? memberIds.filter((m) => m !== id) : [...memberIds, id]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">Pick the people who work on this project. Managers are already included.</span>
        <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.id)))} className="text-sm font-bold text-brand-700 hover:underline">
          {allOpen ? "Collapse All" : "Expand All"}
        </button>
      </div>
      {groups.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No active people yet. Add people from Admin › People.</p>}
      {groups.map((g) => {
        const picked = g.people.filter((p) => memberIds.includes(p.id) || managerIds.includes(p.id)).length;
        const isOpen = open.has(g.id);
        return (
          <div key={g.id} className="rounded-2xl border border-cream-200 bg-white">
            <button
              type="button"
              onClick={() => setOpen((s) => (s.has(g.id) ? new Set([...s].filter((x) => x !== g.id)) : new Set([...s, g.id])))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <span className={cx("text-slate-500 transition", isOpen && "rotate-180")}>⌄</span>
              <span className="flex-1 text-lg text-ink">{g.name}</span>
              <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", picked ? "bg-brand-50 text-brand-700" : "bg-cream-200 text-slate-500")}>
                {picked} / {g.people.length} picked
              </span>
            </button>
            {isOpen && (
              <ul className="grid gap-1 border-t border-cream-200 px-5 py-3 text-sm sm:grid-cols-2">
                {g.people.map((p) => {
                  const isManager = managerIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream">
                        <input type="checkbox" checked={isManager || memberIds.includes(p.id)} disabled={isManager} onChange={() => toggle(p.id)} />
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                          {p.designation && <span className="text-slate-400"> · {p.designation}</span>}
                        </span>
                        {isManager && <span className="text-xs font-bold text-brand-700">Manager</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Harmony's inline Add Client dialog: saves the client and selects it in the wizard. */
function AddClientDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Option) => void }) {
  const [state, formAction] = useActionState<InlineClientState, FormData>(createClientInline, {});
  useEffect(() => {
    if (state.client) onSaved(state.client);
  }, [state.client, onSaved]);
  const err = state.fieldErrors ?? {};
  return (
    <Dialog
      onClose={onClose}
      width="max-w-xl"
      title={
        <span className="flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Back to the project" className="text-slate-500 hover:text-ink">
            ←
          </button>
          Add Client
        </span>
      }
    >
      <form action={formAction} className="space-y-4">
        {state.error && !Object.keys(err).length && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </div>
        )}
        <WField label="Client Name" required htmlFor="client-name" error={err.name?.[0]}>
          <input id="client-name" name="name" placeholder="Enter client..." className="input h-12" required autoFocus />
        </WField>
        <WField label="Description" htmlFor="client-notes" error={err.notes?.[0]}>
          <input id="client-notes" name="notes" placeholder="Add" className="input h-12" />
        </WField>
        <WField label="Client Email" htmlFor="client-email" error={err.email?.[0]}>
          <input id="client-email" name="email" type="email" placeholder="Email" className="input h-12" />
        </WField>
        <WField label="Phone Number" htmlFor="client-phone" error={err.phone?.[0]}>
          <input id="client-phone" name="phone" placeholder="Start Typing" className="input h-12" />
        </WField>
        <SaveClient />
      </form>
    </Dialog>
  );
}

function SaveClient() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(buttonClass("primary"), "w-full py-3")}>
      {pending ? "Saving…" : "Save and Continue to Add Project"}
    </button>
  );
}
