"use client";

import { useEffect, useState } from "react";
import {
  buyDiaryPage,
  getDiary,
  type DiaryEntry,
  type DiaryList,
} from "@/lib/api";
import { DiaryExperience } from "../dashboard/dashboard-experience";

const PAGE_SIZE = 4;

export default function DiaryPage() {
  const [diary, setDiary] = useState<DiaryList | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loadedPages, setLoadedPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [buyingPage, setBuyingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshDiary(1);
  }, []);

  async function refreshDiary(pageCount: number) {
    try {
      setError(null);

      const responses = await Promise.all(
        Array.from({ length: pageCount }, (_, index) => getDiary(index + 1, PAGE_SIZE)),
      );

      const [firstResponse] = responses;
      const mergedEntries = dedupeEntries(
        responses.flatMap((response) => response.entries),
      );

      setDiary(firstResponse ? { ...firstResponse, entries: mergedEntries } : null);
      setEntries(mergedEntries);
      setLoadedPages(pageCount);
    } catch (loadError) {
      console.error("Diary load error:", loadError);
      setError("Unable to load the diary right now.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleLoadMore() {
    const nextPage = loadedPages + 1;
    setLoadingMore(true);
    await refreshDiary(nextPage);
  }

  async function handleBuyPage() {
    setBuyingPage(true);
    try {
      await buyDiaryPage();
      await refreshDiary(loadedPages);
    } catch (buyError) {
      console.error("Diary purchase error:", buyError);
      setError("Unlocking the next diary page failed.");
    } finally {
      setBuyingPage(false);
    }
  }

  if (loading) {
    return (
      <div className="diary-page">
        <div className="dashboard-loading-shell">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error && !diary) {
    return (
      <div className="diary-page">
        <div className="dashboard-loading-shell">
          <div className="dashboard-empty-state">
            <strong>Diary unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="diary-page">
      {error ? (
        <div className="page-inline-error">
          <strong>Diary update issue</strong>
          <p>{error}</p>
        </div>
      ) : null}
      <DiaryExperience
        diary={diary}
        entries={entries}
        hasMore={Boolean(diary && entries.length < diary.total)}
        isLoadingMore={loadingMore}
        isBuyingPage={buyingPage}
        onLoadMore={() => {
          void handleLoadMore();
        }}
        onBuyPage={() => {
          void handleBuyPage();
        }}
      />
    </div>
  );
}

function dedupeEntries(items: DiaryEntry[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}
