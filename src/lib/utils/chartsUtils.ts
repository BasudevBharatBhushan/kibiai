import type Highcharts from 'highcharts';
import type { ChartConfig } from '@/lib/charts/ChartTypes';

// Build Highcharts Options from ChartConfig
export function buildOptions(config: ChartConfig): Highcharts.Options {
  const isPie = config.kind === 'pie' || config.kind === 'donut';
  const isLargeData = config.series.some(s => s.data && s.data.length > 1000);

  // Pie charts configuration
  if (isPie) {
    const pieData =
      config.series[0]?.data.map((val: any, idx: number) => ({
        name: config.categories?.[idx] ?? `Slice ${idx + 1}`,
        y: Number(val ?? 0),
      })) ?? [];

    return {
      chart: { type: 'pie', reflow: true },
      ...(config.colors && config.colors.length > 0 ? { colors: config.colors } : {}),
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

  // Gauge chart configuration (solidgauge)
  if (config.kind === 'gauge') {
    const currentValue = config.series[0]?.data[0] ?? 0;
    const maxValue = (config.target_max ?? config.target_value ?? (currentValue * 1.5)) || 100;

    return {
      chart: { type: 'solidgauge', reflow: true },
      title: { text: undefined },
      credits: { enabled: false },
      pane: {
        center: ['50%', '80%'],
        size: '140%',
        startAngle: -90,
        endAngle: 90,
        background: [{
          backgroundColor: '#EEE',
          innerRadius: '60%',
          outerRadius: '100%',
          shape: 'arc',
        }] as any,
      },
      yAxis: {
        min: 0,
        max: maxValue as number,
        stops: [
          [0.1, '#DF5353'],
          [0.5, '#DDDF0D'],
          [0.9, '#55BF3B'],
        ] as any,
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickAmount: 2,
        title: { text: config.title, y: -70 },
        labels: { y: 16 },
      },
      plotOptions: {
        solidgauge: {
          dataLabels: { y: 5, borderWidth: 0, useHTML: true },
        } as any,
      },
      series: [{
        type: 'solidgauge' as any,
        name: config.series[0]?.name ?? 'Value',
        data: [Number(currentValue)],
        dataLabels: {
          format: '<div style="text-align:center"><span style="font-size:25px">{y}</span></div>',
        },
      }],
    };
  }

  // Funnel chart configuration
  if (config.kind === 'funnel') {
    const funnelData = config.series[0]?.data.map((val, idx) => ({
      name: config.categories?.[idx] ?? `Stage ${idx + 1}`,
      y: Number(val ?? 0),
    })) ?? [];

    return {
      chart: { type: 'funnel', reflow: true },
      title: { text: undefined },
      credits: { enabled: false },
      plotOptions: {
        funnel: {
          neckWidth: '30%',
          neckHeight: '25%',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.y:,.0f}',
          },
        } as any,
      },
      series: [{
        type: 'funnel' as any,
        name: config.series[0]?.name ?? 'Values',
        data: funnelData,
      }],
    };
  }

  // Non-pie, non-gauge, non-funnel charts (cartesian: column, bar, line, spline, area, areaspline)
  const stackingConfig = config.stacking && config.stacking !== 'none'
    ? { stacking: config.stacking }
    : {};

  return {
    chart: { 
      type: config.kind, 
      reflow: true
    },
    boost: {
      useGPUTranslations: true,
      seriesThreshold: isLargeData ? 1 : 50, 
    },
    ...(config.colors && config.colors.length > 0 ? { colors: config.colors } : {}),
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
      tickPixelInterval: 40,
    },

    plotOptions: {
      series: {
        animation: !isLargeData,
        marker: {
          enabled: !isLargeData,
          radius: 2
        },
        shadow: false,
        dataLabels: {
          enabled: false
        }
      },
      column: stackingConfig as any,
      bar: stackingConfig as any,
      area: stackingConfig as any,
      areaspline: stackingConfig as any,
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
