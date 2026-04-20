import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Series = {
  label: string;
  color: string | string[];
  values: Array<number | null>;
};

type BarChartProps = {
  labels: Array<string>;
  series: Series[];
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function BarChart({ labels, series, height = 220, valueFormatter = defaultValueFormatter }: BarChartProps) {
  const allValues = series.flatMap((item) => item.values.filter((value): value is number => value !== null));

  if (labels.length === 0 || allValues.length === 0) {
    return <div className="rounded-[18px] border border-dashed border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-text-muted)]">Пока недостаточно данных.</div>;
  }

  const data: ChartData<"bar"> = {
    labels,
    datasets: series.map((item) => ({
      label: item.label,
      data: item.values,
      backgroundColor: mapColor(item.color, (color) => withAlpha(color, 0.7)),
      borderColor: item.color,
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.84,
      categoryPercentage: 0.92,
    })),
  };

  const options: ChartOptions<"bar"> = {
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
          pointStyle: "rectRounded",
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
          color: "rgba(255, 255, 255, 0.04)",
        },
        border: { display: false },
        ticks: {
          color: "#9db9c7",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(255, 255, 255, 0.08)",
        },
        border: { display: false },
        ticks: {
          precision: 0,
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
        <Bar data={data} options={options} />
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

function mapColor(color: string | string[], transform: (value: string) => string) {
  return Array.isArray(color) ? color.map(transform) : transform(color);
}
