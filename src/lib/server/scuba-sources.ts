import "server-only";

import type { RoomSettings } from "@/lib/types";

export function scubaQuestionContext(settings: RoomSettings): string | null {
  if (settings.mode !== "classic" || settings.category !== "scuba") {
    return null;
  }

  const scopeInstruction =
    settings.scope === "local"
      ? "Local context: when useful, use Turkey, the Mediterranean, the Aegean, local dive-center practice, visibility, currents, thermoclines, boat procedures, and marine-conservation examples. Do not invent local laws or agency standards."
      : "Global context: use broadly accepted recreational scuba theory, safety, equipment, dive-planning, marine-awareness, and instructor-training concepts.";

  return [
    "Category: Scuba Diving.",
    scopeInstruction,
    "Purpose: generate original interactive quiz questions for scuba theory, general diving culture, and instructor-candidate style review. These questions are educational only and are not dive-planning, certification, medical, or emergency-response advice.",
    "Do not copy real PADI IDC, SSI ITC, Instructor Examination, or other agency exam questions. Create fresh ITC/IDC-style questions that test the same kinds of understanding: standards awareness, safe judgment, teaching control, briefing/debriefing, student management, and problem recognition.",
    "Source-grounded anchors to use as background:",
    "- PADI IDC path: the Instructor Development Course includes Assistant Instructor and Open Water Scuba Instructor parts; most candidates then attend an Instructor Examination. Public PADI prerequisites include being a certified diver for six months, Divemaster-level entry, 60 logged dives for IDC, 100 dives for IE, recent CPR/First Aid training, and a recent physician-signed medical statement.",
    "- SSI ITC path: public SSI material describes ITC entry for Divemaster or equivalent professionals, followed by Instructor Evaluation as part of a two-step path toward SSI Open Water Instructor. Published ITC facts include academic, pool/confined-water, open-water, and teaching-skill components.",
    "- Core physics: pressure increases with depth; gas volume changes inversely with absolute pressure; partial pressure rises with depth; inert gas absorption/release matters for no-decompression planning and surface intervals; buoyancy follows displaced-water principles.",
    "- Core physiology and risk topics: equalization, ear/sinus squeeze, lung overexpansion risk from breath-holding during ascent, decompression sickness, nitrogen narcosis, oxygen toxicity concepts, hypothermia, fatigue, stress, carbon dioxide retention, marine-life injuries, and the need to end a dive when symptoms or unsafe conditions appear.",
    "- Nitrogen narcosis: symptoms can include intoxicated feeling, impaired judgment, difficulty concentrating, drowsiness, overconfidence/euphoria, fear, or insecurity; risk rises with depth and may improve after ascending to a shallower depth.",
    "- Equipment and procedures: regulator first/second stages, alternate air source, BCD, cylinder, SPG/pressure gauge, dive computer, exposure protection, weights, mask, fins, predive checks, buddy checks, gas management, safety stops, ascent-rate awareness, hand signals, separation procedures, and emergency planning.",
    "- Environmental practice: maintain neutral buoyancy, avoid touching/taking/harassing marine life, control fin kicks near reefs or sediment, respect protected areas, and adjust plans for current, surge, visibility, temperature, boat traffic, and weather.",
    "Difficulty calibration:",
    "- Easy: direct terminology, equipment roles, basic safety principles, hand signals, and general culture.",
    "- Medium: short scenarios requiring safe choices, physics applied to common dive situations, and instructor/student-management judgment.",
    "- Hard: combine dive theory, risk management, and instructor-candidate standards awareness; avoid calculations that require agency tables not supplied in the prompt.",
    "Keep explanations concise and phrase them as learning feedback, not as operational dive instructions.",
  ].join("\n");
}
