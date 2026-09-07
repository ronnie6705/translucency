import type { AppData, CheckIn, State, InfluenceInstance } from "./types";
import { categoryId } from "./influences";
export function emptyData(): AppData {
  return {
    version: 2,
    profile: {
      name: "",
      onboarded: false,
      selectedRoleIds: ["observer", "explorer"],
      favourites: {
        water: ["Poor sleep", "Work stress", "Rumination"],
        drying: ["Walk", "Exercise", "Rest"],
        signals: [],
      },
      customSources: { water: [], drying: [], signals: [] },
      reminders: "off",
    },
    checkIns: [],
    roles: [],
    sessions: [],
    influences: [],
  };
}
export function seedData(base = emptyData()): AppData {
  const pattern: State[] = [
    0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0,
    1, 1, 2,
  ];
  const checkIns: CheckIn[] = pattern.map((state, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (pattern.length - i));
    d.setHours(18, 0, 0, 0);
    return {
      id: `demo-${i}`,
      timestamp: d.toISOString(),
      state,
      water: (state >= 2
        ? [
            "Poor sleep",
            "Work stress",
            ...(state === 3 ? ["Body checking"] : ["Rumination"]),
          ]
        : ["Upcoming event"]
      ).map((label) => ({ label })),
      drying: (i % 3 === 0
        ? ["Exercise", "Returning to normal routine"]
        : ["Walk", "Time with loved ones"]
      ).map((label) => ({ label })),
      signals: state >= 2 ? ["Body feels loud"] : [],
      note:
        state === 0
          ? "An ordinary day. More space for the things I wanted to do."
          : "Made room for a walk and returned to the rest of my day.",
      roleId: "observer",
      demo: true,
    };
  });
  const examples = [
    ["water", "Poor sleep", "Woke several times overnight", 6],
    ["water", "Work stress", "A deadline moved forward", 3],
    ["water", "Health uncertainty", "Got caught up in an uncertain thought", 7],
    ["drying", "Walk", "Walked outside after lunch", -3],
    ["drying", "Gym", "45 minute strength session", -6],
    ["drying", "Meditation", "Ten minutes before work", -4],
    ["drying", "Social connection", "Dinner with my partner", -3],
  ] as const;
  const influences: InfluenceInstance[] = checkIns.flatMap((c, i) =>
    examples
      .filter((e, j) =>
        e[0] === "water"
          ? c.state >= 2 || j === 1
          : j === 3 ||
            (j === 4 && i % 3 === 0) ||
            (j === 5 && i % 3 === 1) ||
            (j === 6 && i % 3 === 2),
      )
      .map(([type, label, note, impact], j) => {
        const date = new Date(c.timestamp);
        date.setHours(8 + j * 2, i % 2 ? 15 : 30);
        return {
          id: `demo-influence-${i}-${j}`,
          userId: "local",
          type,
          categoryId: categoryId(type, label),
          categoryLabel: label,
          note,
          impact:
            type === "water"
              ? Math.min(10, Math.max(1, impact + (i % 3) - 1))
              : Math.max(-10, Math.min(-1, impact - (i % 2))),
          timestamp: date.toISOString(),
          checkInId: c.id,
          demo: true,
        };
      }),
  );
  return {
    ...base,
    checkIns: [
      ...base.checkIns.filter((x) => !x.demo),
      ...checkIns.map((c) => ({ ...c, water: [], drying: [] })),
    ],
    influences: [...base.influences.filter((e) => !e.demo), ...influences],
    sessions: [
      ...base.sessions.filter((x) => !x.demo),
      ...checkIns
        .filter((_, i) => i % 4 === 0)
        .map((c, i) => ({
          id: `demo-session-${i}`,
          timestamp: c.timestamp,
          roleId: "observer",
          context: "A thought kept pulling my attention back.",
          anxiousAppraisal: "I need to resolve this now.",
          reappraisal: "I can notice this without immediately solving it.",
          carry: "Notice, then return to the day.",
          observe: false,
          helpfulness: i % 3 === 0 ? ("a_little" as const) : ("a_lot" as const),
          demo: true,
        })),
    ],
  };
}
