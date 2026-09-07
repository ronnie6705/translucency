import { useEffect, useRef, useState, type CSSProperties } from "react";
import { stateLabels, type State } from "@/lib/types";
import { responseMagnitude, signedImpact } from "@/lib/influences";
import type { MaterialResponse } from "./influences";
export function Material({
  state = 1,
  mini = false,
  response,
}: {
  state?: State;
  mini?: boolean;
  response?: MaterialResponse;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const [tint, setTint] = useState(0);
  const [active, setActive] = useState<{
    response: MaterialResponse;
    x: number;
    y: number;
    dx: number;
    dy: number;
    reduced: boolean;
  }>();
  useEffect(() => setTint(0), [state]);
  useEffect(() => {
    if (!response || mini) return;
    const element = scene.current;
    if (!element || !element.getBoundingClientRect().height) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = element.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight)
      element.scrollIntoView({ block: "center", behavior: "instant" });
    const frame = requestAnimationFrame(() => {
      const slab = element
        .querySelector(".material-slab")!
        .getBoundingClientRect();
      const source = document
        .querySelector(`[data-influence-source="${response.instance.type}"]`)
        ?.getBoundingClientRect();
      const x = slab.left + slab.width * 0.66,
        y = slab.top + slab.height * 0.45;
      const origin = source
        ? {
            x: source.left + source.width * 0.3,
            y: source.top + source.height * 0.45,
          }
        : response.origin || { x: x + 80, y: y + 30 };
      setActive({
        response,
        x,
        y,
        dx: Math.max(20, Math.min(innerWidth - 20, origin.x)) - x,
        dy: Math.max(25, Math.min(innerHeight - 65, origin.y)) - y,
        reduced,
      });
      const amplitude = responseMagnitude(response.instance.impact!);
      setTint((response.instance.type === "water" ? 1 : -1) * amplitude * 0.09);
    });
    const timer = setTimeout(() => setActive(undefined), 3200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [response, mini]);
  return (
    <div
      ref={scene}
      className={`material-scene ${mini ? "mini" : ""} ${active ? `responding-${active.response.instance.type}` : ""}`}
      data-response={active?.response.instance.type}
      role="img"
      aria-label={`${stateLabels[state]} material, intact`}
      style={
        {
          "--level": state,
          "--density": Math.max(
            0.2,
            Math.min(0.99, 0.97 - state * 0.23 - tint),
          ),
          "--diffusion": `${20 - state * 4}px`,
          "--moisture": Math.max(
            0.01,
            Math.min(0.8, 0.04 + state * 0.23 + tint),
          ),
          "--event-power": active
            ? responseMagnitude(active.response.instance.impact!)
            : 0,
        } as CSSProperties
      }
    >
      <div className="light-orb orb-one" />
      <div className="light-orb orb-two" />
      <div className="material-slab">
        <div className="material-fibres" />
        <div className="material-moisture" />
        <div className="material-sheen" />
        {active && (
          <div
            key={active.response.token}
            className={
              active.response.instance.type === "water"
                ? "material-absorption"
                : "material-clearing"
            }
            aria-hidden="true"
          />
        )}
      </div>
      {active && (
        <>
          <span
            key={active.response.token}
            className={`material-value ${active.reduced ? "motion-reduced" : ""}`}
            role="status"
          >
            {signedImpact(active.response.instance.impact)}{" "}
            {active.response.instance.type}
            <small>Moment saved · felt state unchanged</small>
          </span>
          {active.response.instance.type === "water" && !active.reduced && (
            <span
              key={`${active.response.token}-travel`}
              className="travelling-moisture"
              aria-hidden="true"
              style={
                {
                  left: active.x,
                  top: active.y,
                  "--travel-x": `${active.dx}px`,
                  "--travel-y": `${active.dy}px`,
                  "--event-power": responseMagnitude(
                    active.response.instance.impact!,
                  ),
                } as CSSProperties
              }
            />
          )}
        </>
      )}
      {!mini && (
        <>
          <span className="material-caption">
            {state === 0
              ? "A little more grounded."
              : "A little light gets through."}
          </span>
          <span className="material-mark">STILL WHOLE. ALWAYS.</span>
        </>
      )}
    </div>
  );
}
