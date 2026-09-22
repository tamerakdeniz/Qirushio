import "server-only";
import type { MedicalYear, RoomSettings } from "@/lib/types";

// Game progression, not a claim that every Turkish faculty teaches topics in
// exactly the same year. See the source links in README.md.
const yearTopics: Record<MedicalYear, string> = {
  1: "cell biology, organelles, basic genetics, biomolecules, introductory biochemistry and biophysics, anatomical terminology, basic tissues, history of medicine and introductory ethics; no clinical diagnosis or treatment questions",
  2: "normal organ-system anatomy, physiology, histology and embryology, metabolic pathways and introductory microbiology; focus on normal structure/function, not clinical management",
  3: "general and organ-system pathology, pathophysiology, medical microbiology, immunology, basic pharmacology mechanisms, introductory semiology and epidemiology; link mechanisms to simple findings, not advanced specialty decisions",
  4: "core clinical clerkships: internal medicine, pediatrics, general surgery, obstetrics and gynecology; common presentations, differential reasoning and interpreting supplied basic investigations",
  5: "specialty clerkship reasoning: neurology, psychiatry, dermatology, ENT, ophthalmology, orthopedics, urology, radiology and anesthesia concepts; concise original fictional cases and cross-specialty connections",
  6: "internship-level integration, prioritization in fictional cases, patient safety, handover, teamwork, public health, primary care and communication; revisit foundational mechanisms through practical reasoning",
};

export function medicineQuestionContext(settings: RoomSettings): string | null {
  if (settings.mode !== "classic" || settings.category !== "medicine") return null;
  const year = settings.medicalYear;
  const included = Array.from({ length: year }, (_, index) => index + 1) as MedicalYear[];
  return [
    "Category: Medicine. Audience: medical students studying in Turkey, in a friendly multiplayer quiz.",
    `Selected medical year: ${year}. Eligible curriculum years: ${included.join(", ")}. This is a cumulative ceiling, not a generic easy/medium/hard setting.`,
    "Only the following curriculum blocks are allowed:",
    ...included.map((value) => `Year ${value}: ${yearTopics[value]}.`),
    year === 1 ? "Every question must be curriculumYear 1." : "Mix selected-year topics with earlier eligible years. Include the selected year in every batch and put a selected-year question first. Do not let earlier-year trivia dominate. A short round need not contain every eligible year.",
    "For each question include curriculumYear: an integer indicating the earliest eligible year whose knowledge is actually needed. Never label an advanced question as a lower year to pass the ceiling.",
    "Turkey context is fixed even when output language is English. Use familiar Turkish medical-school terms such as komite, staj and intörnlük only where useful; avoid university-specific exam customs or pretending this is a uniform official year-by-year curriculum.",
    "Make the game lively with short mechanism puzzles, lab clues, anatomy connections and (only at eligible clinical years) fictional mini-cases. Mix disciplines and formats. Use plausible distractors and a concise explanation with a memorable learning hook. Do not joke at patients' expense or invent facts for humor.",
    "Use established textbook concepts. Do not copy TUS or faculty exam questions. Avoid disputed facts, changing guidelines, drug dosing, exact treatment protocols, or real-person diagnosis. Supply any reference ranges needed for an answer; exactly one option must be defensibly correct.",
    "Broad educational anchors: Turkey's UÇEP-2020 covers undergraduate medical competencies; Turkish programs broadly progress from preclinical education in years 1–3 through clerkships in years 4–5 to internship in year 6. The topic blocks above define this game's progression, not official equivalence.",
  ].join("\n");
}
