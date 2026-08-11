import type { Trait } from "@/lib/collections";

/**
 * Placeholder trait artwork.
 *
 * Every layer draws into the same 400x400 viewBox so layers stack in register.
 * These are stand-in silhouettes, not the final art — a trait's `variant`
 * picks a shape and its `colors` tint it, so a name like "Bow" may currently
 * render as a generic cap. Swap this file out when the real assets land; the
 * data model in `lib/collections.ts` does not need to change.
 *
 * No <defs>/gradients are used on purpose: a layer can be rendered many times
 * on one page (preview + every thumbnail), and duplicated element ids would
 * collide.
 */

export const ART_SIZE = 400;

const SHADOW = "#00000055";

type LayerProps = { variant: number; c0: string; c1: string };

function Background({ variant, c0, c1 }: LayerProps) {
  return (
    <g>
      <rect x="0" y="0" width="400" height="400" fill={c0} />
      {variant === 0 && (
        <>
          <circle cx="200" cy="200" r="152" fill={c1} opacity="0.32" />
          <circle cx="200" cy="200" r="104" fill={c1} opacity="0.26" />
        </>
      )}
      {variant === 1 && (
        <>
          <circle cx="200" cy="200" r="150" fill="none" stroke={c1} strokeWidth="14" opacity="0.4" />
          <circle cx="200" cy="200" r="110" fill="none" stroke={c1} strokeWidth="10" opacity="0.3" />
          <circle cx="200" cy="200" r="70" fill="none" stroke={c1} strokeWidth="6" opacity="0.22" />
        </>
      )}
      {variant === 2 && (
        <g opacity="0.3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={-120 + i * 90}
              y="-80"
              width="42"
              height="560"
              fill={c1}
              transform="rotate(20 200 200)"
            />
          ))}
        </g>
      )}
    </g>
  );
}

const HEAD = [
  { rx: 114, ry: 106 },
  { rx: 122, ry: 100 },
  { rx: 106, ry: 112 },
];

function Body({ variant, c0, c1 }: LayerProps) {
  const { rx, ry } = HEAD[variant] ?? HEAD[0];
  return (
    <g>
      <path d="M102 152 L128 54 L176 120 Z" fill={c1} />
      <path d="M298 152 L272 54 L224 120 Z" fill={c1} />
      <ellipse cx="200" cy="214" rx={rx} ry={ry} fill={c0} />
      <ellipse cx="200" cy="252" rx="48" ry="36" fill={c1} />
      <ellipse cx="184" cy="252" rx="7.5" ry="12" fill={SHADOW} />
      <ellipse cx="216" cy="252" rx="7.5" ry="12" fill={SHADOW} />
    </g>
  );
}

function Outfit({ variant, c0, c1 }: LayerProps) {
  const shoulders = "M84 400 Q84 330 200 330 Q316 330 316 400 Z";
  return (
    <g>
      {variant !== 1 && <path d={shoulders} fill={c0} />}
      {variant === 0 && (
        <>
          <path d="M120 400 Q120 344 200 344 Q280 344 280 400 Z" fill={c1} />
          <path d="M150 348 Q200 372 250 348" stroke={c1} strokeWidth="10" fill="none" />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M130 330 Q200 396 270 330" stroke={c0} strokeWidth="16" fill="none" strokeLinecap="round" />
          <circle cx="200" cy="378" r="20" fill={c1} />
        </>
      )}
      {variant === 2 && (
        <path d="M96 356 Q200 400 304 356" stroke={c1} strokeWidth="26" fill="none" strokeLinecap="round" />
      )}
      {variant === 3 && <path d="M164 332 Q200 362 236 332 Z" fill={c1} />}
      {variant === 4 && (
        <>
          <path d="M160 334 L200 372 L240 334 L240 400 L160 400 Z" fill={c1} />
          <path d="M182 350 L200 364 L218 350 L210 380 L190 380 Z" fill={c0} />
        </>
      )}
      {variant === 5 && (
        <g stroke={c1} strokeWidth="8" fill="none">
          <path d="M92 356 Q200 340 308 356" />
          <path d="M88 380 Q200 364 312 380" />
        </g>
      )}
    </g>
  );
}

function Mouth({ variant, c0, c1 }: LayerProps) {
  return (
    <g>
      {variant === 0 && (
        <path d="M170 294 Q200 318 230 294" stroke={c0} strokeWidth="8" fill="none" strokeLinecap="round" />
      )}
      {variant === 1 && (
        <>
          <path d="M166 292 Q200 328 234 292 Z" fill={c0} />
          <path d="M176 296 L224 296 L220 306 L180 306 Z" fill={c1} />
        </>
      )}
      {variant === 2 && (
        <path d="M174 302 Q204 314 232 294" stroke={c0} strokeWidth="8" fill="none" strokeLinecap="round" />
      )}
      {variant === 3 && (
        <>
          <ellipse cx="200" cy="302" rx="15" ry="19" fill={c0} />
          <ellipse cx="200" cy="308" rx="8" ry="10" fill={c1} />
        </>
      )}
    </g>
  );
}

const EYE_X = [162, 238];

function Eyes({ variant, c0, c1 }: LayerProps) {
  if (variant === 1) {
    return (
      <g stroke={c0} strokeWidth="7" fill="none" strokeLinecap="round">
        {EYE_X.map((x) => (
          <path key={x} d={`M${x - 16} 198 Q${x} 210 ${x + 16} 198`} />
        ))}
      </g>
    );
  }

  if (variant === 2) {
    return (
      <g>
        <circle cx={EYE_X[0]} cy="198" r="13" fill={c0} />
        <circle cx={EYE_X[0] - 4} cy="193" r="4.5" fill={c1} />
        <path
          d={`M${EYE_X[1] - 16} 200 Q${EYE_X[1]} 188 ${EYE_X[1] + 16} 200`}
          stroke={c0}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (variant === 3) {
    return (
      <g>
        {EYE_X.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="198" rx="15" ry="17" fill={c0} />
            <circle cx={x - 5} cy="192" r="5.5" fill={c1} />
            <circle cx={x + 5} cy="204" r="3" fill={c1} />
          </g>
        ))}
      </g>
    );
  }

  if (variant === 4) {
    return (
      <g>
        {EYE_X.map((x) => (
          <g key={x}>
            <circle cx={x} cy="198" r="13" fill={c0} />
            <rect x={x - 30} y="193" width="60" height="10" rx="5" fill={c1} opacity="0.75" />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g>
      {EYE_X.map((x) => (
        <g key={x}>
          <circle cx={x} cy="198" r="13" fill={c0} />
          <circle cx={x - 4} cy="193" r="4.5" fill={c1} />
        </g>
      ))}
    </g>
  );
}

function Headwear({ variant, c0, c1 }: LayerProps) {
  return (
    <g>
      {variant === 0 && (
        <>
          <path d="M118 122 Q200 34 282 122 Z" fill={c0} />
          <path d="M112 122 Q200 106 288 122 Q288 138 200 136 Q112 138 112 122 Z" fill={c1} />
          <path d="M282 118 Q340 122 344 142 Q300 136 278 132 Z" fill={c1} />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M126 124 L126 58 L164 92 L200 44 L236 92 L274 58 L274 124 Z" fill={c0} />
          <circle cx="200" cy="80" r="9" fill={c1} />
          <circle cx="150" cy="104" r="7" fill={c1} />
          <circle cx="250" cy="104" r="7" fill={c1} />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="M120 120 Q200 26 280 120 Z" fill={c0} />
          <rect x="112" y="112" width="176" height="26" rx="13" fill={c1} />
          <circle cx="200" cy="34" r="14" fill={c1} />
        </>
      )}
      {variant === 3 && (
        <ellipse cx="200" cy="62" rx="72" ry="20" fill="none" stroke={c0} strokeWidth="12" opacity="0.9" />
      )}
      {variant === 4 && (
        <>
          <ellipse cx="200" cy="120" rx="152" ry="26" fill={c1} />
          <path d="M138 118 Q200 30 262 118 Z" fill={c0} />
          <rect x="136" y="102" width="128" height="18" rx="9" fill={c1} />
        </>
      )}
      {variant === 5 && (
        <>
          <path d="M132 108 Q96 42 148 28 Q140 72 168 96 Z" fill={c0} />
          <path d="M268 108 Q304 42 252 28 Q260 72 232 96 Z" fill={c0} />
          <path d="M140 96 Q118 56 146 44" stroke={c1} strokeWidth="6" fill="none" />
          <path d="M260 96 Q282 56 254 44" stroke={c1} strokeWidth="6" fill="none" />
        </>
      )}
    </g>
  );
}

function Accessory({ variant, c0, c1 }: LayerProps) {
  return (
    <g>
      {variant === 0 && (
        <>
          <rect x="132" y="180" width="62" height="38" rx="12" fill={c0} />
          <rect x="206" y="180" width="62" height="38" rx="12" fill={c0} />
          <rect x="192" y="194" width="18" height="8" fill={c1} />
          <rect x="140" y="186" width="20" height="8" rx="4" fill={c1} opacity="0.6" />
        </>
      )}
      {variant === 1 && (
        <>
          <circle cx="106" cy="206" r="13" fill="none" stroke={c0} strokeWidth="7" />
          <circle cx="106" cy="224" r="6" fill={c1} />
        </>
      )}
      {variant === 2 && (
        <>
          <rect x="228" y="296" width="86" height="16" rx="8" fill={c0} />
          <rect x="300" y="296" width="16" height="16" rx="8" fill={c1} />
        </>
      )}
      {variant === 3 && (
        <g opacity="0.55">
          <ellipse cx="128" cy="244" rx="24" ry="15" fill={c0} />
          <ellipse cx="272" cy="244" rx="24" ry="15" fill={c0} />
        </g>
      )}
      {variant === 4 && (
        <>
          <circle cx="238" cy="198" r="30" fill="none" stroke={c0} strokeWidth="7" />
          <circle cx="238" cy="198" r="26" fill={c1} opacity="0.18" />
          <path d="M252 222 Q262 268 236 296" stroke={c0} strokeWidth="4" fill="none" />
        </>
      )}
    </g>
  );
}

export function TraitLayer({ trait }: { trait: Trait }) {
  const [c0, c1] = trait.colors;
  const props = { variant: trait.variant, c0, c1 };

  switch (trait.category) {
    case "background":
      return <Background {...props} />;
    case "body":
      return <Body {...props} />;
    case "outfit":
      return <Outfit {...props} />;
    case "mouth":
      return <Mouth {...props} />;
    case "eyes":
      return <Eyes {...props} />;
    case "headwear":
      return <Headwear {...props} />;
    case "accessory":
      return <Accessory {...props} />;
  }
}
