import type { Kind, Role } from "./types";
export const sources: Record<Kind, string[]> = {
  water: [
    "Health uncertainty",
    "Upcoming event",
    "Poor sleep",
    "Work stress",
    "Relationship tension",
    "Rumination",
    "Body checking",
    "Reassurance-seeking",
    "Overthinking",
    "Conflict",
    "Too much caffeine",
    "Lack of movement",
    "Travel",
    "Financial pressure",
    "Social stress",
    "Pain / illness",
    "General uncertainty",
  ],
  drying: [
    "Exercise",
    "Meditation",
    "Walk",
    "Good sleep",
    "Social connection",
    "Time with loved ones",
    "Gaming",
    "Creative work",
    "Being outdoors",
    "Stretching",
    "Breathing",
    "Journaling",
    "Accepting uncertainty",
    "Completing a feared task",
    "Returning to normal routine",
    "Rest",
    "Music",
    "Therapy",
    "Talking to someone",
  ],
  signals: [
    "Jaw tension",
    "Shoulder tension",
    "Abdominal tightness",
    "Ear pressure",
    "Racing heart",
    "Restlessness",
    "Head pressure",
    "Racing thoughts",
    "Body scanning",
    "Muscle tension",
    "Fatigue",
    "Body feels loud",
    "Difficulty settling",
    "Intrusive health thoughts",
  ],
};
export const defaultRoles: Role[] = [
  {
    id: "boxer",
    name: "The Boxer",
    icon: "◈",
    tone: "peach",
    description: "Make room for recovery. Let care be the work.",
    borrowedQuality: "Patient strength",
    bestFor: [
      "Physical discomfort",
      "Recovery",
      "Fear of pain",
      "Difficult procedures",
    ],
    corePhrase: "The hard part is over. Recovery is the job now.",
    reappraisal:
      "I can meet discomfort with care rather than treating it as a verdict on my strength. Recovery can include rest, support, patience, and following my treatment plan and medication as directed.",
  },
  {
    id: "soldier",
    name: "The Soldier",
    icon: "⌁",
    tone: "sage",
    description: "Stay steady when the situation is outside your control.",
    borrowedQuality: "Steadiness in uncertainty",
    bestFor: [
      "Loss of control",
      "Turbulence",
      "Waiting",
      "Environmental discomfort",
    ],
    corePhrase:
      "I do not need to control every bump. I can stay with the moment.",
    reappraisal:
      "Uncertainty is uncomfortable. I can acknowledge what is outside my control and choose one useful action that is within it. I do not need to resolve every possibility to stay with this moment.",
  },
  {
    id: "observer",
    name: "The Observer",
    icon: "◎",
    tone: "violet",
    description: "A little space between a thought and your response.",
    borrowedQuality: "Curiosity without urgency",
    bestFor: [
      "Intrusive thoughts",
      "Body scanning",
      "Rumination",
      "Anxious sensations",
    ],
    corePhrase: "I can notice this without immediately solving it.",
    reappraisal:
      "Something feels noticeable. This may be amplified by my current state or attention. I can notice the thought without immediately deciding what it means, and gently return my attention to what I was doing.",
  },
  {
    id: "explorer",
    name: "The Explorer",
    icon: "✳",
    tone: "blue",
    description: "Meet the unfamiliar with a little more curiosity.",
    borrowedQuality: "Openness to the unknown",
    bestFor: [
      "Unfamiliar situations",
      "Change",
      "Uncertainty",
      "New experiences",
    ],
    corePhrase: "Unknown does not automatically mean dangerous.",
    reappraisal:
      "My mind is filling in what I do not know. I can leave room for more than one outcome and take a small, considered step into this unfamiliar situation.",
  },
  {
    id: "future",
    name: "Future Me",
    icon: "↗",
    tone: "peach",
    description: "See this moment from a little further down the road.",
    borrowedQuality: "A wider view",
    bestFor: ["Catastrophising", "Overwhelm", "Long recovery", "Rumination"],
    corePhrase: "This will eventually become something that happened.",
    reappraisal:
      "This moment feels large from where I am standing. A wider view may make room for other parts of my life. I can choose what would help me move through today without solving the whole future.",
  },
  {
    id: "athlete",
    name: "The Athlete in Recovery",
    icon: "◡",
    tone: "sage",
    description: "Give rest the same respect you give effort.",
    borrowedQuality: "Trust in the value of rest",
    bestFor: ["Fatigue", "Soreness", "Healing", "Rest guilt"],
    corePhrase: "Recovery is active work, not weakness.",
    reappraisal:
      "I do not have to earn rest by pushing harder. I can respect my limits, follow appropriate care, and let recovery take the time it needs.",
  },
];
export function suggestRole(water: string[], preferred: string[]) {
  if (water.some((x) => /Pain/.test(x))) return "boxer";
  if (water.some((x) => /Travel|uncertainty/.test(x))) return "soldier";
  if (water.some((x) => /Rumination|checking|Overthinking/.test(x)))
    return "observer";
  return preferred[0] || "observer";
}
