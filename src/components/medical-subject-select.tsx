"use client";

import { useState } from "react";
import { medicalSubjectGroups, medicalSubjectLabels, type MedicalSubject } from "@/lib/medicine";
import type { QuizLanguage } from "@/lib/types";

export function MedicalSubjectSelect({ value, locale, onChange }: {
  value: MedicalSubject[];
  locale: QuizLanguage;
  onChange: (subjects: MedicalSubject[]) => void;
}) {
  const [search, setSearch] = useState("");
  const labels = medicalSubjectLabels[locale];
  const allSelected = value.includes("mixed");
  const query = search.trim().toLocaleLowerCase(locale);

  function toggle(subject: MedicalSubject) {
    const selected = allSelected ? [] : value;
    const next = selected.includes(subject)
      ? selected.filter((item) => item !== subject)
      : [...selected, subject];
    onChange(next.length ? next : ["mixed"]);
  }

  return (
    <fieldset className="mt-5 min-w-0">
      <legend className="text-sm font-bold">{locale === "tr" ? "Dersler" : "Subjects"}</legend>
      <p className="mt-1 text-xs text-muted">
        {locale === "tr" ? "Birden fazla ders seçebilirsin. Seçim yapmazsan tüm dersler dahil edilir." : "Choose multiple subjects. With no specific selection, all subjects are included."}
      </p>
      <details className="mt-2 rounded-xl border border-[var(--outline)] bg-[var(--field)]">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-secondary">
          {allSelected ? labels.mixed : locale === "tr" ? `${value.length} ders seçili` : `${value.length} subjects selected`}
        </summary>
        <div className="border-t border-[var(--outline)] p-3">
          <label className="block text-xs font-bold">
            {locale === "tr" ? "Ders ara" : "Search subjects"}
            <input type="search" className="form-input mt-1" value={search}
              onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="my-3 flex min-h-10 cursor-pointer items-center gap-3 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4 accent-[#2170e4]" checked={allSelected}
              onChange={() => onChange(["mixed"])} />
            {labels.mixed}
          </label>
          <div className="max-h-72 space-y-4 overflow-y-auto overscroll-contain">
            {medicalSubjectGroups.map((group) => {
              const subjects = group.subjects.filter((subject) => labels[subject].toLocaleLowerCase(locale).includes(query));
              if (!subjects.length) return null;
              return (
                <fieldset key={group.id}>
                  <legend className="mb-1 text-xs font-bold text-secondary-deep">{group.label[locale]}</legend>
                  {subjects.map((subject) => (
                    <label key={subject} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-sm hover:bg-[var(--ghost-hover)]">
                      <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#2170e4]"
                        checked={value.includes(subject)} onChange={() => toggle(subject)} />
                      {labels[subject]}
                    </label>
                  ))}
                </fieldset>
              );
            })}
            {!medicalSubjectGroups.some((group) => group.subjects.some((subject) => labels[subject].toLocaleLowerCase(locale).includes(query))) && (
              <p className="text-sm text-muted">{locale === "tr" ? "Ders bulunamadı." : "No subjects found."}</p>
            )}
          </div>
        </div>
      </details>
      {!allSelected && <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
        {value.map((subject) => (
          <button key={subject} type="button" onClick={() => toggle(subject)}
            aria-label={locale === "tr" ? `${labels[subject]} seçimini kaldır` : `Remove ${labels[subject]}`}
            className="rounded-lg border border-secondary/30 bg-blue-500/10 px-3 py-2 text-left text-xs font-semibold text-secondary-deep">
            {labels[subject]} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>}
    </fieldset>
  );
}
