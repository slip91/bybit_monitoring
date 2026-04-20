import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@components/layout";
import { BotPage } from "@pages/BotPage";
import { AlertSettingsPage } from "@pages/AlertSettingsPage";
import { DashboardPage } from "@pages/DashboardPage";
import { ClosedBotsPage } from "@pages/ClosedBotsPage";
import { PeriodSummaryPage } from "@pages/PeriodSummaryPage";
import { PlanPage } from "@features/plan/PlanPage";
import { ServicePage } from "@pages/ServicePage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/summary/period" element={<PeriodSummaryPage />} />
        <Route path="/history/closed-bots" element={<ClosedBotsPage />} />
        <Route path="/service" element={<ServicePage />} />
        <Route path="/bots/:botId" element={<BotPage />} />
        <Route path="/settings/alerts" element={<AlertSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
