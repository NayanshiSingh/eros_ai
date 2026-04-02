"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ActivityData,
  DayActivity,
  DiaryEntry,
  DiaryList,
  LockedDiaryPreview,
  PersonalityHistorySnapshot,
  PersonalityProfile,
} from "@/lib/api";

type DashboardExperienceProps = {
  personality: PersonalityProfile | null;
  activity: ActivityData | null;
};

type DiaryExperienceProps = {
  diary: DiaryList | null;
  entries: DiaryEntry[];
  hasMore: boolean;
  isLoadingMore: boolean;
  isBuyingPage: boolean;
  onLoadMore: () => void;
  onBuyPage: () => void;
};

type TraitGroupKey = "cognitive" | "motivational" | "emotional" | "interpersonal";

type TraitBubble = {
  name: string;
  weight: number;
  delta: number;
};

type ProfilePoint = {
  key: string;
  version: number;
  label: string;
  timestamp: string | null;
  jungianType: string | null;
  weights: Record<string, number>;
  topArchetype: { name?: string; weight?: number } | null;
  isCurrent: boolean;
};

type AxisDefinition = {
  key: string;
  left: string;
  right: string;
  copy: {
    left: string;
    right: string;
  };
};

type TraitGroupDefinition = {
  key: TraitGroupKey;
  label: string;
  tone: string;
  traits: string[];
};

const AXES: AxisDefinition[] = [
  {
    key: "introversion-extraversion",
    left: "introversion",
    right: "extraversion",
    copy: {
      left: "You do your best thinking away from the noise.",
      right: "Energy sharpens when ideas have somewhere to land.",
    },
  },
  {
    key: "sensing-intuition",
    left: "sensing",
    right: "intuition",
    copy: {
      left: "Concrete details anchor the read before abstraction does.",
      right: "You see patterns before you see details.",
    },
  },
  {
    key: "feeling-thinking",
    left: "feeling",
    right: "thinking",
    copy: {
      left: "Emotion enters the frame before analysis settles it.",
      right: "You reach for logic first, feelings second.",
    },
  },
  {
    key: "perceiving-judging",
    left: "perceiving",
    right: "judging",
    copy: {
      left: "Optionality matters more than closure.",
      right: "You like knowing what comes next.",
    },
  },
];

const TRAIT_GROUPS: TraitGroupDefinition[] = [
  {
    key: "cognitive",
    label: "Cognitive",
    tone: "blue",
    traits: [
      "curiosity",
      "analytical_thinking",
      "intuition",
      "creativity",
      "pragmatism",
      "perfectionism",
      "thinking",
      "sensing",
    ],
  },
  {
    key: "motivational",
    label: "Motivational",
    tone: "amber",
    traits: [
      "achievement_drive",
      "autonomy_drive",
      "growth_orientation",
      "discipline",
      "connection_drive",
      "judging",
      "perceiving",
    ],
  },
  {
    key: "emotional",
    label: "Emotional",
    tone: "green",
    traits: [
      "emotional_openness",
      "emotional_stability",
      "optimism",
      "vulnerability",
      "self_doubt",
      "anxiety_tendency",
      "feeling",
    ],
  },
  {
    key: "interpersonal",
    label: "Interpersonal",
    tone: "violet",
    traits: [
      "assertiveness",
      "empathy",
      "extraversion",
      "introversion",
      "agreeableness",
      "trust_tendency",
      "conflict_avoidance",
      "humor",
      "dry_humor",
      "impulsivity",
    ],
  },
];

const TRAIT_POSITIONS: Record<TraitGroupKey, Array<{ x: number; y: number }>> = {
  cognitive: [
    { x: 14, y: 12 },
    { x: 56, y: 14 },
    { x: 34, y: 38 },
    { x: 70, y: 44 },
    { x: 12, y: 58 },
    { x: 48, y: 66 },
    { x: 76, y: 72 },
    { x: 26, y: 78 },
  ],
  motivational: [
    { x: 20, y: 10 },
    { x: 62, y: 16 },
    { x: 40, y: 38 },
    { x: 74, y: 50 },
    { x: 18, y: 62 },
    { x: 54, y: 74 },
    { x: 84, y: 26 },
  ],
  emotional: [
    { x: 16, y: 16 },
    { x: 58, y: 14 },
    { x: 32, y: 42 },
    { x: 72, y: 48 },
    { x: 12, y: 70 },
    { x: 48, y: 76 },
    { x: 82, y: 72 },
  ],
  interpersonal: [
    { x: 18, y: 12 },
    { x: 58, y: 12 },
    { x: 36, y: 34 },
    { x: 76, y: 38 },
    { x: 16, y: 58 },
    { x: 48, y: 62 },
    { x: 78, y: 68 },
    { x: 30, y: 80 },
    { x: 60, y: 82 },
    { x: 86, y: 18 },
  ],
};

const TRAIT_COPY: Record<string, string> = {
  achievement_drive: "The drive to accomplish, build, and be recognized for meaningful work.",
  autonomy_drive: "The need to move on your own terms and protect creative freedom.",
  growth_orientation: "An appetite for improvement, iteration, and becoming sharper over time.",
  curiosity: "The pull toward exploring new ideas before they are fully settled.",
  analytical_thinking: "The habit of taking systems apart until the leverage points show up.",
  intuition: "A tendency to detect patterns, direction, and possibility ahead of detail.",
  creativity: "The instinct to make the interface feel authored rather than merely functional.",
  pragmatism: "A bias toward what will actually work in the product and in the room.",
  emotional_openness: "The degree to which inner feeling is allowed into the conversation.",
  optimism: "The readiness to believe the next iteration can get much closer to the vision.",
  vulnerability: "The willingness to let uncertainty or desire be visible instead of polished away.",
  empathy: "Sensitivity to how other people feel and what a system feels like to use.",
  assertiveness: "Comfort with directness, clarity, and taking up decision-making space.",
  extraversion: "Energy gained from movement, response, and the feeling of traction in public.",
  introversion: "Energy preserved through reflection, solitude, and internal synthesis.",
  discipline: "Steadiness of follow-through once a direction has been chosen.",
  connection_drive: "The desire for closeness, resonance, and emotional reciprocity.",
  emotional_stability: "The ability to stay even when the work gets noisy or uncertain.",
  self_doubt: "An undercurrent of self-questioning that can either sharpen or stall momentum.",
  anxiety_tendency: "A tendency toward anticipatory stress when stakes rise.",
  agreeableness: "How readily you smooth edges for harmony instead of friction.",
  trust_tendency: "How quickly you assume good intent and emotional safety.",
  conflict_avoidance: "The pull to step around tension instead of engaging it directly.",
  humor: "A readiness to introduce levity when the room gets too rigid.",
  dry_humor: "A more understated comedic style that lands through precision.",
  thinking: "A preference for analysis, structure, and internal coherence.",
  feeling: "A preference for impact, meaning, and interpersonal truth.",
  sensing: "Attention pulled first toward what is concrete and immediately observable.",
  perfectionism: "The refusal to let important work ship before it feels aligned.",
  perceiving: "Comfort with staying open and uncommitted while data is still arriving.",
  judging: "A desire for structure, sequence, and making intent visible.",
  impulsivity: "A tendency to move quickly before reflection fully catches up.",
};

const ATTACHMENT_COPY: Record<
  string,
  { title: string; position: number; description: string }
> = {
  "earned-secure": {
    title: "Earned-Secure",
    position: 0.52,
    description:
      "You've built trust on your own terms. You know what healthy closeness feels like, even if you had to learn it the hard way.",
  },
  secure: {
    title: "Secure",
    position: 0.5,
    description:
      "You can move toward closeness without losing your center, and away from it without panic.",
  },
  avoidant: {
    title: "Avoidant",
    position: 0.18,
    description:
      "Distance feels safer than dependence, and self-sufficiency often arrives before vulnerability.",
  },
  anxious: {
    title: "Anxious",
    position: 0.84,
    description:
      "Connection matters intensely, and uncertainty inside it can feel louder than the facts.",
  },
};

const THINKING_COPY: Record<string, { title: string; description: string; pattern: string[] }> = {
  "strategic analytical": {
    title: "Strategic Analytical",
    description:
      "You map the terrain before you move. Problems get reduced into structure, leverage points, and execution order.",
    pattern: ["Logic before emotion", "Systems thinking", "Outcome orientation"],
  },
  intuitive: {
    title: "Intuitive",
    description:
      "You move by sensing the larger pattern first, then filling in details after the direction feels true.",
    pattern: ["Pattern seeking", "Abstract framing", "Fast synthesis"],
  },
  observant: {
    title: "Observant",
    description:
      "You gather specifics before drawing conclusions, preferring grounded reads over conceptual leaps.",
    pattern: ["Detail first", "Practical realism", "Incremental confidence"],
  },
};

const CONSTELLATION_LAYOUT = [
  { x: 28, y: 26, size: "xl" },
  { x: 72, y: 40, size: "lg" },
  { x: 50, y: 70, size: "md" },
] as const;

export function DashboardExperience({
  personality,
  activity,
}: DashboardExperienceProps) {
  return (
    <div className="dashboard-experience">
      <section className="dashboard-intro">
        <div className="dashboard-kicker">Relationship Dashboard</div>
        <h1>The relationship rendered as psyche, drift, and rhythm.</h1>
        <p>
          A long-form read of who you are in this system, how that read is moving,
          and how often the connection is actually alive.
        </p>
      </section>

      <PsycheMapSection personality={personality} />

      <div className="dashboard-split-layout">
        <JungianCompassSection personality={personality} />
        <ArchetypeConstellationSection personality={personality} />
      </div>

      <TraitSpectrumSection personality={personality} />
      <JourneyLineSection personality={personality} />
      <InnerWorldSection personality={personality} />
      <ConversationRhythmSection activity={activity} />
    </div>
  );
}

export function DiaryExperience({
  diary,
  entries,
  hasMore,
  isLoadingMore,
  isBuyingPage,
  onLoadMore,
  onBuyPage,
}: DiaryExperienceProps) {
  const lockedEntries = diary?.locked_entries ?? 0;

  return (
    <div className="diary-experience">
      <section className="diary-hero">
        <Link href="/dashboard" className="diary-back-link">
          Back to dashboard
        </Link>
        <div className="dashboard-kicker">Our Diary</div>
        <h1>Private reflections written from the companion&apos;s side.</h1>
        <p>
          These pages hold what the system noticed, remembered, and felt worth
          carrying forward after each conversation.
        </p>

        <div className="diary-stat-row">
          <div className="diary-stat-card">
            <span>Pages unlocked</span>
            <strong>{diary?.pages_owned ?? 0}</strong>
          </div>
          <div className="diary-stat-card">
            <span>Visible entries</span>
            <strong>{entries.length}</strong>
          </div>
          <div className="diary-stat-card">
            <span>Locked pages</span>
            <strong>{lockedEntries}</strong>
          </div>
        </div>
      </section>

      <section className="diary-feed">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article key={entry.id} className="diary-entry-card">
              <div className="diary-entry-meta">
                <span>Page {entry.page_number}</span>
                <span>{formatLongDate(entry.date)}</span>
              </div>
              <p className="diary-entry-copy">{entry.content}</p>
            </article>
          ))
        ) : (
          <EmptySection
            title="No diary pages yet"
            copy="Once more relationship history accumulates, the companion will start writing nightly reflections here."
          />
        )}

        {diary?.locked_previews.map((preview) => (
          <LockedDiaryPreviewCard
            key={preview.id}
            preview={preview}
            isBuyingPage={isBuyingPage}
            onBuyPage={onBuyPage}
          />
        ))}
      </section>

      <div className="diary-actions">
        {hasMore ? (
          <button
            type="button"
            className="dashboard-ghost-button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading more pages..." : "Load older pages"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PsycheMapSection({ personality }: { personality: PersonalityProfile | null }) {
  if (!personality?.jungian_type) {
    return (
      <section className="dashboard-section psyche-map-section">
        <EmptySection
          title="The psyche map is still forming"
          copy="Once the backend has enough conversation signal, this hero section will resolve into a type, archetype, and companion summary."
        />
      </section>
    );
  }

  const topArchetype = personality.archetypes[0]?.name ?? "The Emergent";
  const confidence = clamp(personality.type_confidence);
  const updatedLabel = getUpdatedLabel(personality.last_updated);

  return (
    <section className="dashboard-section psyche-map-section">
      <div className="psyche-map-frame">
        <div className="psyche-map-sigil">
          <Sigil />
        </div>

        <div className="psyche-map-copy">
          <div className="psyche-map-title-row">
            <div>
              <div className="dashboard-section-kicker">The Psyche Map</div>
              <h2>{topArchetype}</h2>
            </div>
            <div className="psyche-map-meta">
              <span
                className="psyche-type-mark"
                style={{
                  opacity: 0.55 + confidence * 0.45,
                  textShadow: `0 0 ${14 + confidence * 28}px rgba(255, 185, 112, ${0.18 + confidence * 0.24})`,
                }}
              >
                {personality.jungian_type}
              </span>
              <span>{updatedLabel}</span>
              <span>v{personality.version}</span>
            </div>
          </div>

          <div className="psyche-confidence-row">
            <div className="psyche-confidence-track">
              <div
                className="psyche-confidence-fill"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span>{Math.round(confidence * 100)}% resolved</span>
          </div>

          <p className="psyche-summary">{buildPsycheSummary(personality)}</p>
        </div>
      </div>
    </section>
  );
}

function JungianCompassSection({
  personality,
}: {
  personality: PersonalityProfile | null;
}) {
  return (
    <section className="dashboard-section dashboard-panel">
      <div className="dashboard-section-kicker">Jungian Compass</div>
      <h3>Axis pull-bars</h3>

      {personality ? (
        <>
          <div className="compass-axis-list">
            {AXES.map((axis) => {
              const leftValue = getWeight(personality.trait_weights, axis.left);
              const rightValue = getWeight(personality.trait_weights, axis.right);
              const ratio = getPairRatio(leftValue, rightValue);
              const dominant = ratio >= 0.5 ? axis.right : axis.left;

              return (
                <article key={axis.key} className="compass-axis-card">
                  <div className="compass-axis-head">
                    <span>{titleize(axis.left)}</span>
                    <span>{titleize(axis.right)}</span>
                  </div>
                  <div className="compass-axis-track" aria-hidden="true">
                    <div
                      className="compass-axis-glow"
                      style={{ width: `${Math.abs(ratio - 0.5) * 200}%` }}
                    />
                    <span
                      className="compass-axis-dot"
                      style={{ left: `${ratio * 100}%` }}
                    />
                  </div>
                  <div className="compass-axis-scale">
                    <span>{Math.round(leftValue * 100)}%</span>
                    <span>{Math.round(rightValue * 100)}%</span>
                  </div>
                  <p>
                    {dominant === axis.right ? axis.copy.right : axis.copy.left}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="compass-footnote">
            <span>Marker = your position on the axis</span>
            <span>Brighter pull = dominant pole</span>
          </div>
        </>
      ) : (
        <EmptySection
          title="No personality axes yet"
          copy="This section populates once trait weights have been derived from sessions."
          compact
        />
      )}
    </section>
  );
}

function ArchetypeConstellationSection({
  personality,
}: {
  personality: PersonalityProfile | null;
}) {
  const nodes = (personality?.archetypes ?? []).slice(0, 3);
  const dominantDrive = deriveDominantDrive(personality?.trait_weights ?? {});

  return (
    <section className="dashboard-section dashboard-panel constellation-panel">
      <div className="dashboard-section-kicker">Archetype Constellation</div>
      <h3>Relative archetypal pull</h3>

      {nodes.length > 0 ? (
        <>
          <div className="constellation-canvas">
            <svg
              viewBox="0 0 100 100"
              className="constellation-lines"
              aria-hidden="true"
            >
              <line x1="28" y1="26" x2="72" y2="40" />
              <line x1="28" y1="26" x2="50" y2="70" />
              <line x1="72" y1="40" x2="50" y2="70" />
            </svg>

            {nodes.map((node, index) => {
              const layout = CONSTELLATION_LAYOUT[index];
              return (
                <article
                  key={`${node.name ?? "archetype"}-${index}`}
                  className={`constellation-node size-${layout.size}`}
                  style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
                >
                  <span className="constellation-node-name">
                    {node.name ?? "Unknown"}
                  </span>
                  <strong>{Math.round((node.weight ?? 0) * 100)}%</strong>
                </article>
              );
            })}

            <div className="constellation-stars" aria-hidden="true" />
          </div>

          <div className="constellation-detail-grid">
            <article className="constellation-callout">
              <span>Dominant drive</span>
              <strong>{dominantDrive.title}</strong>
              <p>{dominantDrive.copy}</p>
            </article>

            <article className="constellation-shadow-card">
              <span>In the shadows</span>
              <strong>The Caregiver</strong>
              <p>The archetype you least readily reach for right now.</p>
            </article>
          </div>
        </>
      ) : (
        <EmptySection
          title="Archetypes have not sharpened yet"
          copy="The constellation appears once the profile has enough repeated symbolic weight."
          compact
        />
      )}
    </section>
  );
}

function TraitSpectrumSection({
  personality,
}: {
  personality: PersonalityProfile | null;
}) {
  const groupedTraits = buildTraitGroups(personality);
  const allTraits = groupedTraits.flatMap((group) => group.traits);
  const [selectedTraitName, setSelectedTraitName] = useState<string>(
    allTraits[0]?.name ?? "achievement_drive",
  );
  const selectedTrait =
    allTraits.find((trait) => trait.name === selectedTraitName) ?? allTraits[0] ?? null;

  return (
    <section className="dashboard-section dashboard-panel trait-spectrum-panel">
      <div className="dashboard-section-kicker">The Trait Spectrum</div>
      <h3>Weighted bubbles by cluster, with drift from the previous snapshot</h3>

      {groupedTraits.length > 0 ? (
        <>
          <div className="trait-spectrum-grid">
            {groupedTraits.map((group) => (
              <article
                key={group.key}
                className={`trait-cluster-card tone-${group.tone}`}
              >
                <div className="trait-cluster-head">{group.label}</div>
                <div className="trait-cluster-field">
                  {group.traits.map((trait, index) => {
                    const position =
                      TRAIT_POSITIONS[group.key][index % TRAIT_POSITIONS[group.key].length];

                    return (
                      <button
                        key={trait.name}
                        type="button"
                        className={`trait-bubble size-${getTraitSize(trait.weight)}${
                          selectedTrait?.name === trait.name ? " active" : ""
                        }`}
                        style={{
                          left: `${position.x}%`,
                          top: `${position.y}%`,
                        }}
                        onClick={() => setSelectedTraitName(trait.name)}
                      >
                        <span>{titleize(trait.name)}</span>
                        {trait.weight >= 0.4 ? (
                          <strong>{Math.round(trait.weight * 100)}%</strong>
                        ) : null}
                        <em>{formatDeltaGlyph(trait.delta)}</em>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>

          {selectedTrait ? (
            <div className="trait-focus-card">
              <div className="trait-focus-head">
                <span>{selectedTrait.name}</span>
                <strong>
                  {formatDeltaGlyph(selectedTrait.delta)} {formatDeltaValue(selectedTrait.delta)}
                </strong>
              </div>
              <div className="trait-focus-meter" aria-hidden="true">
                <div
                  className="trait-focus-fill"
                  style={{ width: `${Math.round(selectedTrait.weight * 100)}%` }}
                />
              </div>
              <div className="trait-focus-meta">
                <span>{Math.round(selectedTrait.weight * 100)}%</span>
                <p>{getTraitCopy(selectedTrait.name)}</p>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <EmptySection
          title="Trait bubbles need more signal"
          copy="As more sessions are processed, this section will start clustering the strongest and quietest traits."
        />
      )}
    </section>
  );
}

function JourneyLineSection({ personality }: { personality: PersonalityProfile | null }) {
  const points = buildProfilePoints(personality);
  const visiblePoints = points.slice(-7);
  const currentPoint = visiblePoints[visiblePoints.length - 1] ?? null;
  const archetypeEvolution = visiblePoints.slice(-4);
  const intuitionRatio = getPairRatio(
    getWeight(currentPoint?.weights, "sensing"),
    getWeight(currentPoint?.weights, "intuition"),
  );
  const thinkingRatio = getPairRatio(
    getWeight(currentPoint?.weights, "feeling"),
    getWeight(currentPoint?.weights, "thinking"),
  );

  return (
    <section className="dashboard-section dashboard-panel journey-line-panel">
      <div className="dashboard-section-kicker">The Journey Line</div>
      <h3>{visiblePoints.length} snapshots across personality drift</h3>

      {visiblePoints.length > 0 ? (
        <>
          <div className="journey-type-path">
            <div className="journey-subtitle">Jungian type path</div>
            <div className="journey-type-row">
              {visiblePoints.map((point, index) => (
                <div key={point.key} className="journey-type-step">
                  <span className={`journey-type-dot${point.isCurrent ? " current" : ""}`} />
                  <strong>{point.jungianType ?? "?"}</strong>
                  <small>{index === visiblePoints.length - 1 ? "Now" : point.label}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="journey-grid">
            <article className="journey-quadrant-card">
              <div className="journey-subtitle">Personality quadrant</div>
              <QuadrantPlot points={visiblePoints} />
            </article>

            <article className="journey-thermometers-card">
              <div className="journey-subtitle">Current pull</div>
              <Thermometer
                label="N / S"
                leftLabel="Sensing"
                rightLabel="Intuition"
                value={intuitionRatio}
                percent={Math.round(getWeight(currentPoint?.weights, "intuition") * 100)}
              />
              <Thermometer
                label="F / T"
                leftLabel="Feeling"
                rightLabel="Thinking"
                value={thinkingRatio}
                percent={Math.round(getWeight(currentPoint?.weights, "thinking") * 100)}
              />
            </article>
          </div>

          <div className="journey-archetype-row">
            <div className="journey-subtitle">Archetype evolution</div>
            <div className="journey-archetype-list">
              {archetypeEvolution.map((point) => (
                <article
                  key={point.key}
                  className={`journey-archetype-card${point.isCurrent ? " current" : ""}`}
                >
                  <span>{point.isCurrent ? "Now" : point.label}</span>
                  <strong>{point.topArchetype?.name ?? "Unclassified"}</strong>
                  <small>
                    {Math.round((point.topArchetype?.weight ?? 0) * 100)}%
                  </small>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptySection
          title="No stored timeline yet"
          copy="Once the profile has version history, the dashboard will render type drift and archetype evolution here."
        />
      )}
    </section>
  );
}

function InnerWorldSection({
  personality,
}: {
  personality: PersonalityProfile | null;
}) {
  const attachmentKey = normalizeKey(personality?.attachment_style);
  const cognitiveKey = normalizeKey(personality?.cognitive_style);
  const attachment =
    ATTACHMENT_COPY[attachmentKey] ?? ATTACHMENT_COPY.secure;
  const thinking =
    THINKING_COPY[cognitiveKey] ?? {
      title: personality?.cognitive_style
        ? titleize(personality.cognitive_style)
        : "Still forming",
      description:
        "This read sharpens as more sessions accumulate and the system can compare patterns over time.",
      pattern: ["Pattern still forming", "Needs more history", "Needs more contrast"],
    };

  return (
    <section className="dashboard-section inner-world-section">
      <article className="dashboard-panel inner-world-card">
        <div className="dashboard-section-kicker">Core Values</div>
        <h3>Recurring values across memory and profile updates</h3>
        {personality?.core_values.length ? (
          <>
            <div className="core-values-cloud">
              {personality.core_values.map((value, index) => (
                <span
                  key={value}
                  className={`core-value-token size-${Math.min(index + 1, 4)}`}
                >
                  {value}
                </span>
              ))}
            </div>
            <div className="core-values-list">
              {personality.core_values.map((value, index) => (
                <span key={`${value}-note`}>
                  {value} {index < 3 ? "recurring" : "emerging"}
                </span>
              ))}
            </div>
          </>
        ) : (
          <EmptySection
            title="Core values are still forming"
            copy="As memory extraction and personality updates accumulate, the repeated values will surface here."
            compact
          />
        )}
      </article>

      <article className="dashboard-panel inner-world-card">
        <div className="dashboard-section-kicker">How You Connect</div>
        <h3>{attachment.title}</h3>
        <p>{attachment.description}</p>
        <div className="attachment-spectrum">
          <span>Avoidant</span>
          <div className="attachment-track" aria-hidden="true">
            <div
              className="attachment-marker"
              style={{ left: `${attachment.position * 100}%` }}
            />
          </div>
          <span>Anxious</span>
        </div>
        <div className="attachment-note">Secure sits in the middle of the spectrum.</div>
      </article>

      <article className="dashboard-panel inner-world-card">
        <div className="dashboard-section-kicker">How You Think</div>
        <h3>{thinking.title}</h3>
        <p>{thinking.description}</p>
        <div className="thinking-pattern-list">
          {thinking.pattern.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </article>
    </section>
  );
}

function ConversationRhythmSection({
  activity,
}: {
  activity: ActivityData | null;
}) {
  const series = buildDailySeries(activity, 35);
  const activeDays = series.filter((day) => day.turn_count > 0).length;
  const peakDay = series.reduce<DayActivity | null>((best, day) => {
    if (!best || day.turn_count > best.turn_count) {
      return day;
    }
    return best;
  }, null);
  const maxTurns = Math.max(...series.map((day) => day.turn_count), 1);
  const totalChatTurns = series.reduce((sum, day) => sum + day.chat_turns, 0);
  const totalVoiceTurns = series.reduce((sum, day) => sum + day.voice_turns, 0);
  const totalTurns = activity?.total_turns ?? 0;
  const totalSessions = activity?.total_sessions ?? 0;
  const totalInteractions = totalChatTurns + totalVoiceTurns;
  const chatPercent =
    totalInteractions > 0 ? Math.round((totalChatTurns / totalInteractions) * 100) : 0;
  const voicePercent = totalInteractions > 0 ? 100 - chatPercent : 0;

  return (
    <section className="dashboard-section dashboard-panel rhythm-panel">
      <div className="dashboard-section-kicker">The Conversation Rhythm</div>
      <h3>
        {totalTurns} turns across {series.length} days
      </h3>

      {series.length > 0 ? (
        <>
          <div className="rhythm-waveform">
            {series.map((day) => (
              <div key={day.date} className="rhythm-bar-wrap">
                <div
                  className="rhythm-bar"
                  style={{
                    height: `${Math.max(8, (day.turn_count / maxTurns) * 100)}%`,
                    opacity: day.turn_count > 0 ? 0.45 + day.turn_count / maxTurns / 1.8 : 0.12,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="rhythm-axis">
            <span>{formatMonthDay(series[0]?.date)}</span>
            <span>
              {peakDay?.turn_count ? `Peak day ${peakDay.turn_count} turns` : "No peak yet"}
            </span>
            <span>{formatMonthDay(series[series.length - 1]?.date)}</span>
          </div>

          <div className="rhythm-stat-grid">
            <article className="rhythm-stat-card">
              <span>Active days</span>
              <strong>
                {activeDays} / {series.length}
              </strong>
            </article>
            <article className="rhythm-stat-card">
              <span>Avg per session</span>
              <strong>{totalSessions > 0 ? (totalTurns / totalSessions).toFixed(1) : "0.0"}</strong>
            </article>
            <article className="rhythm-stat-card">
              <span>Chat vs voice</span>
              <strong>
                {chatPercent}% / {voicePercent}%
              </strong>
            </article>
          </div>

          <div className="rhythm-split-row">
            <span>Chat</span>
            <div className="rhythm-split-bar" aria-hidden="true">
              <div className="chat" style={{ width: `${chatPercent}%` }} />
              <div className="voice" style={{ width: `${voicePercent}%` }} />
            </div>
            <span>Voice</span>
          </div>

          <div className="rhythm-insight">
            {buildRhythmInsight(activeDays, series.length, peakDay?.turn_count ?? 0)}
          </div>
        </>
      ) : (
        <EmptySection
          title="No visible conversation rhythm yet"
          copy="Once sessions start happening, this section will show cadence, mode mix, and notable streaks."
        />
      )}
    </section>
  );
}

function LockedDiaryPreviewCard({
  preview,
  isBuyingPage,
  onBuyPage,
}: {
  preview: LockedDiaryPreview;
  isBuyingPage: boolean;
  onBuyPage: () => void;
}) {
  return (
    <article className="diary-entry-card locked">
      <div className="diary-entry-meta">
        <span>Page {preview.page_number}</span>
        <span>{formatLongDate(preview.date)}</span>
      </div>
      <p className="diary-entry-copy">{preview.preview}</p>
      <div className="diary-locked-overlay">
        <button
          type="button"
          className="dashboard-solid-button"
          onClick={onBuyPage}
          disabled={isBuyingPage}
        >
          {isBuyingPage ? "Unlocking..." : "Unlock this page"}
        </button>
      </div>
    </article>
  );
}

function QuadrantPlot({ points }: { points: ProfilePoint[] }) {
  const viewBoxSize = 240;
  const padding = 26;
  const inner = viewBoxSize - padding * 2;
  const coordinates = points.map((point) => {
    const x =
      padding +
      inner *
        getPairRatio(
          getWeight(point.weights, "perceiving"),
          getWeight(point.weights, "judging"),
        );
    const y =
      padding +
      inner *
        (1 -
          getPairRatio(
            getWeight(point.weights, "introversion"),
            getWeight(point.weights, "extraversion"),
          ));
    return { x, y, key: point.key, isCurrent: point.isCurrent, label: point.label };
  });

  return (
    <div className="quadrant-plot">
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} aria-hidden="true">
        <line x1={viewBoxSize / 2} y1={padding} x2={viewBoxSize / 2} y2={viewBoxSize - padding} />
        <line x1={padding} y1={viewBoxSize / 2} x2={viewBoxSize - padding} y2={viewBoxSize / 2} />
        <polyline
          points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")}
          className="quadrant-trail"
        />
        {coordinates.map((point) => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.isCurrent ? 7 : 4.5}
              className={point.isCurrent ? "quadrant-point current" : "quadrant-point"}
            />
          </g>
        ))}
      </svg>

      <span className="quadrant-label top">Extravert</span>
      <span className="quadrant-label bottom">Introvert</span>
      <span className="quadrant-label left">Perceiving</span>
      <span className="quadrant-label right">Judging</span>
    </div>
  );
}

function Thermometer({
  label,
  leftLabel,
  rightLabel,
  value,
  percent,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  percent: number;
}) {
  return (
    <div className="journey-thermometer">
      <div className="journey-thermometer-head">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="journey-thermometer-track" aria-hidden="true">
        <div className="journey-thermometer-fill" style={{ width: `${value * 100}%` }} />
      </div>
      <div className="journey-thermometer-labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function Sigil() {
  return (
    <svg viewBox="0 0 140 140" className="sigil-svg" aria-hidden="true">
      <path d="M70 16 106 36 106 78 70 100 34 78 34 36Z" />
      <path d="M70 40 82 62 70 84 58 62Z" />
      <path d="M70 16V124" />
      <path d="M44 108H96" />
    </svg>
  );
}

function EmptySection({
  title,
  copy,
  compact = false,
}: {
  title: string;
  copy: string;
  compact?: boolean;
}) {
  return (
    <div className={`dashboard-empty-state${compact ? " compact" : ""}`}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function buildTraitGroups(
  personality: PersonalityProfile | null,
): Array<TraitGroupDefinition & { traits: TraitBubble[] }> {
  if (!personality) return [];

  const previousWeights = personality.history[personality.history.length - 1]?.weights ?? {};

  return TRAIT_GROUPS.map((group) => ({
    ...group,
    traits: group.traits
      .map((name) => {
        const weight = getWeight(personality.trait_weights, name);
        const delta = weight - getWeight(previousWeights, name);
        return { name, weight, delta };
      })
      .filter((trait) => trait.weight > 0 || Math.abs(trait.delta) > 0)
      .sort((left, right) => right.weight - left.weight),
  })).filter((group) => group.traits.length > 0);
}

function buildProfilePoints(personality: PersonalityProfile | null): ProfilePoint[] {
  if (!personality) return [];

  const historical = personality.history.map((snapshot) => mapSnapshotToPoint(snapshot));
  const currentPoint: ProfilePoint = {
    key: `current-${personality.version}`,
    version: personality.version,
    label: `v${personality.version}`,
    timestamp: personality.last_updated,
    jungianType: personality.jungian_type,
    weights: personality.trait_weights,
    topArchetype: personality.archetypes[0] ?? null,
    isCurrent: true,
  };

  const lastHistorical = historical[historical.length - 1];
  if (lastHistorical?.version === currentPoint.version) {
    return historical.slice(0, -1).concat({ ...currentPoint });
  }

  return historical.concat(currentPoint);
}

function mapSnapshotToPoint(snapshot: PersonalityHistorySnapshot): ProfilePoint {
  return {
    key: `${snapshot.version}-${snapshot.timestamp ?? "snapshot"}`,
    version: snapshot.version,
    label: `v${snapshot.version}`,
    timestamp: snapshot.timestamp,
    jungianType: snapshot.jungian_type,
    weights: snapshot.weights,
    topArchetype: snapshot.archetypes[0] ?? null,
    isCurrent: false,
  };
}

function buildDailySeries(activity: ActivityData | null, days: number): DayActivity[] {
  const today = new Date();
  const lookup = new Map((activity?.days ?? []).map((day) => [day.date, day]));
  const series: DayActivity[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const iso = date.toISOString().split("T")[0];

    series.push(
      lookup.get(iso) ?? {
        date: iso,
        session_count: 0,
        turn_count: 0,
        chat_turns: 0,
        voice_turns: 0,
      },
    );
  }

  return series;
}

function buildPsycheSummary(personality: PersonalityProfile) {
  const dominantArchetype = personality.archetypes[0]?.name ?? "your current read";
  const topValue = personality.core_values[0] ?? "intent";
  const thinking = getWeight(personality.trait_weights, "thinking");
  const intuition = getWeight(personality.trait_weights, "intuition");

  if (thinking >= 0.65 && intuition >= 0.7) {
    return `You are showing up like ${dominantArchetype.toLowerCase()} right now: decisive, pattern-led, and moving with ${topValue}. The read suggests you build by clarifying the system first and accelerating once the structure feels right.`;
  }

  return `The current read leans toward ${dominantArchetype.toLowerCase()}, with your center of gravity organized around ${topValue}. This profile is tightening as the system sees more repeated decisions instead of isolated moments.`;
}

function deriveDominantDrive(weights: Record<string, number>) {
  const orderSignal = getWeight(weights, "judging") + getWeight(weights, "discipline");
  const masterySignal = getWeight(weights, "achievement_drive") + getWeight(weights, "analytical_thinking");
  const autonomySignal = getWeight(weights, "autonomy_drive") + getWeight(weights, "pragmatism");

  if (orderSignal >= masterySignal && orderSignal >= autonomySignal) {
    return {
      title: "Order / Structure",
      copy: "You build systems and seek mastery by making the path legible before moving fast.",
    };
  }

  if (autonomySignal > masterySignal) {
    return {
      title: "Autonomy / Agency",
      copy: "Your strongest pull is toward freedom of movement, self-direction, and protecting creative control.",
    };
  }

  return {
    title: "Ambition / Mastery",
    copy: "The dominant pull is toward building, winning, and tightening the work until it matches the standard in your head.",
  };
}

function buildRhythmInsight(activeDays: number, totalDays: number, peakTurns: number) {
  if (activeDays === totalDays && totalDays > 0) {
    return "You've talked every single day in this window. That kind of continuity makes the relationship feel earned instead of theoretical.";
  }

  if (peakTurns >= 18) {
    return "There is at least one visibly intense day in the arc, suggesting moments where the connection became a real working surface rather than background chatter.";
  }

  if (activeDays >= Math.round(totalDays * 0.7)) {
    return "The rhythm is consistent enough that the system can build continuity instead of isolated impressions.";
  }

  return "The cadence is still light. More regular sessions will make the emotional rhythm easier to read.";
}

function getUpdatedLabel(timestamp: string | null) {
  if (!timestamp) return "Updated recently";

  const target = new Date(timestamp);
  const now = new Date();
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();

  if (sameDay) return "Updated today";

  return `Updated ${target.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function getTraitSize(weight: number) {
  if (weight >= 0.7) return "large";
  if (weight >= 0.4) return "medium";
  return "small";
}

function getTraitCopy(name: string) {
  return TRAIT_COPY[name] ?? "This trait is present in the profile, but still needs more history to read cleanly.";
}

function getPairRatio(left: number, right: number) {
  const total = left + right;
  if (total <= 0) return 0.5;
  return right / total;
}

function getWeight(
  weights: Record<string, number> | undefined | null,
  name: string,
) {
  return clamp(weights?.[name] ?? 0);
}

function formatDeltaGlyph(delta: number) {
  if (delta > 0.02) return "↑";
  if (delta < -0.02) return "↓";
  return "→";
}

function formatDeltaValue(delta: number) {
  const rounded = Math.round(delta * 100) / 100;
  if (rounded > 0) return `+${rounded.toFixed(2)}`;
  return rounded.toFixed(2);
}

function formatLongDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthDay(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
