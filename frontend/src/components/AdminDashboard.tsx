import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAnalyticsSummary } from '../services/api';
import type { AnalyticsSummary } from '../types/api';
import {
  ErrorStateCard,
  FallbackNoticeBanner,
  LoadingStateCard,
  SkeletonCards,
} from './ApiStateCard';

interface AdminDashboardProps {
  onBack: () => void;
}

const CHART_COLORS = ['#12346b', '#e86f1f', '#147a4b', '#b88420', '#9b3d2c', '#4e596f'];

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const reqKey = `${includeSynthetic}|${refreshCount}`;
  const loading = settledKey !== reqKey;

  useEffect(() => {
    let active = true;
    getAnalyticsSummary('agra', includeSynthetic)
      .then((res) => {
        if (!active) return;
        setSummary(res);
        setError('');
        setSettledKey(reqKey);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to fetch analytics summary.');
        setSettledKey(reqKey);
      });
    return () => {
      active = false;
    };
  }, [reqKey, includeSynthetic]);

  return (
    <div className="admin-shell">
      <div className="tricolour-bar" />

      <div className="admin-shell__inner">
        <header className="admin-shell__header">
          <div>
            <h1>UP Tourism Department — Visitor Insights (UC-9)</h1>
            <p>
              Privacy-first aggregated telemetry for Agra (zero PII) · Synthetic test baseline + live interactions
            </p>
          </div>

          <div className="filter-row" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`pill-btn ${includeSynthetic ? 'is-active' : ''}`}
              onClick={() => setIncludeSynthetic((v) => !v)}
            >
              {includeSynthetic ? 'Live + Synthetic Data' : 'Live Events Only'}
            </button>

            <button
              type="button"
              className="pill-btn"
              onClick={() => setRefreshCount((n) => n + 1)}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spin-icon" /> : <RefreshCw size={16} />}
              <span>Refresh</span>
            </button>

            <button type="button" className="pill-btn is-saffron" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back to App</span>
            </button>
          </div>
        </header>

        {loading && !summary && (
          <div style={{ display: 'grid', gap: 14 }}>
            <LoadingStateCard
              message="Loading UP Tourism Department analytics..."
              subMessage="Aggregating live session telemetry and content gap signals."
              compact
            />
            <SkeletonCards variant="dashboard" />
          </div>
        )}

        {loading && summary && (
          <FallbackNoticeBanner
            message="Refreshing live visitor insights..."
            variant="info"
            loading
          />
        )}

        {!loading && error && !summary && (
          <ErrorStateCard
            title="Unable to load Visitor Insights"
            message="The analytics API could not be reached. The backend may be starting up or offline."
            detail={error}
            retryLabel="Retry"
            onRetry={() => setRefreshCount((n) => n + 1)}
            secondaryAction={{ label: 'Back to App', onClick: onBack }}
          />
        )}

        {!loading && error && summary && (
          <FallbackNoticeBanner
            message={`Refresh failed: ${error}`}
            retryLabel="Retry"
            onRetry={() => setRefreshCount((n) => n + 1)}
            variant="warning"
          />
        )}

        {summary && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-card__label">Total Interactions</div>
                <div className="kpi-card__value">{summary.total_events}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card__label">Live Session Events</div>
                <div className="kpi-card__value">{summary.live_events}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card__label">Synthetic Baseline</div>
                <div className="kpi-card__value">{summary.synthetic_events}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card__label">Content Gaps Flagged</div>
                <div className="kpi-card__value" style={{ color: 'var(--terracotta)' }}>
                  {summary.knowledge_gaps.length}
                </div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <h3>Most Visited & Queried Spots</h3>
                <div className="chart-card__box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.popular_spots} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2d4be" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#12346b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Visitor Language Split</h3>
                <div className="chart-card__box">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.language_breakdown}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        label
                      >
                        {summary.language_breakdown.map((entry, idx) => (
                          <Cell key={entry.label} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Facility Searches (Infrastructure Demand)</h3>
                <div className="chart-card__box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.facility_demand} margin={{ top: 8, right: 12, left: -12, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2d4be" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#147a4b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Visitor Persona Modes</h3>
                <div className="chart-card__box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.persona_breakdown} margin={{ top: 8, right: 12, left: -12, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2d4be" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#e86f1f" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <h3>Top Visitor Questions</h3>
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Question / Topic</th>
                      <th style={{ textAlign: 'right' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_questions.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="insights-table__count">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="chart-card" style={{ borderLeft: '4px solid var(--terracotta)' }}>
                <h3>Missing Information / Content Gaps</h3>
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Unanswered Query (Action for Signage/KB)</th>
                      <th style={{ textAlign: 'right' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.knowledge_gaps.length ? (
                      summary.knowledge_gaps.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td className="insights-table__count">{row.count}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2}>No content gaps flagged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
