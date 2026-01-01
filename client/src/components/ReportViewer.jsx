import React, { useState, useEffect } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import axios from 'axios';
import MetricSelector from './MetricSelector';
import './ReportViewer.css';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const ReportViewer = ({ athlete, selectedTests }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('initial-assessment');

  // Editable athlete info
  const [athleteInfo, setAthleteInfo] = useState({
    age: '',
    height: '',
    weight: ''
  });

  // Initial Assessment fields
  const [initialAssessment, setInitialAssessment] = useState({
    currentInjuries: '',
    injuryHistory: '',
    posturePresentation: '',
    movementAnalysis: ''
  });

  // CMJ recommendations
  const [cmjRecommendations, setCmjRecommendations] = useState('');

  // Squat Jump recommendations
  const [sjRecommendations, setSjRecommendations] = useState('');

  // IMTP recommendations
  const [imtpRecommendations, setImtpRecommendations] = useState('');

  // PPU recommendations
  const [ppuRecommendations, setPpuRecommendations] = useState('');

  // Hop Test recommendations
  const [hopRecommendations, setHopRecommendations] = useState('');

  // Single Leg CMJ recommendations
  const [slCmjRecommendations, setSlCmjRecommendations] = useState('');

  // Training Goals & Action Plan
  const [trainingGoals, setTrainingGoals] = useState({
    goals: '',
    actionPlan: ''
  });

  // Selected metrics for spider charts
  const [selectedMetrics, setSelectedMetrics] = useState({
    cmj: ['jumpHeight', 'rsi', 'peakPowerBM', 'eccentricBrakingRFD', 'concentricPeakVelocity', 'eccentricPeakPowerBM'],
    squatJump: ['jumpHeight', 'forceAtPeakPower', 'concentricPeakVelocity', 'peakPower', 'peakPowerBM'],
    hopTest: ['rsi', 'jumpHeight', 'gct'],
    imtp: ['peakVerticalForce', 'peakForceBM', 'forceAt100ms', 'timeToPeakForce'],
    ppu: ['pushupHeight', 'eccentricPeakForce', 'concentricPeakForce', 'concentricRFD_L', 'concentricRFD_R', 'eccentricBrakingRFD']
  });

  // Tab definitions - filter based on available test data
  const getAvailableTabs = () => {
    const allTabs = [
      { id: 'initial-assessment', label: 'Initial Assessment', alwaysShow: true },
      { id: 'cmj', label: 'CMJ', dataKey: 'cmj' },
      { id: 'squat-jump', label: 'Squat Jump', dataKey: 'squatJump' },
      { id: 'hop-test', label: 'Hop Test', dataKey: 'hopTest' },
      { id: 'single-leg-cmj', label: 'Single Leg CMJ', dataKey: 'singleLegCMJ_Left' }, // Check if either left or right exists
      { id: 'imtp', label: 'IMTP', dataKey: 'imtp' },
      { id: 'plyo-pushup', label: 'Plyometric Push-Up', dataKey: 'ppu' },
      { id: 'training-plan', label: 'Training Goals & Action Plan', alwaysShow: true }
    ];

    // Filter tabs based on available data
    return allTabs.filter(tab => {
      // Always show initial assessment and training plan
      if (tab.alwaysShow) return true;

      // For single leg CMJ, check if either left or right leg data exists
      if (tab.id === 'single-leg-cmj') {
        return reportData?.tests?.singleLegCMJ_Left || reportData?.tests?.singleLegCMJ_Right;
      }

      // For other tests, check if the data exists
      return reportData?.tests?.[tab.dataKey];
    });
  };

  const tabs = getAvailableTabs();

  // Define all available metrics for each test type
  const getAvailableMetrics = (testType) => {
    const allMetrics = {
      cmj: [
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'rsi', label: 'RSI' },
        { key: 'peakPowerBM', label: 'Peak Power / BM' },
        { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD' },
        { key: 'concentricPeakVelocity', label: 'Con Peak Velocity' },
        { key: 'eccentricPeakPowerBM', label: 'Ecc Peak Power / BM' },
        { key: 'forceAtZeroVelocity', label: 'Force @ Zero Velocity' },
        { key: 'eccentricPeakForce', label: 'Ecc Peak Force' },
        { key: 'concentricImpulse', label: 'Concentric Impulse' },
        { key: 'eccentricPeakVelocity', label: 'Ecc Peak Velocity' },
        { key: 'eccentricPeakPower', label: 'Ecc Peak Power' },
        { key: 'peakPower', label: 'Peak Power' },
        { key: 'countermovementDepth', label: 'Countermovement Depth' }
      ],
      squatJump: [
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'forceAtPeakPower', label: 'Force @ Peak Power' },
        { key: 'concentricPeakVelocity', label: 'Con Peak Velocity' },
        { key: 'peakPower', label: 'Peak Power' },
        { key: 'peakPowerBM', label: 'Peak Power / BW' }
      ],
      hopTest: [
        { key: 'rsi', label: 'RSI' },
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'gct', label: 'Ground Contact Time' }
      ],
      imtp: [
        { key: 'peakVerticalForce', label: 'Peak Vertical Force' },
        { key: 'peakForceBM', label: 'Peak Force / BM' },
        { key: 'forceAt100ms', label: 'Force @ 100ms' },
        { key: 'timeToPeakForce', label: 'Time to Peak Force' }
      ],
      ppu: [
        { key: 'pushupHeight', label: 'Push-Up Height' },
        { key: 'eccentricPeakForce', label: 'Ecc Peak Force' },
        { key: 'concentricPeakForce', label: 'Con Peak Force' },
        { key: 'concentricRFD_L', label: 'Con RFD (L)' },
        { key: 'concentricRFD_R', label: 'Con RFD (R)' },
        { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD' }
      ]
    };

    return allMetrics[testType] || [];
  };

  // Handler to update selected metrics for a specific test type
  const handleMetricsChange = (testType, newMetrics) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [testType]: newMetrics
    }));
  };

  useEffect(() => {
    if (athlete) {
      fetchReportData();
    }
  }, [athlete, selectedTests]);

  // Ensure active tab is valid when tabs change
  useEffect(() => {
    if (reportData && tabs.length > 0) {
      const activeTabExists = tabs.some(tab => tab.id === activeTab);
      if (!activeTabExists) {
        // If current active tab doesn't exist in filtered tabs, switch to first tab
        setActiveTab(tabs[0].id);
      }
    }
  }, [reportData, activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/reports/generate', {
        athleteId: athlete.id,
        profileIds: athlete.profileIds || [athlete.id],
        name: athlete.name,
        position: athlete.position,
        selectedTests: selectedTests || {}
      });

      setReportData(response.data.data);

      // Initialize athlete info from API data
      const data = response.data.data;
      const weight = data.tests?.cmj?.weight || data.tests?.imtp?.weight || '';
      const dateOfBirth = athlete?.dateOfBirth || '';
      let age = '';

      if (dateOfBirth) {
        try {
          const birthDate = new Date(dateOfBirth);
          const today = new Date();
          const calculatedAge = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
          if (calculatedAge > 0 && calculatedAge < 120) {
            age = calculatedAge.toString();
          }
        } catch (e) {
          // Invalid date, leave age empty
        }
      }

      setAthleteInfo({
        age: age,
        height: '',
        weight: weight ? `${Math.round(weight * 2.20462)} lbs` : ''
      });
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate asymmetry percentage and get color
  const calculateAsymmetry = (leftValue, rightValue) => {
    if (!leftValue || !rightValue || leftValue === 0 || rightValue === 0) {
      return { percentage: 'N/A', color: '#ccc' };
    }

    const diff = Math.abs(leftValue - rightValue);
    const avg = (leftValue + rightValue) / 2;
    const asymmetry = (diff / avg) * 100;

    let color;
    if (asymmetry <= 5) {
      color = '#27AE60'; // Green
    } else if (asymmetry <= 10) {
      color = '#F39C12'; // Yellow/Orange
    } else {
      color = '#E74C3C'; // Red
    }

    return {
      percentage: asymmetry.toFixed(1) + '%',
      color: color
    };
  };

  const generatePDF = async () => {
    setSaving(true);
    setGeneratingProgress(0); // Start progress

    try {
      const reportPayload = {
        ...reportData,
        athleteInfo: athleteInfo,
        initialAssessment: initialAssessment,
        cmjRecommendations: cmjRecommendations,
        sjRecommendations: sjRecommendations,
        hopRecommendations: hopRecommendations,
        imtpRecommendations: imtpRecommendations,
        slCmjRecommendations: slCmjRecommendations,
        ppuRecommendations: ppuRecommendations,
        trainingGoals: trainingGoals,
        selectedMetrics: selectedMetrics  // Include selected metrics for spider charts
      };

      // Simulate progress updates - slower to match actual PDF generation time
      const progressInterval = setInterval(() => {
        setGeneratingProgress(prev => {
          if (prev >= 90) return prev; // Cap at 90% until complete
          return prev + 3;
        });
      }, 2000);

      const response = await axios.post('/api/reports/generate-pdf', reportPayload, {
        responseType: 'blob'
      });

      clearInterval(progressInterval);
      setGeneratingProgress(100); // Complete

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${athlete.name.replace(' ', '_')}_report_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Wait a bit to show 100% before closing
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setSaving(false);
      setGeneratingProgress(0); // Reset
    }
  };

  const getSpiderChartData = () => {
    if (!reportData?.tests?.cmj || !reportData?.cmjComparison?.metrics) return null;

    // Get all available metrics and filter to only selected ones
    const allMetrics = getAvailableMetrics('cmj');
    const keyMetrics = allMetrics.filter(metric =>
      selectedMetrics.cmj.includes(metric.key)
    );

    const labels = [];
    const athleteValues = [];
    const mlbAverages = [];

    keyMetrics.forEach(metric => {
      const athleteValue = reportData.tests.cmj[metric.key];
      const mlbStats = reportData.cmjComparison.metrics[metric.key];

      if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
        labels.push(metric.label);

        // Use actual percentile from database for accurate chart positioning
        athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
        // Pro average (mean) should be at 50th percentile
        mlbAverages.push(50);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: athlete?.name || 'Athlete',
          data: athleteValues,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        },
        {
          label: 'MLB Average',
          data: mlbAverages,
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
        }
      ]
    };
  };

  const getSJSpiderChartData = () => {
    if (!reportData?.tests?.squatJump || !reportData?.sjComparison?.metrics) return null;

    // Get all available metrics and filter to only selected ones
    const allMetrics = getAvailableMetrics('squatJump');
    const keyMetrics = allMetrics.filter(metric =>
      selectedMetrics.squatJump.includes(metric.key)
    );

    const labels = [];
    const athleteValues = [];
    const mlbAverages = [];

    keyMetrics.forEach(metric => {
      const athleteValue = reportData.tests.squatJump[metric.key];
      const mlbStats = reportData.sjComparison.metrics[metric.key];

      if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
        labels.push(metric.label);

        // Use actual percentile from database for accurate chart positioning
        athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
        // Pro average (mean) should be at 50th percentile
        mlbAverages.push(50);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: athlete?.name || 'Athlete',
          data: athleteValues,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        },
        {
          label: 'MLB Average',
          data: mlbAverages,
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
        }
      ]
    };
  };

  const getIMTPSpiderChartData = () => {
    if (!reportData?.tests?.imtp || !reportData?.imtpComparison?.metrics) return null;

    // Get all available metrics and filter to only selected ones
    const allMetrics = getAvailableMetrics('imtp');
    const keyMetrics = allMetrics.filter(metric =>
      selectedMetrics.imtp.includes(metric.key)
    );

    const labels = [];
    const athleteValues = [];
    const mlbAverages = [];

    keyMetrics.forEach(metric => {
      const athleteValue = reportData.tests.imtp[metric.key];
      const mlbStats = reportData.imtpComparison.metrics[metric.key];

      if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
        labels.push(metric.label);

        // Use actual percentile from database for accurate chart positioning
        athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
        // Pro average (mean) should be at 50th percentile
        mlbAverages.push(50);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: athlete?.name || 'Athlete',
          data: athleteValues,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        },
        {
          label: 'MLB Average',
          data: mlbAverages,
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
        }
      ]
    };
  };

  // PPU Spider Chart Data
  const getPPUSpiderChartData = () => {
    if (!reportData?.tests?.ppu || !reportData?.ppuComparison?.metrics) return null;

    // Get all available metrics and filter to only selected ones
    const allMetrics = getAvailableMetrics('ppu');
    const keyMetrics = allMetrics.filter(metric =>
      selectedMetrics.ppu.includes(metric.key)
    );

    const labels = [];
    const athleteValues = [];
    const mlbAverages = [];

    keyMetrics.forEach(metric => {
      const athleteValue = reportData.tests.ppu[metric.key];
      const mlbStats = reportData.ppuComparison.metrics[metric.key];

      if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
        labels.push(metric.label);

        // Use actual percentile from database for accurate chart positioning
        athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
        // Pro average (mean) should be at 50th percentile
        mlbAverages.push(50);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: athlete?.name || 'Athlete',
          data: athleteValues,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        },
        {
          label: 'MLB Average',
          data: mlbAverages,
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
        }
      ]
    };
  };

  // CMJ Chart Options with custom tooltips
  const getCMJChartOptions = () => {
    if (!reportData?.tests?.cmj || !reportData?.cmjComparison?.metrics) return {};

    const metrics = [
      { key: 'jumpHeight', label: 'Jump Height', unit: 'in' },
      { key: 'rsi', label: 'RSI', unit: '' },  // Standard RSI (changed from RSI-mod)
      { key: 'peakPowerBM', label: 'Peak Power / BM', unit: 'W/kg' },
      { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD', unit: 'N/s' },
      { key: 'concentricPeakVelocity', label: 'Con Peak Velocity', unit: 'm/s' },
      { key: 'eccentricPeakPowerBM', label: 'Ecc Peak Power / BM', unit: 'W/kg' }
    ];

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'CMJ Metrics vs MLB Professional Average'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const metricIndex = context.dataIndex;
              const metric = metrics.find(m => m.label === context.label);
              if (!metric) return context.dataset.label + ': ' + context.parsed.r.toFixed(1);

              const athleteValue = reportData.tests.cmj[metric.key];
              const mlbValue = reportData.cmjComparison.metrics[metric.key]?.proMean;
              const percentile = reportData.cmjComparison.metrics[metric.key]?.percentile;

              if (context.dataset.label.includes('Athlete') || context.dataset.label.includes(athlete?.name)) {
                return `${context.dataset.label}: ${athleteValue?.toFixed(2) || 'N/A'} ${metric.unit} (${percentile?.toFixed(1) || 'N/A'}%)`;
              } else {
                return `${context.dataset.label}: ${mlbValue?.toFixed(2) || 'N/A'} ${metric.unit}`;
              }
            }
          }
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };
  };

  // SJ Chart Options with custom tooltips
  const getSJChartOptions = () => {
    if (!reportData?.tests?.squatJump || !reportData?.sjComparison?.metrics) return {};

    const metrics = [
      { key: 'jumpHeight', label: 'Jump Height', unit: 'in' },
      { key: 'forceAtPeakPower', label: 'Force @ Peak Power', unit: 'N' },
      { key: 'concentricPeakVelocity', label: 'Con Peak Velocity', unit: 'm/s' },
      { key: 'peakPower', label: 'Peak Power', unit: 'W' },
      { key: 'peakPowerBM', label: 'Peak Power / BW', unit: 'W/kg' }
    ];

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Squat Jump Metrics vs MLB Professional Average'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const metric = metrics.find(m => m.label === context.label);
              if (!metric) return context.dataset.label + ': ' + context.parsed.r.toFixed(1);

              const athleteValue = reportData.tests.squatJump[metric.key];
              const mlbValue = reportData.sjComparison.metrics[metric.key]?.proMean;
              const percentile = reportData.sjComparison.metrics[metric.key]?.percentile;

              if (context.dataset.label.includes('Athlete') || context.dataset.label.includes(athlete?.name)) {
                return `${context.dataset.label}: ${athleteValue?.toFixed(2) || 'N/A'} ${metric.unit} (${percentile?.toFixed(1) || 'N/A'}%)`;
              } else {
                return `${context.dataset.label}: ${mlbValue?.toFixed(2) || 'N/A'} ${metric.unit}`;
              }
            }
          }
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };
  };

  // IMTP Chart Options with custom tooltips
  const getIMTPChartOptions = () => {
    if (!reportData?.tests?.imtp || !reportData?.imtpComparison?.metrics) return {};

    const metrics = [
      { key: 'peakVerticalForce', label: 'Peak Vertical Force', unit: 'N' },
      { key: 'peakForceBM', label: 'Peak Vertical Force / BM', unit: 'N/kg' },
      { key: 'forceAt100ms', label: 'Force @ 100ms', unit: 'N' },
      { key: 'timeToPeakForce', label: 'Time to Peak Force', unit: 's' }
    ];

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'IMTP Metrics vs MLB Professional Average'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const metric = metrics.find(m => m.label === context.label);
              if (!metric) return context.dataset.label + ': ' + context.parsed.r.toFixed(1);

              const athleteValue = reportData.tests.imtp[metric.key];
              const mlbValue = reportData.imtpComparison.metrics[metric.key]?.proMean;
              const percentile = reportData.imtpComparison.metrics[metric.key]?.percentile;

              if (context.dataset.label.includes('Athlete') || context.dataset.label.includes(athlete?.name)) {
                return `${context.dataset.label}: ${athleteValue?.toFixed(2) || 'N/A'} ${metric.unit} (${percentile?.toFixed(1) || 'N/A'}%)`;
              } else {
                return `${context.dataset.label}: ${mlbValue?.toFixed(2) || 'N/A'} ${metric.unit}`;
              }
            }
          }
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };
  };

  //  PPU Chart Options with custom tooltips
  const getPPUChartOptions = () => {
    if (!reportData?.tests?.ppu || !reportData?.ppuComparison?.metrics) return {};

    const metrics = [
      { key: 'pushupHeight', label: 'Pushup Height', unit: 'in' },
      { key: 'eccentricPeakForce', label: 'Ecc Peak Force', unit: 'N' },
      { key: 'concentricPeakForce', label: 'Con Peak Force', unit: 'N' },
      { key: 'concentricRFD_L', label: 'Con RFD L', unit: 'N/s' },
      { key: 'concentricRFD_R', label: 'Con RFD R', unit: 'N/s' },
      { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD', unit: 'N/s' }
    ];

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Plyometric Push Up Metrics vs MLB Professional Average'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const metric = metrics.find(m => m.label === context.label);
              if (!metric) return context.dataset.label + ': ' + context.parsed.r.toFixed(1);

              const athleteValue = reportData.ppuComparison.metrics[metric.key]?.value;
              const mlbValue = reportData.ppuComparison.metrics[metric.key]?.proMean;
              const percentile = reportData.ppuComparison.metrics[metric.key]?.percentile;

              if (context.dataset.label.includes('Athlete') || context.dataset.label.includes(athlete?.name)) {
                return `${context.dataset.label}: ${athleteValue?.toFixed(2) || 'N/A'} ${metric.unit} (${percentile?.toFixed(1) || 'N/A'}%)`;
              } else {
                return `${context.dataset.label}: ${mlbValue?.toFixed(2) || 'N/A'} ${metric.unit}`;
              }
            }
          }
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };
  };

  // Hop Test Spider Chart Data
  const getHopTestSpiderChartData = () => {
    if (!reportData?.tests?.hopTest || !reportData?.hopComparison?.metrics) return null;

    // Get all available metrics and filter to only selected ones
    const allMetrics = getAvailableMetrics('hopTest');
    const keyMetrics = allMetrics.filter(metric =>
      selectedMetrics.hopTest.includes(metric.key)
    );

    const labels = [];
    const athleteValues = [];
    const mlbAverages = [];

    keyMetrics.forEach(metric => {
      const mlbStats = reportData.hopComparison.metrics[metric.key];

      if (mlbStats && mlbStats.percentile !== undefined) {
        labels.push(metric.label);

        // Use actual percentile from database for accurate chart positioning
        athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
        // Pro average (mean) should be at 50th percentile
        mlbAverages.push(50);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: athlete?.name || 'Athlete',
          data: athleteValues,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        },
        {
          label: 'MLB Average',
          data: mlbAverages,
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
        }
      ]
    };
  };

  // Hop Test Chart Options with custom tooltips
  const getHopTestChartOptions = () => {
    if (!reportData?.tests?.hopTest || !reportData?.hopComparison?.metrics) return {};

    const metrics = [
      { key: 'rsi', label: 'RSI', unit: '' },
      { key: 'jumpHeight', label: 'Jump Height', unit: 'in' },
      { key: 'gct', label: 'GCT', unit: 's' }
    ];

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Hop Test Metrics vs MLB Professional Average'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const metric = metrics.find(m => m.label === context.label);
              if (!metric) return context.dataset.label + ': ' + context.parsed.r.toFixed(1);

              const athleteValue = reportData.hopComparison.metrics[metric.key]?.value;
              const mlbValue = reportData.hopComparison.metrics[metric.key]?.proMean;
              const percentile = reportData.hopComparison.metrics[metric.key]?.percentile;

              if (context.dataset.label.includes('Athlete') || context.dataset.label.includes(athlete?.name)) {
                return `${context.dataset.label}: ${athleteValue?.toFixed(2) || 'N/A'} ${metric.unit} (${percentile?.toFixed(1) || 'N/A'}%)`;
              } else {
                return `${context.dataset.label}: ${mlbValue?.toFixed(2) || 'N/A'} ${metric.unit}`;
              }
            }
          }
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };
  };

  if (loading) {
    return (
      <div className="report-loading">
        <div className="spinner"></div>
        <p>Generating performance report...</p>
      </div>
    );
  }

  if (!reportData && !athlete) {
    return (
      <div className="no-report">
        <p>Select an athlete to view their report</p>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'initial-assessment':
        return (
          <div className="tab-content">
            <h2>Initial Assessment</h2>
            <div className="assessment-section">
              <div className="assessment-field">
                <label>Current Status</label>
                <textarea
                  value={initialAssessment.currentInjuries}
                  onChange={(e) => setInitialAssessment({...initialAssessment, currentInjuries: e.target.value})}
                  placeholder="Document any current injuries or pain..."
                  rows={5}
                />
              </div>

              <div className="assessment-field">
                <label>Injury History</label>
                <textarea
                  value={initialAssessment.injuryHistory}
                  onChange={(e) => setInitialAssessment({...initialAssessment, injuryHistory: e.target.value})}
                  placeholder="Document past injuries and recovery..."
                  rows={5}
                />
              </div>

              <div className="assessment-field">
                <label>Posture Presentation</label>
                <textarea
                  value={initialAssessment.posturePresentation}
                  onChange={(e) => setInitialAssessment({...initialAssessment, posturePresentation: e.target.value})}
                  placeholder="Note postural observations..."
                  rows={5}
                />
              </div>

              <div className="assessment-field">
                <label>Movement Analysis Summary</label>
                <textarea
                  value={initialAssessment.movementAnalysis}
                  onChange={(e) => setInitialAssessment({...initialAssessment, movementAnalysis: e.target.value})}
                  placeholder="Summarize movement quality and patterns..."
                  rows={5}
                />
              </div>
            </div>
          </div>
        );

      case 'cmj':
        return (
          <div className="tab-content">
            <h2>Countermovement Jump (CMJ)</h2>

            {/* Detailed CMJ Metrics Table */}
            {reportData.tests?.cmj && (
              <div className="metrics-table-section">
                <h3>Detailed Metrics</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Athlete Value</th>
                        <th>Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Jump Height</td>
                        <td>{reportData.tests.cmj.jumpHeight ? `${(reportData.tests.cmj.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
                        <td>{reportData.cmjComparison?.metrics?.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Braking RFD</td>
                        <td>{reportData.tests.cmj.eccentricBrakingRFD?.toFixed(2) || 'N/A'} N/s</td>
                        <td>{reportData.cmjComparison?.metrics?.eccentricBrakingRFD?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Force @ Zero Velocity</td>
                        <td>{reportData.tests.cmj.forceAtZeroVelocity?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.cmjComparison?.metrics?.forceAtZeroVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Force</td>
                        <td>{reportData.tests.cmj.eccentricPeakForce?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.cmjComparison?.metrics?.eccentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric Impulse</td>
                        <td>{reportData.tests.cmj.concentricImpulse?.toFixed(2) || 'N/A'} Ns</td>
                        <td>{reportData.cmjComparison?.metrics?.concentricImpulse?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Velocity</td>
                        <td>{reportData.tests.cmj.eccentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
                        <td>{reportData.cmjComparison?.metrics?.eccentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric Peak Velocity</td>
                        <td>{reportData.tests.cmj.concentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
                        <td>{reportData.cmjComparison?.metrics?.concentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Power</td>
                        <td>{reportData.tests.cmj.eccentricPeakPower?.toFixed(2) || 'N/A'} W</td>
                        <td>{reportData.cmjComparison?.metrics?.eccentricPeakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Power / BM</td>
                        <td>{reportData.tests.cmj.eccentricPeakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
                        <td>{reportData.cmjComparison?.metrics?.eccentricPeakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Peak Power</td>
                        <td>{reportData.tests.cmj.peakPower?.toFixed(2) || 'N/A'} W</td>
                        <td>{reportData.cmjComparison?.metrics?.peakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Peak Power / BM</td>
                        <td>{reportData.tests.cmj.peakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
                        <td>{reportData.cmjComparison?.metrics?.peakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>RSI</td>
                        <td>{reportData.tests.cmj.rsi?.toFixed(2) || 'N/A'}</td>
                        <td>{reportData.cmjComparison?.metrics?.rsi?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Countermovement Depth</td>
                        <td>{reportData.tests.cmj.countermovementDepth?.toFixed(2) || 'N/A'} cm</td>
                        <td>{reportData.cmjComparison?.metrics?.countermovementDepth?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                    </tbody>
                  </table>
                  {reportData.cmjComparison && (
                    <p className="comparison-note">
                      Compared against professional baseball players from MLB/MiLB
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Spider Chart */}
            <div className="spider-chart-section">
              <h3>Performance Comparison</h3>

              {/* Metric Selector */}
              <MetricSelector
                testType="cmj"
                availableMetrics={getAvailableMetrics('cmj')}
                selectedMetrics={selectedMetrics.cmj}
                onMetricsChange={(newMetrics) => handleMetricsChange('cmj', newMetrics)}
              />

              <div className="spider-chart-container">
                {getSpiderChartData() && (
                  <Radar data={getSpiderChartData()} options={getCMJChartOptions()} />
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={cmjRecommendations}
                onChange={(e) => setCmjRecommendations(e.target.value)}
                placeholder="Add training recommendations based on CMJ results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'squat-jump':
        return (
          <div className="tab-content">
            <h2>Squat Jump (SJ)</h2>

            {/* Detailed SJ Metrics Table */}
            {reportData.tests?.squatJump && (
              <div className="metrics-table-section">
                <h3>Detailed Metrics</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Athlete Value</th>
                        <th>Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Jump Height</td>
                        <td>{reportData.tests.squatJump.jumpHeight ? `${(reportData.tests.squatJump.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
                        <td>{reportData.sjComparison?.metrics?.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Force @ Peak Power</td>
                        <td>{reportData.tests.squatJump.forceAtPeakPower?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.sjComparison?.metrics?.forceAtPeakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric Peak Velocity</td>
                        <td>{reportData.tests.squatJump.concentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
                        <td>{reportData.sjComparison?.metrics?.concentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Peak Power</td>
                        <td>{reportData.tests.squatJump.peakPower?.toFixed(2) || 'N/A'} W</td>
                        <td>{reportData.sjComparison?.metrics?.peakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Peak Power / BW</td>
                        <td>{reportData.tests.squatJump.peakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
                        <td>{reportData.sjComparison?.metrics?.peakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                    </tbody>
                  </table>
                  {reportData.sjComparison && (
                    <p className="comparison-note">
                      Compared against professional baseball players from MLB/MiLB
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Spider Chart */}
            {reportData.tests?.squatJump && reportData.sjComparison && (
              <div className="spider-chart-section">
                <h3>Performance Comparison</h3>

                {/* Metric Selector */}
                <MetricSelector
                  testType="squatJump"
                  availableMetrics={getAvailableMetrics('squatJump')}
                  selectedMetrics={selectedMetrics.squatJump}
                  onMetricsChange={(newMetrics) => handleMetricsChange('squatJump', newMetrics)}
                />

                <div className="spider-chart-container">
                  {getSJSpiderChartData() && (
                    <Radar data={getSJSpiderChartData()} options={getSJChartOptions()} />
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={sjRecommendations}
                onChange={(e) => setSjRecommendations(e.target.value)}
                placeholder="Add training recommendations based on Squat Jump results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'hop-test':
        return (
          <div className="tab-content">
            <h2>Hop Test</h2>

            {/* Detailed Hop Test Metrics Table */}
            {reportData.tests?.hopTest && reportData.hopComparison?.metrics ? (
              <div className="metrics-table-section">
                <h3>Detailed Metrics</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Athlete Value</th>
                        <th>Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>RSI (Reactive Strength Index)</td>
                        <td>{reportData.hopComparison.metrics.rsi?.value?.toFixed(2) || 'N/A'}</td>
                        <td>{reportData.hopComparison.metrics.rsi?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Jump Height</td>
                        <td>{reportData.hopComparison.metrics.jumpHeight?.value?.toFixed(2) || 'N/A'} in</td>
                        <td>{reportData.hopComparison.metrics.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Ground Contact Time (GCT)</td>
                        <td>{reportData.hopComparison.metrics.gct?.value?.toFixed(3) || 'N/A'} s</td>
                        <td>{reportData.hopComparison.metrics.gct?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                    </tbody>
                  </table>
                  {reportData.hopComparison && (
                    <p className="comparison-note">
                      Compared against professional baseball players from MLB/MiLB
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="placeholder-section">
                <p className="placeholder-text">No Hop Test data available for this athlete.</p>
              </div>
            )}

            {/* Spider Chart */}
            {reportData.tests?.hopTest && reportData.hopComparison && (
              <div className="spider-chart-section">
                <h3>Performance Comparison</h3>

                {/* Metric Selector */}
                <MetricSelector
                  testType="hopTest"
                  availableMetrics={getAvailableMetrics('hopTest')}
                  selectedMetrics={selectedMetrics.hopTest}
                  onMetricsChange={(newMetrics) => handleMetricsChange('hopTest', newMetrics)}
                />

                <div className="spider-chart-container">
                  {getHopTestSpiderChartData() && (
                    <Radar data={getHopTestSpiderChartData()} options={getHopTestChartOptions()} />
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={hopRecommendations}
                onChange={(e) => setHopRecommendations(e.target.value)}
                placeholder="Add training recommendations based on Hop Test results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'single-leg-cmj':
        const leftData = reportData?.tests?.singleLegCMJ_Left;
        const rightData = reportData?.tests?.singleLegCMJ_Right;

        return (
          <div className="tab-content">
            <h2>Single Leg Countermovement Jump</h2>

            {/* Warning if only one leg found */}
            {reportData?.slCmjWarning && (
              <div className="warning-banner" style={{
                backgroundColor: '#fef3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span style={{ color: '#856404' }}>{reportData.slCmjWarning}</span>
              </div>
            )}

            {(leftData || rightData) ? (
              <div className="metrics-table-section">
                <h3>Left vs Right Comparison</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Left</th>
                        <th>Right</th>
                        <th>Asymmetry</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Jump Height</td>
                        <td>{leftData?.jumpHeight ? `${(leftData.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
                        <td>{rightData?.jumpHeight ? `${(rightData.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.jumpHeight, rightData?.jumpHeight).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.jumpHeight, rightData?.jumpHeight).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Force</td>
                        <td>{leftData?.eccentricPeakForce ? `${leftData.eccentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
                        <td>{rightData?.eccentricPeakForce ? `${rightData.eccentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.eccentricPeakForce, rightData?.eccentricPeakForce).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.eccentricPeakForce, rightData?.eccentricPeakForce).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Eccentric Braking RFD</td>
                        <td>{leftData?.eccentricBrakingRFD ? `${leftData.eccentricBrakingRFD.toFixed(2)} N/s` : 'N/A'}</td>
                        <td>{rightData?.eccentricBrakingRFD ? `${rightData.eccentricBrakingRFD.toFixed(2)} N/s` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.eccentricBrakingRFD, rightData?.eccentricBrakingRFD).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.eccentricBrakingRFD, rightData?.eccentricBrakingRFD).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Concentric Peak Force</td>
                        <td>{leftData?.concentricPeakForce ? `${leftData.concentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
                        <td>{rightData?.concentricPeakForce ? `${rightData.concentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.concentricPeakForce, rightData?.concentricPeakForce).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.concentricPeakForce, rightData?.concentricPeakForce).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Velocity</td>
                        <td>{leftData?.eccentricPeakVelocity ? `${leftData.eccentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
                        <td>{rightData?.eccentricPeakVelocity ? `${rightData.eccentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.eccentricPeakVelocity, rightData?.eccentricPeakVelocity).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.eccentricPeakVelocity, rightData?.eccentricPeakVelocity).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Concentric Peak Velocity</td>
                        <td>{leftData?.concentricPeakVelocity ? `${leftData.concentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
                        <td>{rightData?.concentricPeakVelocity ? `${rightData.concentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.concentricPeakVelocity, rightData?.concentricPeakVelocity).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.concentricPeakVelocity, rightData?.concentricPeakVelocity).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Peak Power / BW</td>
                        <td>{leftData?.peakPowerBM ? `${leftData.peakPowerBM.toFixed(2)} W/kg` : 'N/A'}</td>
                        <td>{rightData?.peakPowerBM ? `${rightData.peakPowerBM.toFixed(2)} W/kg` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.peakPowerBM, rightData?.peakPowerBM).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.peakPowerBM, rightData?.peakPowerBM).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>RSI</td>
                        <td>{leftData?.rsi ? leftData.rsi.toFixed(3) : 'N/A'}</td>
                        <td>{rightData?.rsi ? rightData.rsi.toFixed(3) : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.rsi, rightData?.rsi).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.rsi, rightData?.rsi).percentage}
                        </td>
                      </tr>
                      <tr>
                        <td>Peak Power</td>
                        <td>{leftData?.peakPower ? `${leftData.peakPower.toFixed(2)} W` : 'N/A'}</td>
                        <td>{rightData?.peakPower ? `${rightData.peakPower.toFixed(2)} W` : 'N/A'}</td>
                        <td style={{
                          color: calculateAsymmetry(leftData?.peakPower, rightData?.peakPower).color,
                          fontWeight: '600'
                        }}>
                          {calculateAsymmetry(leftData?.peakPower, rightData?.peakPower).percentage}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#F8F9FA', borderRadius: '6px' }}>
                  <h4 style={{ color: '#2C3E50', fontSize: '1rem', marginBottom: '0.5rem' }}>Asymmetry Color Guide:</h4>
                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
                    <div><span style={{ color: '#27AE60', fontWeight: '600' }}>● Green:</span> ≤5% (Good)</div>
                    <div><span style={{ color: '#F39C12', fontWeight: '600' }}>● Yellow:</span> 5-10% (Moderate)</div>
                    <div><span style={{ color: '#E74C3C', fontWeight: '600' }}>● Red:</span> &gt;10% (High)</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="placeholder-section">
                <p className="placeholder-text">No Single Leg CMJ data available for this athlete.</p>
              </div>
            )}

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={slCmjRecommendations}
                onChange={(e) => setSlCmjRecommendations(e.target.value)}
                placeholder="Add training recommendations based on Single Leg CMJ results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'imtp':
        return (
          <div className="tab-content">
            <h2>Isometric Mid-Thigh Pull (IMTP)</h2>

            {/* Detailed IMTP Metrics Table */}
            {reportData.tests?.imtp && (
              <div className="metrics-table-section">
                <h3>Detailed Metrics</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Athlete Value</th>
                        <th>Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Peak Vertical Force</td>
                        <td>{reportData.tests.imtp.peakVerticalForce?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.imtpComparison?.metrics?.peakVerticalForce?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Peak Vertical Force / BM</td>
                        <td>{reportData.tests.imtp.peakForceBM?.toFixed(2) || 'N/A'} N/kg</td>
                        <td>{reportData.imtpComparison?.metrics?.peakForceBM?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Force @ 100ms</td>
                        <td>{reportData.tests.imtp.forceAt100ms?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.imtpComparison?.metrics?.forceAt100ms?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Time to Peak Force</td>
                        <td>{reportData.tests.imtp.timeToPeakForce?.toFixed(3) || 'N/A'} s</td>
                        <td>{reportData.imtpComparison?.metrics?.timeToPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                    </tbody>
                  </table>
                  {reportData.imtpComparison && (
                    <p className="comparison-note">
                      Compared against professional baseball players from MLB/MiLB
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Spider Chart */}
            {reportData.tests?.imtp && reportData.imtpComparison && (
              <div className="spider-chart-section">
                <h3>Performance Comparison</h3>

                {/* Metric Selector */}
                <MetricSelector
                  testType="imtp"
                  availableMetrics={getAvailableMetrics('imtp')}
                  selectedMetrics={selectedMetrics.imtp}
                  onMetricsChange={(newMetrics) => handleMetricsChange('imtp', newMetrics)}
                />

                <div className="spider-chart-container">
                  {getIMTPSpiderChartData() && (
                    <Radar data={getIMTPSpiderChartData()} options={getIMTPChartOptions()} />
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={imtpRecommendations}
                onChange={(e) => setImtpRecommendations(e.target.value)}
                placeholder="Add training recommendations based on IMTP results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'plyo-pushup':
        return (
          <div className="tab-content">
            <h2>Plyometric Push-Up (PPU)</h2>

            {/* Detailed PPU Metrics Table */}
            {reportData.tests?.ppu && (
              <div className="metrics-table-section">
                <h3>Detailed Metrics</h3>
                <div className="cmj-metrics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Athlete Value</th>
                        <th>Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Pushup Height</td>
                        <td>{reportData.ppuComparison?.metrics?.pushupHeight?.value?.toFixed(2) || 'N/A'} in</td>
                        <td>{reportData.ppuComparison?.metrics?.pushupHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Peak Force</td>
                        <td>{reportData.tests.ppu.eccentricPeakForce?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.ppuComparison?.metrics?.eccentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric Peak Force</td>
                        <td>{reportData.tests.ppu.concentricPeakForce?.toFixed(2) || 'N/A'} N</td>
                        <td>{reportData.ppuComparison?.metrics?.concentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric RFD Left</td>
                        <td>{reportData.tests.ppu.concentricRFD_L?.toFixed(2) || 'N/A'} N/s</td>
                        <td>{reportData.ppuComparison?.metrics?.concentricRFD_L?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Concentric RFD Right</td>
                        <td>{reportData.tests.ppu.concentricRFD_R?.toFixed(2) || 'N/A'} N/s</td>
                        <td>{reportData.ppuComparison?.metrics?.concentricRFD_R?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                      <tr>
                        <td>Eccentric Braking RFD</td>
                        <td>{reportData.tests.ppu.eccentricBrakingRFD?.toFixed(2) || 'N/A'} N/s</td>
                        <td>{reportData.ppuComparison?.metrics?.eccentricBrakingRFD?.percentile?.toFixed(1) || 'N/A'}%</td>
                      </tr>
                    </tbody>
                  </table>
                  {reportData.ppuComparison?.summary?.totalTests && (
                    <p className="comparison-note">
                      Compared against professional baseball players from MLB/MiLB
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Spider Chart */}
            {reportData.tests?.ppu && reportData.ppuComparison && (
              <div className="spider-chart-section">
                <h3>Performance Comparison</h3>

                {/* Metric Selector */}
                <MetricSelector
                  testType="ppu"
                  availableMetrics={getAvailableMetrics('ppu')}
                  selectedMetrics={selectedMetrics.ppu}
                  onMetricsChange={(newMetrics) => handleMetricsChange('ppu', newMetrics)}
                />

                <div className="spider-chart-container">
                  {getPPUSpiderChartData() && (
                    <Radar data={getPPUSpiderChartData()} options={getPPUChartOptions()} />
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="recommendations-section">
              <h3>Recommendations</h3>
              <textarea
                value={ppuRecommendations}
                onChange={(e) => setPpuRecommendations(e.target.value)}
                placeholder="Add training recommendations based on PPU results..."
                rows={8}
              />
            </div>
          </div>
        );

      case 'training-plan':
        return (
          <div className="tab-content">
            <h2>Training Goals & Action Plan</h2>
            <div className="assessment-section">
              <div className="assessment-field">
                <label>Training Goals</label>
                <textarea
                  value={trainingGoals.goals}
                  onChange={(e) => setTrainingGoals({...trainingGoals, goals: e.target.value})}
                  placeholder="Define specific, measurable training goals for this athlete..."
                  rows={8}
                />
              </div>

              <div className="assessment-field">
                <label>Action Plan</label>
                <textarea
                  value={trainingGoals.actionPlan}
                  onChange={(e) => setTrainingGoals({...trainingGoals, actionPlan: e.target.value})}
                  placeholder="Outline the step-by-step action plan to achieve the training goals..."
                  rows={10}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="report-viewer-container">
      {/* Report Header */}
      <div className="report-header-new">
        <div className="header-logo-section">
          <img src="/push-performance-logo.png" alt="Push Performance" className="company-logo" />
          <div className="header-divider"></div>
          <h1 className="report-title">Performance Assessment Report</h1>
        </div>
        <div className="athlete-info-card">
          <div className="athlete-info-row">
            <div className="athlete-info-main">
              <h2 className="athlete-name">{athlete?.name}</h2>
              <p className="report-date">{new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
            </div>
            <div className="athlete-info-details">
              <div className="info-field">
                <label>Age</label>
                <input
                  type="text"
                  value={athleteInfo.age}
                  onChange={(e) => setAthleteInfo({...athleteInfo, age: e.target.value})}
                  placeholder="--"
                  className="info-input"
                />
              </div>
              <div className="info-field">
                <label>Height</label>
                <input
                  type="text"
                  value={athleteInfo.height}
                  onChange={(e) => setAthleteInfo({...athleteInfo, height: e.target.value})}
                  placeholder="e.g., 6'2&quot;"
                  className="info-input"
                />
              </div>
              <div className="info-field">
                <label>Weight</label>
                <input
                  type="text"
                  value={athleteInfo.weight}
                  onChange={(e) => setAthleteInfo({...athleteInfo, weight: e.target.value})}
                  placeholder="e.g., 210 lbs"
                  className="info-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="report-content-wrapper">
        {/* Sidebar Navigation */}
        <aside className="sidebar-navigation">
          <div className="sidebar-header">REPORT SECTIONS</div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Tab Content */}
        <div className="report-content">
          {renderTabContent()}
        </div>
      </div>

      {/* Actions */}
      <div className="report-actions">
        <button
          className="save-btn"
          onClick={generatePDF}
          disabled={saving}
        >
          {saving ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* PDF Generation Progress Modal */}
      {saving && (
        <div className="pdf-generation-modal">
          <div className="pdf-generation-content">
            <div className="pdf-generation-header">
              <h3>Generating Performance Report</h3>
              <p>Please wait while we create your PDF...</p>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${generatingProgress}%` }}
                ></div>
              </div>
              <div className="progress-percentage">{generatingProgress}%</div>
            </div>

            <div className="progress-steps">
              <div className={`progress-step ${generatingProgress >= 20 ? 'completed' : ''}`}>
                <div className="step-icon">✓</div>
                <div className="step-text">Collecting data</div>
              </div>
              <div className={`progress-step ${generatingProgress >= 40 ? 'completed' : ''}`}>
                <div className="step-icon">✓</div>
                <div className="step-text">Generating charts</div>
              </div>
              <div className={`progress-step ${generatingProgress >= 60 ? 'completed' : ''}`}>
                <div className="step-icon">✓</div>
                <div className="step-text">Creating layout</div>
              </div>
              <div className={`progress-step ${generatingProgress >= 80 ? 'completed' : ''}`}>
                <div className="step-icon">✓</div>
                <div className="step-text">Rendering PDF</div>
              </div>
              <div className={`progress-step ${generatingProgress === 100 ? 'completed' : ''}`}>
                <div className="step-icon">✓</div>
                <div className="step-text">Complete</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportViewer;
