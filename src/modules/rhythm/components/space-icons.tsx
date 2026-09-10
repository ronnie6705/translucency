import type { CSSProperties } from "react";
export const spaceIcons = [
  ["general", "General"],
  ["home", "Home"],
  ["work", "Work"],
  ["study", "Study"],
  ["personal", "Personal"],
  ["fitness", "Fitness"],
  ["shopping", "Shopping"],
  ["finance", "Finance"],
  ["travel", "Travel"],
  ["projects", "Projects"],
] as const;
export const spaceColors = [
  "#ffffff",
  "#b4a4ff",
  "#81b8ff",
  "#69d6cf",
  "#92d491",
  "#f1cf79",
  "#eea176",
  "#ed93b8",
];
const files: Record<string, string> = {
  home: "add-imgHome3",
  work: "add-imgBriefcase",
};
export function SpaceIcon({
  icon,
  color = "#ffffff",
}: {
  icon: string;
  color?: string;
}) {
  const safe = spaceIcons.some(([id]) => id === icon) ? icon : "general";
  return (
    <span
      className="space-icon"
      aria-hidden="true"
      style={{
        backgroundColor: color,
        maskImage: `url(/rhythm/tasks/${files[safe] ?? safe}.svg)`,
        WebkitMaskImage: `url(/rhythm/tasks/${files[safe] ?? safe}.svg)`,
      }}
    />
  );
}
export function TaskAsset({
  name,
  style,
}: {
  name: string;
  style?: CSSProperties;
}) {
  return (
    <img
      className="task-asset"
      src={`/rhythm/tasks/${name}.svg`}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      style={style}
    />
  );
}
