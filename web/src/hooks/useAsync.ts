import { useState, useEffect } from 'react';

type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Универсальный hook для асинхронных операций
 * Управляет состоянием загрузки, данными и ошибками
 * 
 * @param asyncFn - Асинхронная функция для выполнения
 * @param deps - Зависимости для повторного выполнения
 * @returns Состояние с данными, загрузкой, ошибкой и функцией refetch
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error, refetch: execute };
}
