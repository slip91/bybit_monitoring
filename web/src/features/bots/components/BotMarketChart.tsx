import { useEffect, useMemo, useRef, useState } from "react";

import type { CandlestickData, LineStyle, LineWidth } from "lightweight-charts";
import type { BotMarketChart } from "../../../lib/types";
import { toErrorMessage } from "../../../lib/format";
import { cn, ui } from "../../../lib/ui";

type BotMarketChartProps = {
  data: BotMarketChart;
  totalPnl: number | null;
  gridProfit: number | null;
};

export function BotMarketChart({ data, totalPnl, gridProfit }: BotMarketChartProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const gridLevels = useMemo(() => buildApproximateGridLevels(data), [data]);
  const summary = useMemo(() => buildPriceSummary(data, totalPnl, gridProfit), [data, totalPnl, gridProfit]);

  useEffect(() => {
    if (!containerRef.current || data.candles.length === 0) {
      return;
    }

    let disposed = false;
    let cleanupResize = () => {};
    let chartApi: { remove: () => void; applyOptions: (options: { width: number; height: number }) => void } | null = null;

    void import("lightweight-charts")
      .then((mod) => {
        if (disposed || !containerRef.current) {
          return;
        }

        const container = containerRef.current;
        const chart = mod.createChart(container, {
          layout: {
            background: { color: "#11161f" },
            textColor: "#b7c0cd",
            attributionLogo: false,
          },
          grid: {
            vertLines: { color: "rgba(183, 192, 205, 0.06)" },
            horzLines: { color: "rgba(183, 192, 205, 0.08)" },
          },
          crosshair: {
            vertLine: { color: "rgba(88, 166, 255, 0.35)" },
            horzLine: { color: "rgba(88, 166, 255, 0.25)" },
          },
          rightPriceScale: {
            borderColor: "rgba(183, 192, 205, 0.18)",
          },
          timeScale: {
            borderColor: "rgba(183, 192, 205, 0.18)",
            timeVisible: true,
            secondsVisible: false,
          },
          width: container.clientWidth,
          height: calculateChartHeight(container, false),
        });
        chartApi = chart;

        const series = chart.addSeries(mod.CandlestickSeries, {
          upColor: "#22ab94",
          downColor: "#f7525f",
          wickUpColor: "#22ab94",
          wickDownColor: "#f7525f",
          borderVisible: false,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: "right",
        });

        series.setData(data.candles as CandlestickData[]);

        attachPriceLine(series, data.overlays.lowerRangePrice, {
          title: "Lower",
          color: "#ff9d4d",
          lineWidth: 1 as LineWidth,
          lineStyle: mod.LineStyle.Dashed,
        });
        attachPriceLine(series, data.overlays.upperRangePrice, {
          title: "Upper",
          color: "#ff9d4d",
          lineWidth: 1 as LineWidth,
          lineStyle: mod.LineStyle.Dashed,
        });
        attachPriceLine(series, data.overlays.entryPrice, {
          title: "Entry",
          color: "#58a6ff",
          lineWidth: 2 as LineWidth,
          lineStyle: mod.LineStyle.Solid,
        });
        attachPriceLine(series, data.overlays.currentPrice, {
          title: "Now",
          color: "#7ee787",
          lineWidth: 2 as LineWidth,
          lineStyle: mod.LineStyle.Solid,
        });
        attachPriceLine(series, data.overlays.takeProfitPrice, {
          title: "TP",
          color: "#ffd866",
          lineWidth: 2 as LineWidth,
          lineStyle: mod.LineStyle.Dashed,
        });
        attachPriceLine(series, data.overlays.stopLossPrice, {
          title: "SL",
          color: "#ff6b81",
          lineWidth: 2 as LineWidth,
          lineStyle: mod.LineStyle.Dashed,
        });

        for (const level of gridLevels) {
          attachPriceLine(series, level, {
            title: "",
            color: "rgba(183, 192, 205, 0.18)",
            lineWidth: 1 as LineWidth,
            lineStyle: mod.LineStyle.Dotted,
          });
        }

        chart.timeScale().fitContent();

        const resize = () => {
          if (!containerRef.current || !chartApi) {
            return;
          }

          chartApi.applyOptions({
            width: containerRef.current.clientWidth,
            height: calculateChartHeight(containerRef.current, document.fullscreenElement === panelRef.current),
          });
        };

        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => resize());
          observer.observe(container);
          cleanupResize = () => observer.disconnect();
        } else {
          window.addEventListener("resize", resize);
          cleanupResize = () => window.removeEventListener("resize", resize);
        }
      })
      .catch((error) => {
        if (!disposed) {
          setChartError(toErrorMessage(error));
        }
      });

    return () => {
      disposed = true;
      cleanupResize();
      chartApi?.remove();
    };
  }, [data, gridLevels]);

  return (
    <div className="grid gap-4">
      <div ref={panelRef} className={cn("rounded-[24px] border border-[rgba(180,217,236,0.12)] bg-[rgba(255,255,255,0.02)] p-4", isFullscreen && "min-h-screen rounded-none border-none bg-[#07131d] p-6")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <strong>График цены</strong>
            <span className={ui.sectionCount()}>{isFullscreen ? "Полноэкранный режим" : "Обычный режим"}</span>
          </div>
          <button type="button" className={ui.button({ tone: "ghost" })} onClick={() => void toggleFullscreen(panelRef.current)}>
            {isFullscreen ? "Свернуть" : "Во весь экран"}
          </button>
        </div>
        {data.candles.length === 0 ? (
          <div className={ui.emptyState()}>История цены пока недоступна.</div>
        ) : chartError ? (
          <div className={ui.emptyState()}>Не удалось инициализировать график: {chartError}</div>
        ) : (
          <div ref={containerRef} className="min-h-[460px] rounded-[18px]" />
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          <span>Рыночная цена</span>
          <span>Entry</span>
          <span>Нижняя / верхняя граница</span>
          {data.overlays.takeProfitPrice !== null && <span>Take profit</span>}
          {data.overlays.stopLossPrice !== null && <span>Stop loss</span>}
          {gridLevels.length > 0 && <span>Approx уровни сетки</span>}
          {data.priceSource !== "market" && <span>{data.priceSource}</span>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <article key={item.title} className={ui.card({ subtle: true })}>
            <div className="grid gap-2">
              <strong className="text-sm">{item.title}</strong>
              <span className="text-sm leading-6 text-[var(--color-text-muted)]">{item.value}</span>
            </div>
          </article>
        ))}
        <article className={cn(ui.card({ subtle: true }), "md:col-span-2 xl:col-span-4")}>
          <div className="grid gap-2">
            <strong className="text-sm">Как читать</strong>
            <span className="text-sm leading-6 text-[var(--color-text-muted)]">
              Рыночная цена, диапазон сетки и approximate уровни показаны отдельно от расчетных метрик бота. Approx уровни
              не симулируют точные ордера Bybit. Если на боте выставлены take profit или stop loss, они тоже
              показываются как отдельные уровни.
            </span>
          </div>
        </article>
      </div>
    </div>
  );
}

function attachPriceLine(
  series: {
    createPriceLine: (options: {
      price: number;
      color: string;
      lineWidth: LineWidth;
      lineStyle: LineStyle;
      axisLabelVisible: boolean;
      title: string;
    }) => unknown;
  },
  price: number | null,
  options: {
    title: string;
    color: string;
    lineWidth: LineWidth;
    lineStyle: LineStyle;
  },
) {
  if (price === null || !Number.isFinite(price)) {
    return;
  }

  series.createPriceLine({
    price,
    color: options.color,
    lineWidth: options.lineWidth,
    lineStyle: options.lineStyle,
    axisLabelVisible: true,
    title: options.title,
  });
}

function buildApproximateGridLevels(data: BotMarketChart) {
  const lower = data.overlays.lowerRangePrice;
  const upper = data.overlays.upperRangePrice;
  const count = data.grid.count;

  if (lower === null || upper === null || count === null || count < 2 || upper <= lower) {
    return [];
  }

  const levels: Array<number> = [];
  const intervals = Math.max(1, Math.round(count) - 1);

  const step = (upper - lower) / intervals;
  for (let index = 1; index < intervals; index += 1) {
    levels.push(lower + step * index);
  }

  return levels.length > 24 ? levels.filter((_, index) => index % Math.ceil(levels.length / 24) === 0) : levels;
}

function calculateChartHeight(container: HTMLElement, fullscreen: boolean) {
  if (!fullscreen) {
    return 460;
  }

  return Math.max(520, Math.min(window.innerHeight - 140, 900));
}

async function toggleFullscreen(element: HTMLElement | null) {
  if (!element || typeof element.requestFullscreen !== "function") {
    return;
  }

  if (document.fullscreenElement === element) {
    await document.exitFullscreen?.();
    return;
  }

  await element.requestFullscreen();
}

function buildPriceSummary(data: BotMarketChart, totalPnl: number | null, gridProfit: number | null) {
  const current = data.overlays.currentPrice;
  const entry = data.overlays.entryPrice;
  const lower = data.overlays.lowerRangePrice;
  const upper = data.overlays.upperRangePrice;

  return [
    {
      title: "Относительно входа",
      value:
        current === null || entry === null
          ? "Недостаточно данных"
          : current > entry
            ? `Цена выше входа на ${formatDelta(((current - entry) / entry) * 100)}`
            : current < entry
              ? `Цена ниже входа на ${formatDelta(((entry - current) / entry) * 100)}`
              : "Цена около входа",
    },
    {
      title: "Положение в диапазоне",
      value: describeRangePosition(current, lower, upper),
    },
    {
      title: "Комфорт зоны",
      value: describeComfortZone(current, lower, upper),
    },
    {
      title: "Почему PnL расходится",
      value:
        gridProfit !== null && gridProfit > 0 && totalPnl !== null && totalPnl < 0
          ? "Сетка зарабатывает, но позиционная часть ниже входа и тянет total pnl вниз"
          : "Grid profit и total pnl совпадают по знаку или данных пока мало",
    },
  ];
}

function describeRangePosition(current: number | null, lower: number | null, upper: number | null) {
  if (current === null || lower === null || upper === null || upper <= lower) {
    return "Диапазон пока недоступен";
  }

  if (current < lower) {
    return "Цена ниже нижней границы";
  }
  if (current > upper) {
    return "Цена выше верхней границы";
  }

  const ratio = (current - lower) / (upper - lower);
  if (ratio <= 0.15) {
    return "Цена внутри диапазона, но близко к нижней границе";
  }
  if (ratio >= 0.85) {
    return "Цена внутри диапазона, но близко к верхней границе";
  }
  if (ratio >= 0.35 && ratio <= 0.65) {
    return "Цена в центральной части диапазона";
  }

  return "Цена внутри диапазона";
}

function describeComfortZone(current: number | null, lower: number | null, upper: number | null) {
  if (current === null || lower === null || upper === null || upper <= lower) {
    return "Оценка зоны недоступна";
  }

  const ratio = (current - lower) / (upper - lower);
  if (ratio < 0 || ratio > 1) {
    return "Цена вне рабочего диапазона";
  }
  if (ratio <= 0.15 || ratio >= 0.85) {
    return "Near edge";
  }
  if (ratio >= 0.35 && ratio <= 0.65) {
    return "Комфортная центральная зона";
  }

  return "Рабочая зона без запаса до края";
}

function formatDelta(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Math.abs(value))}%`;
}
