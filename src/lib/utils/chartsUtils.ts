import type Highcharts from 'highcharts';
import type { ChartConfig } from '@/lib/charts/ChartTypes';

// Build Highcharts Options from ChartConfig
export function buildOptions(config: ChartConfig): Highcharts.Options {
  const isPie = config.kind === 'pie' || config.kind === 'donut';

  // Pie charts configuration
  if (isPie) {
    const pieData =
      config.series[0]?.data.map((val: any, idx: number) => ({
        name: config.categories?.[idx] ?? `Slice ${idx + 1}`,
        y: Number(val ?? 0),
      })) ?? [];

    return {
      chart: { type: 'pie', reflow: true },
      colors: config.colors,
      title: { text: config.title, align: 'center' },

      credits: { enabled: false },

      xAxis: { visible: false },
      yAxis: { visible: false },

      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: { enabled: true },
          showInLegend: true,

          innerSize: config.kind === 'donut' ? '50%' : '0%',
        },
      },

      tooltip: {
        pointFormat: '{series.name}: <b>{point.y}</b>',
      },

      series: [
        {
          type: 'pie',
          name: config.series[0]?.name ?? 'Values',
          data: pieData,
        },
      ],
    };
  }
//non-pie charts confuguration
  return {
    chart: { 
      type: config.kind, 
      reflow: true
    },
    colors: config.colors,
    title: { text: config.title },

    xAxis: {
      visible: true,
      categories: config.categories,
      title: { text: undefined },
    },

    yAxis: {
      visible: true,
      title: { text: 'Value' },
      min: 0,
    },

    series: config.series.map(s => ({
      name: s.name,
      data: s.data,
      type: config.kind as any,
    })),

    credits: { enabled: false },

    tooltip: {
      shared: true,
    },

    responsive: {
      rules: [
        {
          condition: { maxWidth: 480 },
          chartOptions: {
            legend: { enabled: false },
          },
        },
      ],
    },
  };
}
