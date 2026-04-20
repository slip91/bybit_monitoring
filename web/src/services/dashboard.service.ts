import type { ApiResponse, DashboardSummary, AlertItem } from '../lib/types';
import { request } from './api-client';

export const dashboardService = {
  async getSummary() {
    return request<ApiResponse<DashboardSummary>>('/dashboard/summary');
  },

  async getAlerts(limit = 6) {
    return request<ApiResponse<AlertItem[]>>(`/alerts?limit=${limit}`);
  },
};
