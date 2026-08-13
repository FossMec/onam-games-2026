/**
 * The hand-inked wobble, defined once for the whole app.
 *
 * `feTurbulence` + `feDisplacementMap` warps an element's edges so boxes look
 * drawn by hand rather than snapped to a pixel grid. It is the difference
 * between "comic panel" and "div".
 *
 * PERF: SVG filters force off-GPU rasterisation and are genuinely expensive on
 * low-end Android — exactly the phones this event runs on. So this is strictly
 * opt-in via `.inked-rough`, and must never go on scrolling lists, tables, or
 * anything on a game board. Decorative chrome only.
 *
 * Mounted once in `app.tsx`; referencing it more than once would duplicate the
 * filter ids.
 */
export function InkFilter() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Gentle: for panels and large surfaces. */}
        <filter id="ink-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Rougher: for small decorative marks where the wobble should read. */}
        <filter id="ink-wobble-strong" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="3"
            seed="3"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
