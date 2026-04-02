"use client";

import { useEffect, useState } from "react";
import {
  buyDiaryPage,
  getBalance,
  getTraits,
  updateActiveTraits,
  type CoinBalance,
  type TraitItem,
  type TraitLibrary,
} from "@/lib/api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function SettingsPage() {
  const [traits, setTraits] = useState<TraitLibrary | null>(null);
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [buying, setBuying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [traitResponse, balanceResponse] = await Promise.all([
          getTraits(),
          getBalance(),
        ]);

        setTraits(traitResponse);
        setBalance(balanceResponse);
        setActiveIds(traitResponse.active_trait_ids);
      } catch (loadError) {
        console.error("Settings load error:", loadError);
        setError("Unable to load settings right now.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function toggleTrait(name: string) {
    const previous = activeIds;
    const next = activeIds.includes(name)
      ? activeIds.filter((id) => id !== name)
      : [...activeIds, name];

    setActiveIds(next);
    setSaving(true);
    setError(null);

    try {
      await updateActiveTraits(next);
    } catch (toggleError) {
      console.error("Failed to update traits:", toggleError);
      setActiveIds(previous);
      setError(getErrorMessage(toggleError, "Saving persona traits failed."));
    } finally {
      setSaving(false);
    }
  }

  async function handleBuyPage() {
    setBuying(true);
    setError(null);

    try {
      const result = await buyDiaryPage();
      setBalance((previous) =>
        previous
          ? {
              ...previous,
              total_coins: result.remaining_coins,
              diary_pages_owned: result.diary_pages_owned,
            }
          : previous,
      );
    } catch (buyError) {
      console.error("Failed to buy diary page:", buyError);
      setError(getErrorMessage(buyError, "Not enough coins to unlock a diary page."));
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="dashboard-loading-shell">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error && !traits && !balance) {
    return (
      <div className="settings-page">
        <div className="dashboard-loading-shell">
          <div className="dashboard-empty-state">
            <strong>Settings unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const categories = buildTraitCategories(traits?.traits ?? []);
  const earnProgress = balance?.daily_cap
    ? Math.min(100, Math.round(((balance?.daily_earned_today ?? 0) / balance.daily_cap) * 100))
    : 0;

  return (
    <div className="settings-page">
      <div className="settings-experience">
        <section className="settings-hero">
          <div className="dashboard-kicker">Settings</div>
          <h1>Shape the companion, the diary, and the economy around it.</h1>
          <p>
            This is where persona traits, diary unlocks, and your current coin balance
            sit inside the same visual language as the dashboard.
          </p>
        </section>

        {error ? (
          <div className="page-inline-error">
            <strong>Settings update issue</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <section className="settings-grid">
          <article className="dashboard-panel settings-balance-panel">
            <div className="dashboard-section-kicker">Coin Balance</div>
            <h2>{balance?.total_coins ?? 0} coins</h2>
            <p>
              Your coin ledger controls diary unlocks and other collectible companion
              experiences.
            </p>

            <div className="settings-progress-block">
              <div className="settings-progress-head">
                <span>Earned today</span>
                <strong>
                  {balance?.daily_earned_today ?? 0} / {balance?.daily_cap ?? 100}
                </strong>
              </div>
              <div className="settings-progress-track" aria-hidden="true">
                <div
                  className="settings-progress-fill"
                  style={{ width: `${earnProgress}%` }}
                />
              </div>
            </div>

            <div className="settings-balance-detail">
              <span>Diary pages owned</span>
              <strong>{balance?.diary_pages_owned ?? 0}</strong>
            </div>
          </article>

          <article className="dashboard-panel settings-diary-panel">
            <div className="dashboard-section-kicker">Diary Unlocks</div>
            <h2>Open the next private page</h2>
            <p>
              Each purchase reveals one more diary page written from the companion&apos;s
              point of view.
            </p>

            <div className="settings-price-tag">50 coins per page</div>

            <button
              type="button"
              className="dashboard-solid-button"
              onClick={() => {
                void handleBuyPage();
              }}
              disabled={buying || (balance?.total_coins ?? 0) < 50}
            >
              {buying ? "Unlocking..." : "Buy next diary page"}
            </button>
          </article>
        </section>

        <section className="dashboard-panel settings-traits-panel">
          <div className="settings-traits-head">
            <div>
              <div className="dashboard-section-kicker">Persona Traits</div>
              <h2>Choose the active traits shaping the companion voice.</h2>
            </div>
            {saving ? <span className="settings-saving-pill">Saving...</span> : null}
          </div>

          <div className="settings-category-list">
            {categories.map(([category, traitList]) => (
              <article key={category} className="settings-category-card">
                <div className="settings-category-label">{category}</div>
                <div className="settings-trait-grid">
                  {traitList.map((trait) => {
                    const isActive = activeIds.includes(trait.name);
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        className={`settings-trait-chip${isActive ? " active" : ""}${
                          trait.locked ? " locked" : ""
                        }`}
                        onClick={() => {
                          if (!trait.locked) {
                            void toggleTrait(trait.name);
                          }
                        }}
                        disabled={trait.locked}
                      >
                        <span>{trait.name}</span>
                        <small>
                          {trait.locked
                            ? `${trait.coin_cost}c locked`
                            : isActive
                              ? "active"
                              : trait.coin_cost > 0
                                ? `${trait.coin_cost}c`
                                : "free"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildTraitCategories(traits: TraitItem[]) {
  const grouped = new Map<string, TraitItem[]>();

  traits.forEach((trait) => {
    const current = grouped.get(trait.category) ?? [];
    current.push(trait);
    grouped.set(trait.category, current);
  });

  return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
}
