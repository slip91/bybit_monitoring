import { dashboardService } from '../services/dashboard.service';
import { useAsync } from './useAsync';

export function useDashboardSummary() {
  return useAsync(async () => {
    const response = await dashboardService.getSummary();
    return response.data;
  }, []);
}

export function useAlerts(limit = 6) {
  return useAsync(async () => {
    const response = await dashboardService.getAlerts(limit);
    return response.data;
  }, [limit]);
}
