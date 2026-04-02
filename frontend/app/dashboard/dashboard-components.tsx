import type {
  ActivityData,
  DayActivity,
  DiaryList,
  LockedDiaryPreview,
  MemoryItem,
  PersonalityProfile,
} from "@/lib/api";

type TraitEntry = {
  name: string;
  weight: number;
};

type HeatmapCell = {
  date: string;
  level: number;
  turns: number;
};

type ActivitySummary = {
  strongestDayLabel: string;
  strongestDayTurns: number;
  activeDays: number;
  totalChatTurns: number;
  totalVoiceTurns: number;
  averageTurnsPerActiveDay: number;
};

export function PersonaAtlasCard({
  personality,
  topTraits,
  expanded = false,
}: {
  personality: PersonalityProfile | null;
  topTraits: TraitEntry[];
  expanded?: boolean;
}) {
  const confidence = personality?.type_confidence ?? 0;
  const archetypes = (personality?.archetypes ?? []).slice(0, 3);
  const driftSeries = buildDriftSeries(personality, topTraits);

  return (
    <section
      className={`dashboard-card dashboard-card-hero persona-atlas-card${
        expanded ? " is-expanded" : ""
      }`}
    >
      <div className="card-eyebrow">Persona Atlas</div>
      {personality?.jungian_type ? (
        <>
          <div className="persona-atlas-header">
            <div>
              <div className="persona-atlas-type">{personality.jungian_type}</div>
              <div className="persona-atlas-subtitle">
                Built from session behavior, memory formation, and recurring themes.
              </div>
            </div>
            <ConfidenceRing value={confidence} />
          </div>

          <div className="persona-atlas-grid">
            <div className="persona-radar-block">
              <TraitRadar traits={topTraits} />
            </div>

            <div className="persona-details-block">
              <StatStrip
                items={[
                  {
                    label: "Attachment",
                    value: labelOrFallback(personality.attachment_style, "Emerging"),
                  },
                  {
                    label: "Cognitive style",
                    value: labelOrFallback(personality.cognitive_style, "Observing"),
                  },
                  {
                    label: "Profile version",
                    value: `v${personality.version || 0}`,
                  },
                ]}
              />

              <div className="persona-section">
                <div className="persona-section-label">Top archetypes</div>
                <div className="chip-row">
                  {archetypes.length > 0 ? (
                    archetypes.map((archetype, index) => (
                      <span key={`${archetype.name}-${index}`} className="insight-chip">
                        {String(archetype.name ?? "Archetype")}
                        {typeof archetype.weight === "number"
                          ? ` ${Math.round(archetype.weight * 100)}%`
                          : ""}
                      </span>
                    ))
                  ) : (
                    <span className="muted-copy">Archetypes will sharpen as more sessions accumulate.</span>
                  )}
                </div>
              </div>

              <div className="persona-section">
                <div className="persona-section-label">Core values</div>
                <div className="chip-row">
                  {personality.core_values.length > 0 ? (
                    personality.core_values.map((value) => (
                      <span key={value} className="value-chip">
                        {titleize(value)}
                      </span>
                    ))
                  ) : (
                    <span className="muted-copy">Core values are still forming.</span>
                  )}
                </div>
              </div>

              <div className="persona-section">
                <div className="persona-section-label">Dominant traits</div>
                <div className="trait-list">
                  {topTraits.length > 0 ? (
                    topTraits.map((trait) => (
                      <div key={trait.name} className="trait-list-item">
                        <span className="trait-list-name">{titleize(trait.name)}</span>
                        <div className="trait-list-track">
                          <div
                            className="trait-list-fill"
                            style={{ width: `${Math.max(trait.weight * 100, 6)}%` }}
                          />
                        </div>
                        <span className="trait-list-value">{Math.round(trait.weight * 100)}%</span>
                      </div>
                    ))
                  ) : (
                    <EmptyInsight copy="Keep talking so the profile can form visible trait patterns." />
                  )}
                </div>
              </div>

              {expanded ? (
                <div className="persona-section">
                  <div className="persona-section-label">Trait drift</div>
                  <TraitDriftChart series={driftSeries} />
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <EmptyInsight copy="No personality read yet. Once sessions build up, this panel will show type, traits, and values." />
      )}
    </section>
  );
}

export function CompanionLensCard({ personality }: { personality: PersonalityProfile | null }) {
  const summary = buildCompanionSummary(personality);

  return (
    <section className="dashboard-card companion-lens-card">
      <div className="card-eyebrow">Companion Lens</div>
      <p className="lens-summary">{summary}</p>
      <div className="lens-grid">
        <LensMetric
          label="Attachment"
          value={labelOrFallback(personality?.attachment_style, "Not enough signal")}
        />
        <LensMetric
          label="Thinking pattern"
          value={labelOrFallback(personality?.cognitive_style, "Still forming")}
        />
        <LensMetric
          label="Profile freshness"
          value={formatRelativeDate(personality?.last_updated)}
        />
      </div>
    </section>
  );
}

export function PersonalityTimelineCard({
  personality,
}: {
  personality: PersonalityProfile | null;
}) {
  const timeline = buildPersonalityTimeline(personality);

  return (
    <section className="dashboard-card personality-timeline-card">
      <div className="card-eyebrow">Personality Timeline</div>
      {timeline.points.length > 1 ? (
        <>
          <div className="timeline-card-header">
            <div>
              <div className="timeline-card-title">Axis evolution</div>
              <div className="timeline-card-copy">
                Personality drift across saved profile snapshots, ending at the current read.
              </div>
            </div>
            <div className="timeline-version-pill">
              {timeline.points.length} snapshots
            </div>
          </div>

          <div className="timeline-axes">
            {timeline.axes.map((axis) => (
              <div key={axis.label} className="timeline-axis-card">
                <div className="timeline-axis-header">
                  <span className="timeline-axis-label">{axis.label}</span>
                  <span className="timeline-axis-current">{axis.current}</span>
                </div>
                <Sparkline values={axis.values} tone={axis.tone} />
              </div>
            ))}
          </div>

          <div className="timeline-archetypes">
            <div className="timeline-subheading">Archetype evolution</div>
            <div className="timeline-archetype-list">
              {timeline.points.slice(-4).map((point) => (
                <div key={point.key} className="timeline-archetype-item">
                  <div className="timeline-archetype-version">{point.label}</div>
                  <div className="timeline-archetype-type">
                    {point.jungianType ?? "Unclassified"}
                  </div>
                  <div className="timeline-archetype-name">
                    {point.topArchetype?.name
                      ? `${point.topArchetype.name} ${Math.round((point.topArchetype.weight ?? 0) * 100)}%`
                      : "No dominant archetype"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptyInsight copy="The timeline card will become useful once multiple profile snapshots have been saved." />
      )}
    </section>
  );
}

export function ActivityRhythmCard({
  activity,
  cells,
}: {
  activity: ActivityData | null;
  cells: HeatmapCell[];
}) {
  const summary = buildActivitySummary(activity);
  const totalTurns = activity?.total_turns ?? 0;
  const totalSessions = activity?.total_sessions ?? 0;
  const totalInteractions = summary.totalChatTurns + summary.totalVoiceTurns;
  const chatPercent = totalInteractions > 0
    ? Math.round((summary.totalChatTurns / totalInteractions) * 100)
    : 0;
  const voicePercent = totalInteractions > 0
    ? Math.round((summary.totalVoiceTurns / totalInteractions) * 100)
    : 0;

  return (
    <section className="dashboard-card activity-rhythm-card">
      <div className="activity-rhythm-header">
        <div>
          <div className="card-eyebrow">Activity Rhythm</div>
          <div className="activity-rhythm-title">Thirty-five day cadence</div>
          <div className="activity-rhythm-copy">
            {summary.strongestDayTurns > 0
              ? `${summary.strongestDayLabel} with ${summary.strongestDayTurns} turns.`
              : "No consistent rhythm yet."}
          </div>
        </div>
        <div className="activity-rhythm-badge">
          {totalTurns} turns
        </div>
      </div>
      {cells.length > 0 ? (
        <>
          <div className="activity-inline-stats">
            <div className="mini-stat">
              <span className="mini-stat-label">Active days</span>
              <strong className="mini-stat-value">{summary.activeDays}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-label">Sessions</span>
              <strong className="mini-stat-value">{totalSessions}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-label">Avg / active day</span>
              <strong className="mini-stat-value">
                {summary.averageTurnsPerActiveDay.toFixed(1)}
              </strong>
            </div>
          </div>
          <Heatmap cells={cells} />
          <div className="activity-rhythm-footer">
            <span>Chat {chatPercent}%</span>
            <div className="split-bar activity-split-bar" aria-hidden="true">
              <div className="split-bar-segment is-chat" style={{ width: `${chatPercent}%` }} />
              <div className="split-bar-segment is-voice" style={{ width: `${voicePercent}%` }} />
            </div>
            <span>Voice {voicePercent}%</span>
          </div>
        </>
      ) : (
        <EmptyInsight copy="No activity yet. Once sessions start, this heatmap will show rhythm and density." />
      )}
    </section>
  );
}

export function InteractionSplitCard({
  totalChatTurns,
  totalVoiceTurns,
}: {
  totalChatTurns: number;
  totalVoiceTurns: number;
}) {
  const total = totalChatTurns + totalVoiceTurns;
  const chatPercent = total > 0 ? (totalChatTurns / total) * 100 : 0;
  const voicePercent = total > 0 ? (totalVoiceTurns / total) * 100 : 0;

  return (
    <section className="dashboard-card interaction-split-card">
      <div className="card-eyebrow">Interaction Split</div>
      {total > 0 ? (
        <>
          <div className="split-bar">
            <div className="split-bar-segment is-chat" style={{ width: `${chatPercent}%` }} />
            <div className="split-bar-segment is-voice" style={{ width: `${voicePercent}%` }} />
          </div>
          <div className="split-stats">
            <SplitStat label="Chat" value={`${Math.round(chatPercent)}%`} subvalue={`${totalChatTurns} turns`} tone="chat" />
            <SplitStat label="Voice" value={`${Math.round(voicePercent)}%`} subvalue={`${totalVoiceTurns} turns`} tone="voice" />
          </div>
        </>
      ) : (
        <EmptyInsight copy="No interaction mix yet. This card will compare chat and voice usage over time." />
      )}
    </section>
  );
}

export function DiaryPanel({
  diary,
  page,
  expanded = false,
  isBuyingPage,
  onPageChange,
  onBuyPage,
}: {
  diary: DiaryList | null;
  page: number;
  expanded?: boolean;
  isBuyingPage: boolean;
  onPageChange: (nextPage: number) => void;
  onBuyPage: () => void;
}) {
  const featured = diary?.entries[0] ?? null;
  const rest = diary?.entries.slice(1, expanded ? 5 : 3) ?? [];
  const totalPages = diary ? Math.max(1, Math.ceil(diary.total / diary.page_size)) : 1;
  const hasLocked = (diary?.locked_entries ?? 0) > 0;
  const lockedPreview = diary?.locked_previews?.[0] ?? null;

  return (
    <section className={`dashboard-card diary-panel-card${expanded ? " is-expanded" : ""}`}>
      <div className="diary-panel-header">
        <div>
          <div className="card-eyebrow">Companion Diary</div>
          <div className="diary-panel-copy">
            Nightly reflections written from the companion&apos;s point of view.
          </div>
        </div>
        <div className="page-badge">
          {diary?.pages_owned ?? 0} pages unlocked
        </div>
      </div>

      {hasLocked ? (
        <div className="diary-lock-callout">
          <div>
            <div className="diary-lock-title">
              {diary?.locked_entries} locked {diary?.locked_entries === 1 ? "entry" : "entries"}
            </div>
            <div className="diary-lock-copy">
              Purchase the next page to reveal the companion&apos;s hidden reflections.
            </div>
          </div>
          <button
            type="button"
            className="diary-buy-btn"
            onClick={onBuyPage}
            disabled={isBuyingPage}
          >
            {isBuyingPage ? "Unlocking..." : "Unlock next page"}
          </button>
        </div>
      ) : null}

      {featured ? (
        <>
          <div className="diary-panel-grid">
          <article className="diary-featured-entry">
            <div className="diary-featured-meta">
              <span>{formatLongDate(featured.date)}</span>
              <span>Page {featured.page_number}</span>
            </div>
            <p className="diary-featured-copy">{featured.content}</p>
          </article>

          <div className="diary-side-list">
            {rest.length > 0 ? (
              rest.map((entry) => (
                <article key={entry.id} className="diary-side-entry">
                  <div className="diary-side-date">{formatLongDate(entry.date)}</div>
                  <div className="diary-side-copy">{entry.content}</div>
                </article>
              ))
            ) : (
              <div className="diary-side-empty">
                More entries will appear here as nightly diary pages accumulate.
              </div>
            )}

            {lockedPreview ? (
              <LockedDiaryCard preview={lockedPreview} />
            ) : null}
          </div>
          </div>

          <div className="diary-pagination">
            <button
              type="button"
              className="diary-page-btn"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="diary-page-label">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="diary-page-btn"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          {lockedPreview ? <LockedDiaryCard preview={lockedPreview} /> : null}
          <EmptyInsight copy="No diary pages yet. After conversation history builds, the companion will start writing nightly entries here." />
        </>
      )}
    </section>
  );
}

export function RecentMemoriesPanel({
  memories,
  expanded = false,
  savingMemoryIds,
  onFeedback,
}: {
  memories: MemoryItem[];
  expanded?: boolean;
  savingMemoryIds: string[];
  onFeedback: (memoryId: string, feedback: "up" | "down") => void;
}) {
  const visibleMemories = expanded ? memories.slice(0, 10) : memories.slice(0, 4);

  return (
    <section className={`dashboard-card recent-memories-card${expanded ? " is-expanded" : ""}`}>
      <div className="recent-memories-header">
        <div>
          <div className="card-eyebrow">Recent Memories</div>
          <div className="recent-memories-title">What the companion is carrying forward</div>
          <div className="recent-memories-copy">
            Episodic memories, product preferences, and emotionally weighted context from recent sessions.
          </div>
        </div>
        <div className="activity-rhythm-badge">
          {memories.length} saved
        </div>
      </div>
      {memories.length > 0 ? (
        <div className="memory-timeline">
          {visibleMemories.map((memory) => {
            const saving = savingMemoryIds.includes(memory.id);
            const emotionalStrength = Math.max(
              0,
              Math.min(100, Math.round(memory.emotional_weight * 100)),
            );

            return (
              <article key={memory.id} className="memory-timeline-item">
                <div className="memory-timeline-rail">
                  <span className="memory-timeline-dot" />
                </div>
                <div className="memory-timeline-body">
                  <div className="memory-timeline-topline">
                    <div className="memory-chip-row">
                      <span className="memory-chip">{formatMemoryType(memory)}</span>
                      <span className="memory-chip subdued">{formatMemoryDate(memory.created_at)}</span>
                    </div>
                    <div className="memory-feedback">
                      <button
                        type="button"
                        className={`memory-feedback-btn ${memory.feedback === "up" ? "active" : ""}`}
                        onClick={() => onFeedback(memory.id, "up")}
                        disabled={saving}
                        aria-label="Mark memory as useful"
                      >
                        Useful
                      </button>
                      <button
                        type="button"
                        className={`memory-feedback-btn ${memory.feedback === "down" ? "active negative" : ""}`}
                        onClick={() => onFeedback(memory.id, "down")}
                        disabled={saving}
                        aria-label="Mark memory as inaccurate"
                      >
                        Off
                      </button>
                    </div>
                  </div>

                  <div className="memory-timeline-content">{memory.content}</div>

                  <div className="memory-timeline-meta">
                    <span>Tag: {labelOrFallback(memory.tag, "General")}</span>
                    <span>Intensity</span>
                    <div className="emotion-meter">
                      <div className="emotion-meter-fill" style={{ width: `${emotionalStrength}%` }} />
                    </div>
                    <span>{emotionalStrength}%</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyInsight copy="No cold memories have been created yet. Once memory curation runs, meaningful moments will appear as a timeline here." />
      )}
    </section>
  );
}

export function buildHeatmapCells(activity: ActivityData | null, days = 35): HeatmapCell[] {
  if (!activity?.days) return [];

  const today = new Date();
  const dayMap = new Map(activity.days.map((day) => [day.date, day.turn_count]));
  const cells: HeatmapCell[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const iso = date.toISOString().split("T")[0];
    const turns = dayMap.get(iso) ?? 0;

    cells.push({
      date: iso,
      turns,
      level: getActivityLevel(turns),
    });
  }

  return cells;
}

export function buildActivitySummary(activity: ActivityData | null): ActivitySummary {
  const days = activity?.days ?? [];
  const strongestDay = days.reduce<DayActivity | null>((maxDay, currentDay) => {
    if (!maxDay || currentDay.turn_count > maxDay.turn_count) {
      return currentDay;
    }
    return maxDay;
  }, null);

  const totalChatTurns = days.reduce((sum, day) => sum + day.chat_turns, 0);
  const totalVoiceTurns = days.reduce((sum, day) => sum + day.voice_turns, 0);
  const activeDays = days.filter((day) => day.turn_count > 0).length;
  const averageTurnsPerActiveDay =
    activeDays > 0
      ? days.reduce((sum, day) => sum + day.turn_count, 0) / activeDays
      : 0;

  return {
    strongestDayLabel: strongestDay
      ? `${formatLongDate(strongestDay.date)} was the busiest`
      : "No strong activity day yet",
    strongestDayTurns: strongestDay?.turn_count ?? 0,
    activeDays,
    totalChatTurns,
    totalVoiceTurns,
    averageTurnsPerActiveDay,
  };
}

function ConfidenceRing({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(1, value));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized);

  return (
    <div className="confidence-ring">
      <svg viewBox="0 0 84 84" className="confidence-ring-svg" aria-hidden="true">
        <circle className="confidence-ring-track" cx="42" cy="42" r={radius} />
        <circle
          className="confidence-ring-progress"
          cx="42"
          cy="42"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="confidence-ring-label">
        <strong>{Math.round(normalized * 100)}%</strong>
        <span>confidence</span>
      </div>
    </div>
  );
}

function TraitRadar({ traits }: { traits: TraitEntry[] }) {
  if (traits.length === 0) {
    return <EmptyInsight copy="Trait radar will appear once the profile has enough weighty signals." compact />;
  }

  const size = 260;
  const center = size / 2;
  const radius = 84;
  const levels = [0.25, 0.5, 0.75, 1];
  const polygon = traits
    .map((trait, index) => {
      const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
      const pointRadius = radius * Math.max(0.12, trait.weight);
      return `${center + Math.cos(angle) * pointRadius},${center + Math.sin(angle) * pointRadius}`;
    })
    .join(" ");

  return (
    <div className="trait-radar">
      <svg viewBox={`0 0 ${size} ${size}`} className="trait-radar-svg">
        {levels.map((level) => (
          <polygon
            key={level}
            className="trait-radar-grid"
            points={traits
              .map((_, index) => {
                const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
                return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
              })
              .join(" ")}
          />
        ))}

        {traits.map((trait, index) => {
          const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
          return (
            <line
              key={trait.name}
              className="trait-radar-axis"
              x1={center}
              y1={center}
              x2={center + Math.cos(angle) * radius}
              y2={center + Math.sin(angle) * radius}
            />
          );
        })}

        <polygon className="trait-radar-shape" points={polygon} />

        {traits.map((trait, index) => {
          const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
          const labelRadius = radius + 26;
          return (
            <text
              key={`${trait.name}-label`}
              className="trait-radar-label"
              x={center + Math.cos(angle) * labelRadius}
              y={center + Math.sin(angle) * labelRadius}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {titleize(trait.name)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TraitDriftChart({
  series,
}: {
  series: Array<{ name: string; values: number[] }>;
}) {
  if (series.length === 0 || series[0].values.length < 2) {
    return (
      <EmptyInsight
        copy="Versioned profile history will turn into a drift chart once more snapshots are available."
        compact
      />
    );
  }

  const width = 360;
  const height = 150;
  const padding = 18;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const pointCount = series[0].values.length;

  return (
    <div className="drift-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="drift-chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((level) => {
          const y = padding + plotHeight - level * plotHeight;
          return (
            <line
              key={level}
              className="drift-grid-line"
              x1={padding}
              y1={y}
              x2={padding + plotWidth}
              y2={y}
            />
          );
        })}

        {series.map((item, index) => {
          const points = item.values
            .map((value, valueIndex) => {
              const x =
                padding +
                (pointCount === 1 ? 0 : (plotWidth * valueIndex) / (pointCount - 1));
              const y = padding + plotHeight - value * plotHeight;
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <polyline
              key={item.name}
              className={`drift-line tone-${index % 4}`}
              points={points}
            />
          );
        })}
      </svg>
      <div className="drift-legend">
        {series.map((item, index) => (
          <span key={item.name} className={`drift-legend-item tone-${index % 4}`}>
            {titleize(item.name)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone: string;
}) {
  const width = 180;
  const height = 56;
  const padding = 6;
  const points = values
    .map((value, index) => {
      const x = padding + ((width - padding * 2) * index) / Math.max(values.length - 1, 1);
      const y = padding + (height - padding * 2) * (1 - value);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`timeline-sparkline ${tone}`}>
      <polyline className="timeline-sparkline-line" points={points} />
    </svg>
  );
}

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const weeks = chunkHeatmapWeeks(cells);
  const monthLabels = weeks.map((week, index) => {
    const firstCell = week.find((cell) => cell !== null);
    const previousLabel =
      index > 0
        ? weeks[index - 1].find((cell) => cell !== null)?.date.slice(0, 7)
        : null;
    const currentLabel = firstCell?.date.slice(0, 7) ?? null;

    return currentLabel && currentLabel !== previousLabel && firstCell
      ? formatMonthLabel(firstCell.date)
      : "";
  });

  return (
    <div className="activity-heatmap-wrap">
      <div className="activity-heatmap-months">
        <span />
        <div className="activity-heatmap-month-labels">
          {monthLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      </div>
      <div className="activity-weekday-labels">
        <span>Mon</span>
        <span>Wed</span>
        <span>Fri</span>
      </div>
      <div className="activity-heatmap-grid">
        {weeks.flat().map((cell, index) =>
          cell ? (
            <div
              key={cell.date}
              className={`activity-cell level-${cell.level}`}
              title={`${formatLongDate(cell.date)} · ${cell.turns} turns`}
            />
          ) : (
            <div key={`empty-${index}`} className="activity-cell activity-cell-empty" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}

function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="stat-strip">
      {items.map((item) => (
        <div key={item.label} className="stat-strip-item">
          <span className="stat-strip-label">{item.label}</span>
          <strong className="stat-strip-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function LensMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="lens-metric">
      <span className="lens-metric-label">{label}</span>
      <span className="lens-metric-value">{value}</span>
    </div>
  );
}

function SplitStat({
  label,
  value,
  subvalue,
  tone,
}: {
  label: string;
  value: string;
  subvalue: string;
  tone: "chat" | "voice";
}) {
  return (
    <div className={`split-stat split-stat-${tone}`}>
      <span className="split-stat-label">{label}</span>
      <strong className="split-stat-value">{value}</strong>
      <span className="split-stat-subvalue">{subvalue}</span>
    </div>
  );
}

function LockedDiaryCard({ preview }: { preview: LockedDiaryPreview }) {
  return (
    <article className="locked-diary-card">
      <div className="locked-diary-header">
        <span>Locked page</span>
        <span>Page {preview.page_number}</span>
      </div>
      <div className="locked-diary-date">{formatLongDate(preview.date)}</div>
      <div className="locked-diary-preview">{preview.preview}</div>
    </article>
  );
}

function EmptyInsight({
  copy,
  compact = false,
}: {
  copy: string;
  compact?: boolean;
}) {
  return <div className={`dashboard-empty-state ${compact ? "compact" : ""}`}>{copy}</div>;
}

function buildCompanionSummary(personality: PersonalityProfile | null): string {
  if (!personality?.jungian_type) {
    return "The companion has not seen enough behavior yet to make a strong read. More sessions will turn this into a sharper psychological snapshot.";
  }

  const typePart = `${personality.jungian_type} tendencies are leading right now`;
  const attachmentPart = personality.attachment_style
    ? ` with a ${titleize(personality.attachment_style)} relational style`
    : "";
  const thinkingPart = personality.cognitive_style
    ? ` and a ${titleize(personality.cognitive_style)} way of processing problems`
    : "";

  return `${typePart}${attachmentPart}${thinkingPart}.`;
}

function labelOrFallback(value: string | null | undefined, fallback: string): string {
  return value ? titleize(value) : fallback;
}

function titleize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(value?: string | Date | null): string {
  if (!value) return "Not updated yet";
  const target = new Date(value);
  const diff = Date.now() - target.getTime();
  const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));

  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function formatMemoryType(memory: MemoryItem): string {
  if (memory.subtype) return titleize(memory.subtype);
  if (memory.tag) return titleize(memory.tag);
  return "Memory";
}

function formatMemoryDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getActivityLevel(turns: number): number {
  if (turns === 0) return 0;
  if (turns <= 4) return 1;
  if (turns <= 10) return 2;
  if (turns <= 20) return 3;
  return 4;
}

function chunkHeatmapWeeks(cells: HeatmapCell[]): Array<Array<HeatmapCell | null>> {
  const weeks: Array<Array<HeatmapCell | null>> = [];

  for (let index = 0; index < cells.length; index += 7) {
    const week: Array<HeatmapCell | null> = cells.slice(index, index + 7);
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  return weeks;
}

function formatMonthLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short" });
}

function buildDriftSeries(
  personality: PersonalityProfile | null,
  topTraits: TraitEntry[],
): Array<{ name: string; values: number[] }> {
  if (!personality || topTraits.length === 0) return [];

  const history = personality.history ?? [];
  const snapshots = history.slice(-5).map((snapshot) => snapshot.weights);
  const currentWeights = personality.trait_weights;
  const timeline = [...snapshots, currentWeights];

  return topTraits.slice(0, 4).map((trait) => ({
    name: trait.name,
    values: timeline.map((weights) => {
      const value = weights[trait.name] ?? 0;
      return Math.max(0, Math.min(1, value));
    }),
  }));
}

function buildPersonalityTimeline(personality: PersonalityProfile | null) {
  if (!personality) {
    return { points: [], axes: [] as Array<{ label: string; values: number[]; current: string; tone: string }> };
  }

  const points = [...(personality.history ?? []).slice(-5), {
    version: personality.version,
    timestamp: personality.last_updated,
    weights: personality.trait_weights,
    jungian_type: personality.jungian_type,
    archetypes: personality.archetypes,
  }].map((snapshot, index, all) => ({
    key: `${snapshot.version}-${snapshot.timestamp ?? index}`,
    label: index === all.length - 1 ? "Now" : `v${snapshot.version}`,
    weights: snapshot.weights,
    jungianType: snapshot.jungian_type,
    topArchetype: [...(snapshot.archetypes ?? [])]
      .sort((left, right) => (Number(right.weight ?? 0) - Number(left.weight ?? 0)))[0] ?? null,
  }));

  const axes = [
    {
      label: "I / E",
      tone: "tone-rose",
      values: points.map((point) => normalizeAxis(point.weights.introversion ?? 0, point.weights.extraversion ?? 0)),
      current: dominantPole("Introversion", "Extraversion", personality.trait_weights.introversion ?? 0, personality.trait_weights.extraversion ?? 0),
    },
    {
      label: "N / S",
      tone: "tone-ice",
      values: points.map((point) => normalizeAxis(point.weights.intuition ?? 0, point.weights.sensing ?? 0)),
      current: dominantPole("Intuition", "Sensing", personality.trait_weights.intuition ?? 0, personality.trait_weights.sensing ?? 0),
    },
    {
      label: "F / T",
      tone: "tone-ember",
      values: points.map((point) => normalizeAxis(point.weights.feeling ?? 0, point.weights.thinking ?? 0)),
      current: dominantPole("Feeling", "Thinking", personality.trait_weights.feeling ?? 0, personality.trait_weights.thinking ?? 0),
    },
    {
      label: "J / P",
      tone: "tone-lilac",
      values: points.map((point) => normalizeAxis(point.weights.judging ?? 0, point.weights.perceiving ?? 0)),
      current: dominantPole("Judging", "Perceiving", personality.trait_weights.judging ?? 0, personality.trait_weights.perceiving ?? 0),
    },
  ];

  return { points, axes };
}

function normalizeAxis(left: number, right: number): number {
  const total = left + right;
  if (total === 0) return 0.5;
  return left / total;
}

function dominantPole(leftLabel: string, rightLabel: string, left: number, right: number): string {
  if (left === 0 && right === 0) return "Balanced";
  return left >= right ? leftLabel : rightLabel;
}
