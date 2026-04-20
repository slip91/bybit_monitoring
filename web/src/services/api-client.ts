const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Базовая функция для HTTP запросов к API
 * Автоматически обрабатывает ошибки и парсит JSON
 * 
 * @param path - Путь к endpoint (например, '/bots')
 * @param init - Опции fetch (method, body, headers)
 * @returns Promise с типизированным ответом
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    // Извлекаем сообщение об ошибке из разных форматов ответа
    const message =
      (typeof json?.message === 'string' && json.message) ||
      (Array.isArray(json?.message) && json.message.filter((item: unknown) => typeof item === 'string').join(', ')) ||
      (typeof json?.error?.message === 'string' && json.error.message) ||
      (typeof json?.error === 'string' && json.error) ||
      `Ошибка запроса: ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}
