"use client";

import { useEffect, useState } from "react";
import {
  getActivity,
  getPersonality,
  type ActivityData,
  type PersonalityProfile,
} from "@/lib/api";
import { DashboardExperience } from "./dashboard-experience";

export default function DashboardPage() {
  const [personality, setPersonality] = useState<PersonalityProfile | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [personalityResponse, activityResponse] = await Promise.all([
          getPersonality(),
          getActivity(35),
        ]);

        setPersonality(personalityResponse);
        setActivity(activityResponse);
      } catch (loadError) {
        console.error("Dashboard load error:", loadError);
        setError("Unable to load the new dashboard right now.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading-shell">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading-shell">
          <div className="dashboard-empty-state">
            <strong>Dashboard unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <DashboardExperience personality={personality} activity={activity} />
    </div>
  );
}
