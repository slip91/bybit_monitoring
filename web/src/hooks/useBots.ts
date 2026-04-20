import { botsService } from '../services/bots.service';
import { useAsync } from './useAsync';

export function useBots() {
  return useAsync(async () => {
    const response = await botsService.getAll();
    return response.data;
  }, []);
}

export function useBot(botId: string) {
  return useAsync(async () => {
    const response = await botsService.getById(botId);
    return response.data;
  }, [botId]);
}

export function useBotSnapshots(botId: string) {
  return useAsync(async () => {
    const response = await botsService.getSnapshots(botId);
    return response.data;
  }, [botId]);
}

export function useBotMarketChart(
  botId: string,
  options?: Parameters<typeof botsService.getMarketChart>[1]
) {
  return useAsync(async () => {
    const response = await botsService.getMarketChart(botId, options);
    return response.data;
  }, [botId, JSON.stringify(options)]);
}
