import { ArrowUpRight, Check, Plus } from "lucide-react";
import type { ReactNode } from "react";
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Chips({
  items,
  selected,
  onChange,
  max,
}: {
  items: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <div className="chips">
      {items.map((item) => (
        <button
          type="button"
          className={`chip ${selected.includes(item) ? "selected" : ""}`}
          aria-pressed={selected.includes(item)}
          key={item}
          disabled={!selected.includes(item) && !!max && selected.length >= max}
          onClick={() =>
            onChange(
              selected.includes(item)
                ? selected.filter((x) => x !== item)
                : [...selected, item],
            )
          }
        >
          {selected.includes(item) ? <Check size={13} /> : <Plus size={13} />}{" "}
          {item}
        </button>
      ))}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
