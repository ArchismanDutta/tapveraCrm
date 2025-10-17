// File: src/hooks/useDiwaliWelcome.ts
import { useState, useEffect } from "react";

const DIWALI_END_DATE = new Date("2025-11-03T23:59:59"); // Monday, Nov 3, 2025 (Diwali 2025)

export const useDiwaliWelcome = (uniqueKey = "default") => {
  const [showDiwali, setShowDiwali] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create dashboard-specific key
  const DIWALI_DISMISSED_KEY = `diwali_welcome_dismissed_2025_${uniqueKey}`;

  useEffect(() => {
    const checkDiwaliVisibility = () => {
      const currentDate = new Date();

      // Check if current date is before the end date (Monday night)
      const isBeforeEndDate = currentDate <= DIWALI_END_DATE;

      // Check if user has dismissed it for this session
      const dismissed = sessionStorage.getItem(DIWALI_DISMISSED_KEY);

      // Debug logging
      console.log("[Diwali Welcome] Current Date:", currentDate);
      console.log("[Diwali Welcome] End Date:", DIWALI_END_DATE);
      console.log("[Diwali Welcome] Is Before End Date:", isBeforeEndDate);
      console.log("[Diwali Welcome] Dismissed:", dismissed);
      console.log("[Diwali Welcome] Will Show:", isBeforeEndDate && !dismissed);

      // Show if before end date and not dismissed
      setShowDiwali(isBeforeEndDate && !dismissed);
      setLoading(false);
    };

    checkDiwaliVisibility();
  }, [DIWALI_DISMISSED_KEY]);

  const dismissDiwali = () => {
    sessionStorage.setItem(DIWALI_DISMISSED_KEY, "true");
    setShowDiwali(false);
  };

  return {
    showDiwali,
    dismissDiwali,
    loading,
  };
};

export default useDiwaliWelcome;
