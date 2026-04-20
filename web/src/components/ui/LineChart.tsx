import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

type Series = {
  label: string;
  color: string;
  positiveColor?: string;
  values: Array<number | null>;
};

type LineChartProps = {
  labels: Array<string>;
  series: Series[];
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function LineChart({ labels, series, height = 220, valueFormatter = defaultValueFormatter }: LineChartProps) {
  const allValues = series.flatMap((item) => item.values.filter((value): value is number => value !== null));

  if (labels.length === 0 || allValues.length === 0) {
    return <div className="rounded-[18px] border border-dashed border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-text-muted)]">Пока недостаточно данных.</div>;
  }

  const data: ChartData<"line"> = {
    labels,
    datasets: series.map((item) => ({
      label: item.label,
      data: item.values,
      borderColor: item.color,
      backgroundColor: withAlpha(item.color, 0.12),
      pointBackgroundColor: item.values.map((value) => pointColor(item, value)),
      pointBorderColor: item.values.map((value) => pointColor(item, value)),
      pointHoverBackgroundColor: item.values.map((value) => pointColor(item, value)),
      pointHoverBorderColor: "#07131d",
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: 0.32,
      spanGaps: true,
      fill: false,
      segment: item.positiveColor
        ? {
            borderColor(context) {
              const start = context.p0.parsed.y;
              const end = context.p1.parsed.y;
              return (start !== null && start >= 0 && end !== null && end >= 0) ? item.positiveColor! : item.color;
            },
          }
        : undefined,
    })),
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#edf7fb",
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "rgba(7, 19, 29, 0.94)",
        borderColor: "rgba(180, 217, 236, 0.16)",
        borderWidth: 1,
        padding: 12,
        titleColor: "#edf7fb",
        bodyColor: "#edf7fb",
        displayColors: true,
        callbacks: {
          label(context) {
            const raw = context.raw;
            const numeric = typeof raw === "number" ? raw : Number(raw);
            return `${context.dataset.label}: ${Number.isFinite(numeric) ? valueFormatter(numeric) : "н/д"}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255, 255, 255, 0.06)",
        },
        border: { display: false },
        ticks: {
          color: "#9db9c7",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
      },
      y: {
        grid: {
          color: "rgba(255, 255, 255, 0.08)",
        },
        border: { display: false },
        ticks: {
          color: "#9db9c7",
          callback(value) {
            const numeric = typeof value === "number" ? value : Number(value);
            return Number.isFinite(numeric) ? valueFormatter(numeric) : String(value);
          },
        },
      },
    },
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
      <div className="p-3" style={{ height }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

function defaultValueFormatter(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith("#")) {
    return color;
  }

  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;

  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pointColor(series: Series, value: number | null) {
  if (value !== null && series.positiveColor && value >= 0) {
    return series.positiveColor;
  }

  return series.color;
}
