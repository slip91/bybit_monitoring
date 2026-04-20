import type { ApiResponse, BotListItem, BotDetails, BotSnapshot, BotMarketChart } from '../lib/types';
import { request } from './api-client';

export const botsService = {
  async getAll() {
    return request<ApiResponse<BotListItem[]>>('/bots');
  },

  async getById(botId: string) {
    return request<ApiResponse<BotDetails>>(`/bots/${encodeURIComponent(botId)}`);
  },

  async getSnapshots(botId: string) {
    return request<ApiResponse<BotSnapshot[]>>(`/bots/${encodeURIComponent(botId)}/snapshots`);
  },

  async getMarketChart(
    botId: string,
    options?: {
      interval?: '15' | '60' | '240' | 'D' | 'W';
      range?: '24h' | '7d' | '30d' | '90d' | '1y' | 'lifetime';
      priceSource?: 'market' | 'mark' | 'index';
    }
  ) {
    const search = new URLSearchParams();
    if (options?.interval) search.set('interval', options.interval);
    if (options?.range) search.set('range', options.range);
    if (options?.priceSource) search.set('priceSource', options.priceSource);

    const suffix = search.size ? `?${search.toString()}` : '';
    return request<ApiResponse<BotMarketChart>>(`/bots/${encodeURIComponent(botId)}/market-chart${suffix}`);
  },
};
