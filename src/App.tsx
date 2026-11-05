import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell,
  Check, ChevronDown, ChevronRight, CircleHelp, CloudSun,
  Download, Droplets, Factory, Gauge, Leaf, MapPin, Menu, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Play, Plus, RefreshCw, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Waves, Wind, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  alerts as initialAlerts, dailySeries, infrastructure, monthlySeries, pumpRows,
  zones, type AlertItem, type Infrastructure,
} from './data'
import { optimize, type OptimizationInput, type OptimizationResult } from './optimization'
import { isSupabaseConfigured, supabase } from './supabase'
import './App.css'

type PageId = 'overview' | 'water' | 'energy' | 'forecast' | 'optimization' | 'map' | 'sustainability' | 'reports' | 'settings'
type ForecastKind = 'Water demand' | 'Energy demand'
type ConnectedSummary = { waterMl: number; supplyMl: number; energyMwh: number; renewableMwh: number; pumpingMwh: number; treatmentMwh: number; distributionMwh: number }
const SmartMap = lazy(() => import('./SmartMap'))
const navigation: { id: PageId; label: string; icon: typeof Activity; group?: string }[] = [
  { id: 'overview', label: 'Overview', icon: Activity, group: 'WORKSPACE' },
  { id: 'water', label: 'Water management', icon: Droplets },
  { id: 'energy', label: 'Energy management', icon: Zap },
  { id: 'forecast', label: 'Demand forecasting', icon: Activity },
  { id: 'optimization', label: 'Optimisation engine', icon: SlidersHorizontal, group: 'INTELLIGENCE' },
  { id: 'map', label: 'Infrastructure map', icon: MapPin },
  { id: 'sustainability', label: 'Sustainability', icon: Leaf },
  { id: 'reports', label: 'Reports', icon: Download, group: 'MANAGE' },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const titles: Record<PageId, { title: string; subtitle: string }> = {
  overview: { title: 'Overview dashboard', subtitle: 'A real-time view of your urban water–energy network.' },
  water: { title: 'Water management', subtitle: 'Monitor supply, distribution, storage and network losses.' },
  energy: { title: 'Energy management', subtitle: 'Track energy use, operating efficiency and renewable generation.' },
  forecast: { title: 'Demand forecasting', subtitle: 'Explore a transparent baseline forecast for upcoming demand.' },
  optimization: { title: 'Optimisation engine', subtitle: 'Find a feasible operating schedule across cost, energy and carbon.' },
  map: { title: 'Infrastructure map', subtitle: 'Explore operational assets across the city network.' },
  sustainability: { title: 'Sustainability analytics', subtitle: 'Measure environmental performance with transparent formulas.' },
  reports: { title: 'Reports', subtitle: 'Build and export a concise performance report for your team.' },
  settings: { title: 'Settings', subtitle: 'Manage your demonstration data and optional connections.' },
}

const chartTooltip = {
  contentStyle: { background: '#ffffff', border: '1px solid #e5e8e3', borderRadius: 8, color: '#303a35', fontSize: 12 },
  labelStyle: { color: '#737d77', marginBottom: 5 },
  itemStyle: { color: '#303a35' },
}

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const number = (n: number, digits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n)
const demoAccounts = [
  { role: 'admin' as const, label: 'Administrator', email: 'admin@nexus.demo', password: 'NexusAdmin2026!' },
  { role: 'user' as const, label: 'Standard user', email: 'user@nexus.demo', password: 'NexusUser2026!' },
]

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'green' | 'amber' | 'red' | 'blue' }) {
  return <span className={`badge badge-${tone}`}><span className="badge-dot" />{children}</span>
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="section-title"><h2>{title}</h2>{action}</div>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

function LoginPage({ configured, loading, email, setEmail, password, setPassword, message, onSubmit, onContinueDemo }: {
  configured: boolean
  loading: boolean
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  message: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onContinueDemo: () => void
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Droplets size={18} /><Zap size={10} className="brand-bolt" /></div>
          <div className="brand-name">nexus<span>URBAN SYSTEMS</span></div>
        </div>
        <div className="login-heading">
          <span className="eyebrow">CITY OPERATIONS / METROVALE</span>
          <h1>Welcome back</h1>
          <p>Sign in to your urban systems workspace.</p>
        </div>
        {loading ? <div className="login-message" role="status">Restoring your session…</div> : (
          <form className="login-form" onSubmit={onSubmit}>
            <label>Email address
              <input type="email" autoComplete="username" placeholder="you@city.gov" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="primary-btn login-submit" type="submit">Sign in <ArrowRight size={15} /></button>
            {message && <div className="login-message" role="alert">{message}</div>}
          </form>
        )}
        {!loading && <div className="demo-accounts">
          <div className="demo-accounts-heading"><strong>Demo accounts</strong><span>Prototype access only</span></div>
          {demoAccounts.map((account) => <button className="demo-account" type="button" key={account.role} onClick={() => { setEmail(account.email); setPassword(account.password) }}>
            <span className="demo-account-role">{account.label}</span>
            <span><b>Email</b><code>{account.email}</code></span>
            <span><b>Password</b><code>{account.password}</code></span>
            <span className="demo-account-action">Use account</span>
          </button>)}
          <p>These credentials are built into this prototype and are not secure. {configured ? 'Real Supabase sign-in is also available.' : 'Supabase sign-in is not configured.'}</p>
        </div>}
        {!loading && <div className="login-demo">
          <span>Just exploring?</span>
          <button type="button" className="outline-btn" onClick={onContinueDemo}>Continue with demo</button>
        </div>}
        <p className="login-footnote">Secure access to water, energy and infrastructure insights.</p>
      </section>
    </main>
  )
}

function StatCard({ title, value, unit, change, changeLabel, icon: Icon, tone = 'cyan', spark = [4, 6, 5, 8, 6, 9, 8] }: {
  title: string; value: string; unit: string; change: string; changeLabel: string; icon: typeof Activity; tone?: string; spark?: number[]
}) {
  return (
    <Card className="stat-card">
      <div className="stat-head"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon size={16} /></span></div>
      <div className="stat-value">{value}<span>{unit}</span></div>
      <div className="stat-foot"><span className="trend-positive"><ArrowDownRight size={13} /> {change}</span><span>{changeLabel}</span>
        <svg className="sparkline" viewBox="0 0 74 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={spark.map((v, i) => `${i * 12},${23 - v * 2}`).join(' ')} /></svg>
      </div>
    </Card>
  )
}

const baseOptimisation: OptimizationInput = {
  demandMl: 228, supplyMl: 270, pumpCount: 8, pumpCapacityMlDay: 48, tariff: 0.16,
  solarMwh: 24, reservoirCapacityMl: 420, reservoirLevelMl: 272, reservePercent: 25,
  waterLossPercent: 8.6, weights: { cost: 15, energy: 60, water: 15, carbon: 10 },
}

function App() {
  const [page, setPage] = useState<PageId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [zoneFilter, setZoneFilter] = useState('All zones')
  const [waterRange, setWaterRange] = useState('Last 30 days')
  const [forecastKind, setForecastKind] = useState<ForecastKind>('Water demand')
  const [forecastDays, setForecastDays] = useState(7)
  const [forecastZone, setForecastZone] = useState('All zones')
  const [optimizationInput, setOptimizationInput] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus-optimization-input')
      if (!saved) return baseOptimisation
      const parsed = JSON.parse(saved) as Partial<OptimizationInput>
      const savedWeights = parsed.weights
      const hasPreviousDefaultWeights = savedWeights?.cost === 35 && savedWeights.energy === 25 && savedWeights.water === 20 && savedWeights.carbon === 20
      return {
        ...baseOptimisation,
        ...parsed,
        weights: hasPreviousDefaultWeights ? baseOptimisation.weights : { ...baseOptimisation.weights, ...savedWeights },
      }
    } catch {
      return baseOptimisation
    }
  })
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [optimizationError, setOptimizationError] = useState('')
  const [alertsList, setAlertsList] = useState<AlertItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('nexus-alerts') || 'null') || initialAlerts } catch { return initialAlerts }
  })
  const [assetDetail, setAssetDetail] = useState<Infrastructure | null>(null)
  const [dataMode, setDataMode] = useState<'simulation' | 'connected'>('simulation')
  const [refreshing, setRefreshing] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connectedSeries, setConnectedSeries] = useState<typeof dailySeries | null>(null)
  const [connectedSummary, setConnectedSummary] = useState<ConnectedSummary | null>(null)
  const [reportZone, setReportZone] = useState('All zones')
  const [reportPeriod, setReportPeriod] = useState('Last 30 days')
  const [reportReady, setReportReady] = useState(false)
  const [toast, setToast] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [demoRole, setDemoRole] = useState<'admin' | 'user' | null>(null)
  const [hasEnteredApp, setHasEnteredApp] = useState(false)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [search, setSearch] = useState('')
  const [resourceView, setResourceView] = useState<'Water' | 'Energy' | 'Combined'>('Water')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUserEmail(session?.user.email ?? '')
        if (session) setHasEnteredApp(true)
        else setHasEnteredApp(false)
      }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthMessage(error.message)
      else {
        setUserEmail(data.session?.user.email ?? '')
        setHasEnteredApp(Boolean(data.session))
      }
      setAuthLoading(false)
    }).catch((error: unknown) => {
      if (active) setAuthMessage(error instanceof Error ? error.message : 'Unable to restore the Supabase session.')
      if (active) setAuthLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('nexus-optimization-input', JSON.stringify(optimizationInput))
  }, [optimizationInput])

  const unreadCount = alertsList.filter((item) => !item.read).length
  const current = titles[page]
  const currentSeries = dataMode === 'connected' && connectedSeries ? connectedSeries : dailySeries
  const waterData = waterRange === 'Last 7 days' ? currentSeries.slice(-7) : waterRange === 'Last 90 days' && dataMode === 'simulation' ? monthlySeries : currentSeries
  const filteredInfra = infrastructure.filter((item) => zoneFilter === 'All zones' || item.zone === zoneFilter)

  const forecastData = useMemo(() => {
    const zoneFactor = forecastZone === 'All zones' ? 1 : (zones.find((zone) => zone.name === forecastZone)?.demand ?? 228) / 228
    const base = (forecastKind === 'Water demand' ? 226 : 94) * zoneFactor
    const historical = (dataMode === 'connected' && connectedSeries ? connectedSeries : dailySeries).slice(-14).map((day) => ({
      ...day,
      actual: forecastKind === 'Water demand' ? day.water * zoneFactor : day.energy * zoneFactor,
    }))
    const mean = historical.reduce((sum, day) => sum + day.actual, 0) / historical.length
    const start = historical[0]?.actual ?? base
    const end = historical.at(-1)?.actual ?? base
    const trend = (end - start) / Math.max(1, historical.length - 1)
    const projected = Array.from({ length: forecastDays }, (_, index) => {
      const seasonal = Math.sin(((index + 15) / 7) * Math.PI) * (forecastKind === 'Water demand' ? 3.2 : 2.4)
      const prediction = Math.max(0, mean + trend * (index + 1) + seasonal)
      return {
        day: new Date(now.getTime() + (index + 1) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        forecast: Number(prediction.toFixed(1)),
        lower: Number((prediction * 0.94).toFixed(1)),
        upper: Number((prediction * 1.06).toFixed(1)),
      }
    })
    return { historical, projected, mean, trend }
  }, [dataMode, connectedSeries, forecastDays, forecastKind, forecastZone, now])

  const insights = useMemo(() => {
    const highLoss = [...zones].sort((a, b) => b.loss - a.loss)[0]
    return [
      { icon: Zap, tone: 'cyan', title: 'Shift flexible pumping to off-peak hours', body: 'The current tariff profile has a 42% off-peak spread. A schedule shift may lower daily operating cost.' },
      { icon: Droplets, tone: 'amber', title: `${highLoss.name} has the highest water loss`, body: `${highLoss.loss}% estimated loss is above the network average of 8.6%. Prioritise a pressure and meter review.` },
      { icon: Sun, tone: 'green', title: 'Use available solar generation', body: 'Solar output can offset a portion of daytime treatment and pumping demand.' },
    ]
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  const markAlert = (id: string) => {
    const updated = alertsList.map((item) => item.id === id ? { ...item, read: true } : item)
    setAlertsList(updated)
    localStorage.setItem('nexus-alerts', JSON.stringify(updated))
  }

  const runOptimization = () => {
    setOptimizationError('')
    try {
      setOptimizationResult(optimize(optimizationInput))
      showToast('Optimisation completed. Feasibility checks passed.')
    } catch (error) {
      setOptimizationResult(null)
      setOptimizationError(error instanceof Error ? error.message : 'Unable to run optimisation.')
    }
  }

  const refreshData = async (source: 'simulation' | 'connected' = dataMode) => {
    setRefreshing(true)
    try {
      if (source === 'connected' && supabase) {
        const from = new Date(Date.now() - 29 * 86400000).toISOString()
        const [waterResponse, energyResponse, renewableResponse] = await Promise.all([
          supabase.from('water_consumption').select('recorded_at,supplied_ml,consumed_ml').eq('is_simulated', false).gte('recorded_at', from).order('recorded_at'),
          supabase.from('energy_consumption').select('recorded_at,pumping_mwh,treatment_mwh,distribution_mwh').eq('is_simulated', false).gte('recorded_at', from).order('recorded_at'),
          supabase.from('renewable_energy').select('recorded_at,generation_mwh').eq('is_simulated', false).gte('recorded_at', from).order('recorded_at'),
        ])
        if (waterResponse.error) throw waterResponse.error
        if (energyResponse.error) throw energyResponse.error
        if (renewableResponse.error) throw renewableResponse.error
        if (!waterResponse.data?.length || !energyResponse.data?.length) {
          throw new Error('No non-simulated water and energy readings were found in the last 30 days. Sign in and add telemetry first.')
        }
        const grouped = new Map<string, { water: number; supply: number; pumping: number; treatment: number; distribution: number; renewable: number }>()
        const getDay = (recordedAt: string) => {
          const date = new Date(recordedAt).toISOString().slice(0, 10)
          if (!grouped.has(date)) grouped.set(date, { water: 0, supply: 0, pumping: 0, treatment: 0, distribution: 0, renewable: 0 })
          return grouped.get(date)!
        }
        waterResponse.data.forEach((row) => {
          const day = getDay(row.recorded_at)
          day.water += Number(row.consumed_ml)
          day.supply += Number(row.supplied_ml)
        })
        energyResponse.data.forEach((row) => {
          const day = getDay(row.recorded_at)
          day.pumping += Number(row.pumping_mwh)
          day.treatment += Number(row.treatment_mwh)
          day.distribution += Number(row.distribution_mwh)
        })
        renewableResponse.data.forEach((row) => {
          getDay(row.recorded_at).renewable += Number(row.generation_mwh)
        })
        const liveSeries = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
          .filter(([, values]) => values.water > 0 && values.pumping + values.treatment + values.distribution > 0)
          .map(([date, values], index, items) => ({
            day: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            water: values.water,
            energy: values.pumping + values.treatment + values.distribution,
            average: items.slice(Math.max(0, index - 6), index + 1).reduce((sum, [, item]) => sum + item.water, 0) / Math.min(7, index + 1),
            pumping: values.pumping,
            treatment: values.treatment,
            distribution: values.distribution,
            renewable: values.renewable,
            storage: 64,
            carbon: Math.max(0, values.pumping + values.treatment + values.distribution - values.renewable) * 0.338,
          }))
        if (!liveSeries.length) throw new Error('No dates have both real water and energy readings.')
        const latest = liveSeries.at(-1)!
        const latestDate = [...grouped.keys()].sort().filter((date) => {
          const values = grouped.get(date)!
          return values.water > 0 && values.pumping + values.treatment + values.distribution > 0
        }).at(-1)!
        const latestRaw = grouped.get(latestDate)!
        setConnectedSeries(liveSeries)
        setConnectedSummary({
          waterMl: latest.water, supplyMl: latestRaw.supply, energyMwh: latest.energy, renewableMwh: latest.renewable,
          pumpingMwh: latest.pumping, treatmentMwh: latest.treatment, distributionMwh: latest.distribution,
        })
        setDataMode('connected')
        setConnected(true)
        showToast(`${liveSeries.length} days of connected telemetry loaded.`)
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 600))
        setConnected(false)
        setConnectedSeries(null)
        setConnectedSummary(null)
        setDataMode('simulation')
        showToast('Simulation data refreshed.')
      }
    } catch (error) {
      setConnected(false)
      setDataMode('simulation')
      setConnectedSeries(null)
      setConnectedSummary(null)
      showToast(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRefreshing(false)
    }
  }

  const toggleDataMode = async (mode: 'simulation' | 'connected') => {
    if (mode === 'connected' && !isSupabaseConfigured) {
      showToast('Add Supabase URL and anon key in .env to enable connected data.')
      return
    }
    if (mode === 'connected') {
      await refreshData(mode)
    } else {
      setDataMode(mode)
      setConnected(false)
      setConnectedSeries(null)
      setConnectedSummary(null)
      showToast('Switched to simulation data.')
    }
  }

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault()
    const demoAccount = demoAccounts.find((account) => account.email === authEmail.trim().toLowerCase())
    if (demoAccount) {
      if (authPassword !== demoAccount.password) {
        setAuthMessage('The password for this demo account is incorrect.')
        return
      }
      setDemoRole(demoAccount.role)
      setUserEmail(demoAccount.email)
      setAuthMessage('')
      setHasEnteredApp(true)
      return
    }
    if (!supabase) {
      setAuthMessage('Use one of the listed demo accounts, or configure Supabase email sign-in.')
      return
    }
    try {
      setAuthMessage('')
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) throw error
      setDemoRole(null)
      setUserEmail(data.user.email ?? authEmail)
      setHasEnteredApp(true)
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Sign-in failed.')
    }
  }

  const continueWithDemo = () => {
    setAuthMessage('')
    setHasEnteredApp(true)
  }

  const signOut = async () => {
    if (demoRole) {
      setDemoRole(null)
      setUserEmail('')
      setHasEnteredApp(false)
      setAuthMessage('')
      return
    }
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) { setAuthMessage(error.message); return }
    setUserEmail('')
    setAuthMessage('Signed out.')
    setHasEnteredApp(false)
  }

  const generateCsv = () => {
    const records = (reportZone === 'All zones' ? zones : zones.filter((zone) => zone.name === reportZone))
    const water = connectedSummary?.waterMl ?? 228.4
    const energy = connectedSummary?.energyMwh ?? 93.8
    const supply = connectedSummary?.supplyMl ?? 249.8
    const solar = connectedSummary?.renewableMwh ?? 24.6
    const avgForecast = forecastData.projected.reduce((sum, item) => sum + item.forecast, 0) / forecastData.projected.length
    const rows: (string | number)[][] = [
      ['Section', 'Metric', 'Value', 'Unit', 'Zone', 'Period'],
      ...records.map((zone) => ['Water by zone', 'Daily demand', zone.demand, 'ML/day', zone.name, reportPeriod]),
      ['Water', 'Daily supply', supply, 'ML/day', reportZone, reportPeriod],
      ['Water', 'Daily demand', water, 'ML/day', reportZone, reportPeriod],
      ['Water', 'Estimated water loss', supply > 0 ? (supply - water) / supply * 100 : 0, '%', reportZone, reportPeriod],
      ['Energy', 'Daily electricity', energy, 'MWh/day', reportZone, reportPeriod],
      ['Energy', 'Energy intensity', water > 0 ? energy * 1000 / water : 0, 'kWh/ML', reportZone, reportPeriod],
      ['Energy', 'Renewable generation', solar, 'MWh/day', reportZone, reportPeriod],
      ['Sustainability', 'Estimated emissions', Math.max(0, energy - solar) * 0.338, 'tCO2/day', reportZone, reportPeriod],
      ['Forecast', `${forecastKind} average`, avgForecast, forecastKind === 'Water demand' ? 'ML/day' : 'MWh/day', forecastZone, `${forecastDays} days`],
    ]
    if (optimizationResult) {
      rows.push(
        ['Optimisation', 'Energy saved', optimizationResult.energySavedMwh, 'MWh/day', reportZone, reportPeriod],
        ['Optimisation', 'Cost savings', optimizationResult.costSaved, 'USD/day', reportZone, reportPeriod],
        ['Optimisation', 'Estimated carbon reduction', optimizationResult.carbonSavedTonnes, 'tCO2/day', reportZone, reportPeriod],
      )
    }
    downloadCsv(`nexus-performance-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    showToast('CSV report downloaded.')
  }

  const generatePdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFillColor(11, 18, 32)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setTextColor(240, 248, 255)
    doc.setFontSize(22)
    doc.text('NEXUS / PERFORMANCE BRIEF', 18, 24)
    doc.setTextColor(0, 194, 214)
    doc.setFontSize(10)
    doc.text(`GENERATED ${new Date().toLocaleString()}  ·  ${reportPeriod.toUpperCase()}  ·  ${reportZone.toUpperCase()}`, 18, 33)
    doc.setDrawColor(45, 64, 86)
    doc.line(18, 40, 192, 40)
    doc.setTextColor(220, 232, 244)
    doc.setFontSize(13)
    doc.text('Network performance summary', 18, 52)
    doc.setFontSize(11)
    const reportWater = connectedSummary?.waterMl ?? 228.4
    const reportSupply = connectedSummary?.supplyMl ?? 249.8
    const reportEnergy = connectedSummary?.energyMwh ?? 93.8
    const reportSolar = connectedSummary?.renewableMwh ?? 24.6
    const summary = [
      `Water demand: ${number(reportWater, 1)} ML/day`,
      `Energy use: ${number(reportEnergy, 1)} MWh/day`,
      `Energy intensity: ${number(reportWater > 0 ? reportEnergy * 1000 / reportWater : 0)} kWh/ML`,
      `Estimated water loss: ${number(reportSupply > 0 ? (reportSupply - reportWater) / reportSupply * 100 : 0, 1)}%`,
      `Renewable generation: ${number(reportSolar, 1)} MWh/day`,
      `Estimated emissions: ${number(Math.max(0, reportEnergy - reportSolar) * 0.338, 1)} tCO2/day`,
      `Baseline forecast: ${number(forecastData.projected.reduce((sum, item) => sum + item.forecast, 0) / forecastData.projected.length, 1)} ${forecastKind === 'Water demand' ? 'ML/day' : 'MWh/day'} average`,
    ]
    if (optimizationResult) {
      summary.push(`Optimised energy: ${number(optimizationResult.optimizedEnergyMwh, 1)} MWh/day (${number(optimizationResult.energySavedMwh, 1)} saved)`)
      summary.push(`Optimised cost: ${usd(optimizationResult.optimizedCost)} per day (${usd(optimizationResult.costSaved)} change)`)
      summary.push(`Estimated carbon reduction: ${number(optimizationResult.carbonSavedTonnes, 1)} tCO2/day`)
    }
    summary.forEach((text, index) => doc.text(`•  ${text}`, 22, 62 + index * 7))
    doc.setFontSize(13)
    const recommendationsTop = 73 + summary.length * 7
    doc.text('Operational recommendations', 18, recommendationsTop)
    doc.setFontSize(10)
    doc.text('1. Review pressure and meter performance in the highest-loss zone.', 22, recommendationsTop + 11)
    doc.text('2. Shift flexible pumping to lower-tariff hours when reserve constraints allow.', 22, recommendationsTop + 19)
    doc.text('3. Prioritise solar generation during treatment and pumping windows.', 22, recommendationsTop + 27)
    const trend = (dataMode === 'connected' && connectedSeries ? connectedSeries : dailySeries).slice(-7)
    const chartBase = 249
    doc.setTextColor(220, 232, 244)
    doc.setFontSize(11)
    doc.text('Resource trend · last 7 days', 18, 190)
    doc.setFontSize(8)
    doc.setTextColor(123, 145, 167)
    doc.text('WATER DEMAND / ML', 18, 198)
    doc.text('ENERGY USE / MWh', 112, 198)
    doc.setDrawColor(53, 71, 92)
    doc.line(18, chartBase, 95, chartBase)
    doc.line(112, chartBase, 189, chartBase)
    const maxWater = Math.max(...trend.map((item) => item.water), 1)
    const maxEnergy = Math.max(...trend.map((item) => item.energy), 1)
    trend.forEach((item, index) => {
      const x = 20 + index * 10.5
      const waterHeight = item.water / maxWater * 34
      const energyHeight = item.energy / maxEnergy * 34
      doc.setFillColor(34, 197, 211)
      doc.rect(x, chartBase - waterHeight, 6, waterHeight, 'F')
      doc.setFillColor(74, 134, 255)
      doc.rect(x + 94, chartBase - energyHeight, 6, energyHeight, 'F')
      doc.setTextColor(117, 139, 162)
      doc.setFontSize(6)
      doc.text(item.day, x - 1, chartBase + 6)
      doc.text(item.day, x + 93, chartBase + 6)
    })
    doc.setTextColor(117, 139, 162)
    doc.setFontSize(9)
    doc.text('Simulation data · Values are indicative and should be validated against utility telemetry.', 18, 280)
    doc.save(`nexus-performance-${new Date().toISOString().slice(0, 10)}.pdf`)
    showToast('PDF report downloaded.')
  }

  const resetDemo = () => {
    localStorage.removeItem('nexus-alerts')
    localStorage.removeItem('nexus-optimization-input')
    setAlertsList(initialAlerts)
    setOptimizationResult(null)
    setOptimizationInput(baseOptimisation)
    setDataMode('simulation')
    setConnected(false)
    setConnectedSeries(null)
    setConnectedSummary(null)
    setReportReady(false)
    showToast('Demo workspace reset to its starting state.')
  }

  const renderPage = () => {
    if (page === 'overview') return <Overview onNavigate={setPage} alertsList={alertsList} onReadAlert={markAlert} insights={insights} resourceView={resourceView} setResourceView={setResourceView} series={currentSeries} summary={connectedSummary} connected={dataMode === 'connected'} />
    if (page === 'water') return <WaterPage data={waterData} range={waterRange} setRange={setWaterRange} zone={zoneFilter} setZone={setZoneFilter} assets={filteredInfra} summary={connectedSummary} onNavigate={setPage} />
    if (page === 'energy') return <EnergyPage data={currentSeries} summary={connectedSummary} />
    if (page === 'forecast') return <ForecastPage kind={forecastKind} setKind={setForecastKind} days={forecastDays} setDays={setForecastDays} zone={forecastZone} setZone={setForecastZone} historical={forecastData.historical} projected={forecastData.projected} mean={forecastData.mean} trend={forecastData.trend} />
    if (page === 'optimization') return <OptimizationPage input={optimizationInput} setInput={setOptimizationInput} result={optimizationResult} error={optimizationError} onRun={runOptimization} />
    if (page === 'map') return <MapPage onSelect={setAssetDetail} />
    if (page === 'sustainability') return <SustainabilityPage />
    if (page === 'reports') return <ReportsPage zone={reportZone} setZone={setReportZone} period={reportPeriod} setPeriod={setReportPeriod} ready={reportReady} setReady={setReportReady} onCsv={generateCsv} onPdf={generatePdf} generatedAt={now} />
    return <SettingsPage mode={dataMode} setMode={toggleDataMode} configured={isSupabaseConfigured} connected={connected} refreshing={refreshing} onRefresh={refreshData} onReset={resetDemo} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} authMessage={authMessage} onAuth={authenticate} userEmail={userEmail} demoRole={demoRole} canResetDemo={demoRole === 'admin' || (!demoRole && Boolean(userEmail))} onSignOut={signOut} alertsList={alertsList} onReadAlert={markAlert} />
  }

  if (!hasEnteredApp) {
    return <LoginPage configured={isSupabaseConfigured} loading={authLoading} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} message={authMessage} onSubmit={authenticate} onContinueDemo={continueWithDemo} />
  }

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Droplets size={18} /><Zap size={10} className="brand-bolt" /></div>
          {sidebarOpen && <div className="brand-name">nexus<span>URBAN SYSTEMS</span></div>}
          <button className="icon-btn sidebar-toggle" aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button>
        </div>
        <div className="workspace-switch"><span className="workspace-avatar">M</span>{sidebarOpen && <><span className="workspace-copy">Metrovale City<span>City operations</span></span><ChevronDown size={14} /></>}</div>
        <nav className="side-nav">
          {navigation.map((item) => {
            const Icon = item.icon
            return <div key={item.id}>
              {item.group && sidebarOpen && <div className="nav-group">{item.group}</div>}
              <button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileMenu(false) }} title={!sidebarOpen ? item.label : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{sidebarOpen && item.label}</span>{item.id === 'settings' && unreadCount > 0 && sidebarOpen && <i className="nav-indicator" />}
              </button>
            </div>
          })}
        </nav>
        <div className="sidebar-bottom">
          {sidebarOpen && <div className="sidebar-status"><div className="status-top"><span className="live-dot" /> SYSTEM STATUS <span>LIVE</span></div><div className="status-meter"><i /></div><div className="status-foot"><span>Network health</span><strong>98.4%</strong></div></div>}
          <div className="sidebar-profile"><div className="profile-pic">{demoRole ? demoRole === 'admin' ? 'AD' : 'US' : 'JD'}</div>{sidebarOpen && <div className="profile-copy">{demoRole ? demoRole === 'admin' ? 'NEXUS Admin' : 'NEXUS User' : 'Jordan Davis'}<span>{demoRole ? demoRole === 'admin' ? 'Demo administrator' : 'Demo user' : 'Operations lead'}</span></div>}{sidebarOpen && <MoreHorizontal size={17} className="profile-more" />}</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-btn mobile-menu-btn" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button>
          <div className="breadcrumb">NEXUS <ChevronRight size={12} /> <span>{current.title}</span></div>
          <div className="topbar-actions">
            <div className="top-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && search.trim()) { const match = infrastructure.find((asset) => asset.name.toLowerCase().includes(search.toLowerCase()) || asset.id.toLowerCase().includes(search.toLowerCase())); if (match) { setAssetDetail(match); setPage('map') } else { const matchedZone = zones.find((zone) => zone.name.toLowerCase().includes(search.toLowerCase())); if (matchedZone && matchedZone.name !== 'All zones') { setZoneFilter(matchedZone.name); setPage('water') } else showToast('No matching asset or zone found.') } } }} placeholder="Search assets or zones..." /><kbd>↵</kbd></div>
            <div className="mode-switch"><button className={dataMode === 'simulation' ? 'selected' : ''} onClick={() => toggleDataMode('simulation')}><span className="sim-dot" />Simulation</button><button className={dataMode === 'connected' ? 'selected' : ''} onClick={() => toggleDataMode('connected')}><span className="connected-dot" />Connected</button></div>
            <button className="icon-btn notification-btn" aria-label={`${unreadCount} unread alerts`} onClick={() => setPage('overview')}><Bell size={17} />{unreadCount > 0 && <i>{unreadCount}</i>}</button>
            <button className="icon-btn refresh-btn" aria-label="Refresh data" onClick={() => refreshData()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spinning' : ''} /></button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />CITY OPERATIONS / METROVALE</div><h1>{current.title}</h1><p>{current.subtitle}</p></div><div className="heading-right"><div className="time-stamp"><span className="live-dot" />{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}<span className="divider">/</span> {dataMode === 'connected' ? 'CONNECTED DATA' : 'DEMO ENVIRONMENT'}</div>{page === 'overview' && <button className="primary-btn" onClick={() => setPage('optimization')}><Play size={14} fill="currentColor" /> Run optimisation</button>}</div></div>
          {renderPage()}
          <footer className="page-footer"><span>© 2025 NEXUS Urban Systems</span><span><span className="sim-dot" />{dataMode === 'connected' ? 'Connected water & energy readings · other indicators remain simulated' : 'Demonstration data · Indicative values only'}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map © OpenStreetMap</a></footer>
        </div>
      </main>
      {assetDetail && <div className="modal-backdrop" onClick={() => setAssetDetail(null)}><div className="asset-modal" onClick={(event) => event.stopPropagation()}><button className="icon-btn modal-close" onClick={() => setAssetDetail(null)} aria-label="Close"><X size={16} /></button><div className="asset-modal-top"><span className="asset-kind-icon"><Factory size={18} /></span><Badge tone="green">{assetDetail.status}</Badge></div><div className="eyebrow">{assetDetail.type} / {assetDetail.zone}</div><h2>{assetDetail.name}</h2><p>{assetDetail.id} · Last telemetry sync 4 minutes ago</p><div className="asset-detail-grid"><div><span>Water throughput</span><strong>{assetDetail.throughput} ML/day</strong></div><div><span>Energy use</span><strong>{assetDetail.energy} MWh/day</strong></div><div><span>Efficiency</span><strong>{assetDetail.efficiency}%</strong></div><div><span>Open alerts</span><strong>{assetDetail.alerts}</strong></div></div><div className="asset-modal-note"><ShieldCheck size={15} /> Asset telemetry is simulated for this demonstration.</div></div></div>}
      {toast && <div className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')}><X size={13} /></button></div>}
    </div>
  )
}

function Overview({ onNavigate, alertsList, onReadAlert, insights, resourceView, setResourceView, series, summary, connected }: { onNavigate: (page: PageId) => void; alertsList: AlertItem[]; onReadAlert: (id: string) => void; insights: { icon: typeof Activity; tone: string; title: string; body: string }[]; resourceView: 'Water' | 'Energy' | 'Combined'; setResourceView: (value: 'Water' | 'Energy' | 'Combined') => void; series: typeof dailySeries; summary: ConnectedSummary | null; connected: boolean }) {
  const water = summary?.waterMl ?? 228.4
  const supply = summary?.supplyMl ?? 249.8
  const energy = summary?.energyMwh ?? 93.8
  const renewable = summary?.renewableMwh ?? 24.6
  const lossPercent = supply > 0 ? (supply - water) / supply * 100 : 0
  const intensity = water > 0 ? energy * 1000 / water : 0
  const emissions = Math.max(0, energy - renewable) * 0.338
  const unread = alertsList.filter((alert) => !alert.read).slice(0, 4)
  return (
    <>
      <div className="stats-grid">
        <StatCard title="Water consumption" value={number(water, 1)} unit="ML / day" change={connected ? 'LIVE' : '2.4%'} changeLabel={connected ? 'connected reading' : 'vs last month'} icon={Droplets} />
        <StatCard title="Energy consumption" value={number(energy, 1)} unit="MWh / day" change={connected ? 'LIVE' : '4.1%'} changeLabel={connected ? 'connected reading' : 'vs last month'} icon={Zap} tone="blue" />
        <StatCard title="Energy intensity" value={number(intensity, 0)} unit="kWh / ML" change={connected ? 'LIVE' : '3.2%'} changeLabel={connected ? 'calculated from readings' : 'vs last month'} icon={Gauge} tone="violet" />
        <StatCard title="Water loss" value={number(lossPercent, 1)} unit="%" change={connected ? 'LIVE' : '0.8%'} changeLabel={connected ? 'calculated from readings' : 'vs last month'} icon={Waves} tone="amber" />
        <StatCard title="Renewable share" value={number(energy > 0 ? renewable / energy * 100 : 0, 1)} unit="%" change={connected ? 'LIVE' : '5.6%'} changeLabel={connected ? 'connected reading' : 'vs last month'} icon={Sun} tone="green" />
        <StatCard title="CO₂ emissions" value={number(emissions, 1)} unit="t / day" change={connected ? 'LIVE' : '6.8%'} changeLabel={connected ? 'calculated estimate' : 'vs last month'} icon={Leaf} tone="red" />
      </div>
      <div className="overview-grid">
        <Card className="chart-card overview-trend">
          <SectionTitle title="Resource consumption" action={<div className="tab-switch">{(['Water', 'Energy', 'Combined'] as const).map((view) => <button key={view} className={resourceView === view ? 'selected' : ''} onClick={() => setResourceView(view)}>{view}</button>)}</div>} />
          <div className="chart-legend">{resourceView !== 'Energy' && <span><i className="legend-water" /> Water demand <b>{number(water, 1)} ML</b></span>}{resourceView !== 'Water' && <span><i className="dot-blue" /> Energy demand <b>{number(energy, 1)} MWh</b></span>}{resourceView === 'Water' && <span><i className="legend-line" /> 7-day average <b>224 ML</b></span>}<span className="muted-right">LAST 14 DAYS</span></div>
          <div className="chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series.slice(-14)} margin={{ left: -20, right: 7, top: 10, bottom: 0 }}><defs><linearGradient id="waterFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#20c5d5" stopOpacity={0.22} /><stop offset="95%" stopColor="#20c5d5" stopOpacity={0} /></linearGradient><linearGradient id="energyFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3478f6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3478f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} />{resourceView !== 'Energy' && <Area type="monotone" dataKey="water" name="Water demand (ML)" stroke="#22c5d3" strokeWidth={2} fill="url(#waterFill)" />}{resourceView !== 'Water' && <Area type="monotone" dataKey="energy" name="Energy demand (MWh)" stroke="#568bff" strokeWidth={2} fill="url(#energyFill)" />}{resourceView === 'Water' && <Line type="monotone" dataKey="average" name="7-day average" stroke="#90a0b2" strokeDasharray="4 5" dot={false} strokeWidth={1.5} />}</AreaChart></ResponsiveContainer></div>
          <div className="chart-footnote"><span><i className={connected ? 'connected-dot' : 'sim-dot'} /> {connected ? 'Connected daily readings' : 'Simulated daily data'}</span><span>{connected ? 'Refresh for latest data' : 'Updated 4 min ago'}</span></div>
        </Card>
        <Card className="chart-card alerts-card">
          <SectionTitle title="System alerts" action={<button className="text-link" onClick={() => onNavigate('settings')}>View all <ArrowRight size={13} /></button>} />
          <div className="alert-count"><strong>{alertsList.filter((item) => !item.read).length}</strong><span>active notifications</span><span className="alert-window">LAST 24H</span></div>
          <div className="alert-list">{unread.length ? unread.map((alert) => <button className="alert-row" key={alert.id} onClick={() => onReadAlert(alert.id)}><span className={`alert-symbol ${alert.severity}`}><AlertTriangle size={15} /></span><span className="alert-text"><strong>{alert.title}</strong><span>{alert.description}</span><small>{alert.zone} <b>·</b> {alert.time}</small></span><ChevronRight size={14} /></button>) : <div className="empty-state">All caught up. No active alerts.</div>}</div>
          <button className="outline-btn full-btn" onClick={() => onNavigate('settings')}>Open alert centre <ArrowRight size={13} /></button>
        </Card>
        <Card className="chart-card energy-chart">
          <SectionTitle title="Energy profile" action={<span className="select-simple">THIS WEEK</span>} />
          <div className="energy-total"><strong>{number(energy, 1)} <small>MWh</small></strong><span className="trend-positive"><ArrowDownRight size={13} /> 4.1%</span><small>{connected ? 'connected reading' : 'vs previous period'}</small></div>
          <div className="chart-medium"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series.slice(-7)} margin={{ left: -20, right: 4, top: 8, bottom: 0 }}><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Bar dataKey="pumping" name="Pumping" stackId="energy" fill="#3478f6" radius={[0, 0, 0, 0]} /><Bar dataKey="treatment" name="Treatment" stackId="energy" fill="#19b9c9" /><Bar dataKey="distribution" name="Distribution" stackId="energy" fill="#8d7aff" radius={[4, 4, 0, 0]} /><Line dataKey="renewable" name="Renewables" stroke="#42d78a" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div>
          <div className="chart-footnote legend-inline"><span><i className="dot-blue" /> Pumping</span><span><i className="dot-cyan" /> Treatment</span><span><i className="dot-purple" /> Distribution</span><span><i className="dot-green" /> Renewables</span></div>
        </Card>
        <Card className="chart-card efficiency-card">
          <SectionTitle title="Network efficiency" action={<button className="icon-btn mini-btn" title="View sustainability formulas" onClick={() => onNavigate('sustainability')}><CircleHelp size={15} /></button>} />
          <div className="efficiency-score"><div className="ring"><span>82<small>/100</small></span></div><div><strong>Good performance</strong><span>+3 pts vs last month</span><Badge tone="green">ON TRACK</Badge></div></div>
          <div className="efficiency-metrics">{[
            ['Water recovery', '91.4%', 91], ['Pump efficiency', '84.2%', 84], ['Renewable coverage', '22.4%', 22],
          ].map(([label, value, width]) => <div className="eff-row" key={label as string}><div><span>{label}</span><b>{value}</b></div><div className="progress-track"><i style={{ width: `${width}%` }} /></div></div>)}</div>
          <button className="text-link efficiency-link" onClick={() => onNavigate('sustainability')}>View sustainability report <ArrowRight size={13} /></button>
        </Card>
        <Card className="summary-card">
          <div className="summary-head"><div><div className="eyebrow">NETWORK SNAPSHOT</div><h2>Operational summary</h2></div><span className="summary-map-icon"><MapPin size={16} /></span></div>
          <div className="summary-grid">
            <div><span>Current water demand</span><strong>{number(water, 1)} <small>ML/day</small></strong></div>
            <div><span>Available supply</span><strong>{number(summary?.supplyMl ?? 270, 1)} <small>ML/day</small></strong></div>
            <div><span>Pumping stations</span><strong>12 <small className="status-ok">· 11 online</small></strong></div>
            <div><span>Solar generation</span><strong>{number(renewable, 1)} <small>MWh today</small></strong></div>
          </div>
          <button className="summary-map-link" onClick={() => onNavigate('map')}>Explore infrastructure map <ArrowRight size={14} /></button>
        </Card>
        <Card className="insights-card">
          <div className="insight-heading"><span className="insight-icon"><Sparkles size={16} /></span><div><h2>Intelligent insights</h2><span>Based on your network data</span></div><Badge tone="blue">3 INSIGHTS</Badge></div>
          <div className="insight-items">{insights.map((item) => { const Icon = item.icon; return <div className="insight-item" key={item.title}><span className={`insight-mini ${item.tone}`}><Icon size={14} /></span><div><strong>{item.title}</strong><p>{item.body}</p></div></div> })}</div>
          <button className="text-link" onClick={() => onNavigate('optimization')}>Explore optimisation opportunities <ArrowRight size={13} /></button>
        </Card>
      </div>
    </>
  )
}

function WaterPage({ data, range, setRange, zone, setZone, assets, summary, onNavigate }: { data: typeof dailySeries; range: string; setRange: (value: string) => void; zone: string; setZone: (value: string) => void; assets: Infrastructure[]; summary: ConnectedSummary | null; onNavigate: (page: PageId) => void }) {
  const exportAssets = () => downloadCsv(`nexus-water-assets-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Asset ID', 'Zone', 'Daily supply (ML)', 'Consumption (ML)', 'Reservoir', 'Leakage status', 'Operational status'],
    ...assets.map((asset) => [asset.id, asset.zone, asset.throughput, Number((asset.throughput * 0.914).toFixed(1)), asset.type === 'Reservoir' ? '68.2%' : 'N/A', asset.alerts > 0 ? 'Review' : 'Normal', asset.status]),
  ])
  const consumed = summary?.waterMl ?? 228.4
  const supplied = summary?.supplyMl ?? 249.8
  const lost = Math.max(0, supplied - consumed)
  return (
    <>
      <div className="page-toolbar"><div className="filter-set"><label>ZONE <select value={zone} onChange={(event) => setZone(event.target.value)}><option>All zones</option>{zones.filter((item) => item.name !== 'All zones').map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>PERIOD <select value={range} onChange={(event) => setRange(event.target.value)}><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></label></div><Badge tone="green">NETWORK NORMAL</Badge></div>
      <div className="stats-grid four-stats">
        <StatCard title="Water supplied" value={number(supplied, 1)} unit="ML / day" change={summary ? 'LIVE' : '1.8%'} changeLabel={summary ? 'connected reading' : 'vs last month'} icon={Droplets} />
        <StatCard title="Water consumed" value={number(consumed, 1)} unit="ML / day" change={summary ? 'LIVE' : '2.4%'} changeLabel={summary ? 'connected reading' : 'vs last month'} icon={Waves} tone="blue" />
        <StatCard title="Water treated" value="252.1" unit="ML / day" change="1.2%" changeLabel="vs last month" icon={Factory} tone="violet" />
        <StatCard title="Water lost" value={number(lost, 1)} unit="ML / day" change={summary ? 'LIVE' : '0.8%'} changeLabel={summary ? 'calculated from readings' : 'vs last month'} icon={AlertTriangle} tone="amber" />
      </div>
      <div className="two-col">
        <Card className="chart-card"><SectionTitle title="Water demand trend" action={<Badge tone="blue">ML / DAY</Badge>} /><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}><defs><linearGradient id="waterPageFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#20c5d5" stopOpacity={0.2} /><stop offset="100%" stopColor="#20c5d5" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Area type="monotone" dataKey="water" stroke="#22c5d3" strokeWidth={2} fill="url(#waterPageFill)" /></AreaChart></ResponsiveContainer></div></Card>
        <Card className="chart-card"><SectionTitle title="Reservoir storage" action={<Badge tone="green">64.8% AVG.</Badge>} /><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailySeries.slice(-14)} margin={{ left: -18, right: 8, top: 8 }}><defs><linearGradient id="reservoirFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8b75f8" stopOpacity={0.22} /><stop offset="100%" stopColor="#8b75f8" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis domain={[35, 90]} tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><ReferenceLine y={40} stroke="#f87171" strokeDasharray="4 4" /><Area type="monotone" dataKey="storage" name="Storage (%)" stroke="#9b87ff" strokeWidth={2} fill="url(#reservoirFill)" /></AreaChart></ResponsiveContainer></div><div className="chart-footnote"><span><i className="legend-water" /> Storage level</span><span><i className="legend-red" /> Minimum operating threshold</span></div></Card>
        <Card className="chart-card"><SectionTitle title="Distribution by zone" action={<span className="select-simple">TODAY</span>} /><div className="zone-bars">{zones.filter((item) => item.name !== 'All zones').map((item) => <div className="zone-bar-row" key={item.name}><span>{item.name}</span><div className="progress-track"><i style={{ width: `${Math.min(100, (item.demand / 86) * 100)}%` }} /></div><strong>{item.demand} ML</strong></div>)}</div></Card>
        <Card className="chart-card loss-card"><SectionTitle title="Water loss analysis" action={<Badge tone="amber">ATTENTION</Badge>} /><div className="loss-summary"><div className="loss-number">8.6<span>%</span></div><div className="loss-copy"><strong>Non-revenue water</strong><span>Target threshold <b>&lt; 7.0%</b></span><span className="trend-positive"><ArrowDownRight size={13} /> 0.8% this month</span></div></div><div className="loss-bar"><span>249.8 ML supplied</span><div><i style={{ width: '91.4%' }} /><b /></div><span>228.4 ML consumed</span></div><div className="loss-foot"><span>21.4 ML estimated daily loss</span><button className="text-link" onClick={() => onNavigate('settings')}>View leakage alerts <ArrowRight size={12} /></button></div></Card>
      </div>
      <Card className="table-card"><SectionTitle title="Water infrastructure" action={<div className="table-actions"><Badge tone="muted">{assets.length} ASSETS</Badge><button className="outline-btn" onClick={exportAssets}><Download size={13} /> Export</button></div>} /><div className="table-scroll"><table><thead><tr><th>ASSET ID</th><th>ZONE</th><th>DAILY SUPPLY</th><th>CONSUMPTION</th><th>RESERVOIR</th><th>LEAKAGE STATUS</th><th>OPERATIONAL</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><span className="asset-table-id">{asset.id}</span></td><td>{asset.zone}</td><td>{asset.throughput} ML</td><td>{number(asset.throughput * 0.914, 1)} ML</td><td><span className="reservoir-cell">{asset.type === 'Reservoir' ? '68.2%' : '—'}</span></td><td><Badge tone={asset.alerts > 0 ? 'amber' : 'green'}>{asset.alerts > 0 ? 'Review' : 'Normal'}</Badge></td><td><Badge tone="green">{asset.status}</Badge></td></tr>)}</tbody></table></div></Card>
    </>
  )
}

function EnergyPage({ data, summary }: { data: typeof dailySeries; summary: ConnectedSummary | null }) {
  const energy = summary?.energyMwh ?? 93.8
  const solar = summary?.renewableMwh ?? 24.6
  const renewableShare = Math.min(100, energy > 0 ? solar / energy * 100 : 0)
  const gridShare = 100 - renewableShare
  return (
    <>
      <div className="stats-grid four-stats">
        <StatCard title="Total electricity" value={number(energy, 1)} unit="MWh / day" change={summary ? 'LIVE' : '4.1%'} changeLabel={summary ? 'connected reading' : 'vs last month'} icon={Zap} tone="blue" />
        <StatCard title="Pumping energy" value={number(summary?.pumpingMwh ?? 51.6, 1)} unit="MWh / day" change={summary ? 'LIVE' : '2.9%'} changeLabel={summary ? 'connected reading' : 'vs last month'} icon={Waves} />
        <StatCard title="Solar generation" value={number(solar, 1)} unit="MWh / day" change={summary ? 'LIVE' : '8.4%'} changeLabel={summary ? 'connected reading' : 'vs last month'} icon={Sun} tone="amber" />
        <StatCard title="Energy cost" value={summary ? `$${number(energy * 0.16, 1)}k` : '$12.4k'} unit="/ day" change={summary ? 'EST.' : '3.8%'} changeLabel={summary ? 'estimated at $0.16/kWh' : 'vs last month'} icon={Gauge} tone="violet" />
      </div>
      <div className="two-col energy-layout">
        <Card className="chart-card"><SectionTitle title="Energy consumption trend" action={<Badge tone="blue">MWH / DAY</Badge>} /><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.slice(-14)} margin={{ left: -20, right: 6, top: 8 }}><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Bar dataKey="pumping" name="Pumping" stackId="a" fill="#3478f6" /><Bar dataKey="treatment" name="Treatment" stackId="a" fill="#20c5d5" /><Bar dataKey="distribution" name="Distribution" stackId="a" fill="#8875ee" radius={[4, 4, 0, 0]} /><Line dataKey="renewable" name="Solar generation" stroke="#42d78a" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></Card>
        <Card className="chart-card renewable-card"><SectionTitle title="Energy mix" action={<Badge tone="muted">{summary ? 'CONNECTED' : 'SIMULATED'}</Badge>} /><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Grid electricity', value: gridShare }, { name: 'Renewables', value: renewableShare }]} dataKey="value" innerRadius={69} outerRadius={91} paddingAngle={4} stroke="none"><Cell fill="#3478f6" /><Cell fill="#33cc8b" /></Pie><Tooltip {...chartTooltip} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{number(renewableShare, 1)}%</strong><span>RENEWABLE</span></div></div><div className="mix-list"><span><i className="dot-blue" /> Grid electricity <b>{number(gridShare, 1)}%</b></span><span><i className="dot-green" /> Renewable energy <b>{number(renewableShare, 1)}%</b></span></div><div className="energy-cost"><span>Estimated carbon intensity</span><strong>0.338 <small>tCO₂ / MWh</small></strong></div></Card>
      </div>
      <Card className="table-card"><SectionTitle title="Pump performance" action={<Badge tone="green">11 OF 12 ONLINE</Badge>} /><div className="table-scroll"><table><thead><tr><th>PUMP ID</th><th>ZONE</th><th>OPERATING HOURS</th><th>ENERGY USE</th><th>EFFICIENCY</th><th>STATUS</th></tr></thead><tbody>{pumpRows.map((pump) => <tr key={pump.id}><td><span className="asset-table-id">{pump.id}</span></td><td>{pump.zone}</td><td>{pump.hours} hrs</td><td>{pump.energy} MWh</td><td><div className="efficiency-cell"><div className="progress-track"><i style={{ width: `${pump.efficiency}%` }} /></div>{pump.efficiency}%</div></td><td><Badge tone={pump.status === 'Online' ? 'green' : 'amber'}>{pump.status}</Badge></td></tr>)}</tbody></table></div></Card>
    </>
  )
}

function ForecastPage({ kind, setKind, days, setDays, zone, setZone, historical, projected, mean, trend }: {
  kind: ForecastKind; setKind: (value: ForecastKind) => void; days: number; setDays: (value: number) => void; zone: string; setZone: (value: string) => void; historical: { day: string; actual: number }[]; projected: { day: string; forecast: number; lower: number; upper: number }[]; mean: number; trend: number
}) {
  const exportForecast = () => downloadCsv(`nexus-${kind.toLowerCase().replaceAll(' ', '-')}-forecast.csv`, [
    ['Date', 'Forecast', 'Lower range', 'Upper range'],
    ...projected.map((item) => [item.day, item.forecast, item.lower, item.upper]),
  ])
  const combined = [...historical.slice(-7).map((item) => ({ day: item.day, actual: item.actual, forecast: undefined as number | undefined, lower: undefined as number | undefined, upper: undefined as number | undefined })), ...projected.map((item) => ({ ...item, actual: undefined as number | undefined }))]
  const peak = projected.reduce((best, item) => item.forecast > best.forecast ? item : best, projected[0])
  return (
    <>
      <Card className="forecast-controls"><div className="control-title"><div className="control-icon"><Activity size={17} /></div><div><strong>Forecast configuration</strong><span>Choose a demand series and horizon.</span></div></div><div className="forecast-selects"><label>FORECAST TYPE<select value={kind} onChange={(event) => setKind(event.target.value as ForecastKind)}><option>Water demand</option><option>Energy demand</option></select></label><label>FORECAST PERIOD<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Next 7 days</option><option value={15}>Next 15 days</option><option value={30}>Next 30 days</option></select></label><label>URBAN ZONE<select value={zone} onChange={(event) => setZone(event.target.value)}><option>All zones</option>{zones.filter((item) => item.name !== 'All zones').map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div><Badge tone="blue">SIMULATED BASELINE</Badge></Card>
      <div className="stats-grid three-stats">
        <StatCard title="Forecast daily average" value={number(projected.reduce((sum, item) => sum + item.forecast, 0) / projected.length, 1)} unit={kind === 'Water demand' ? 'ML / day' : 'MWh / day'} change={`${trend >= 0 ? '+' : ''}${number(trend, 1)}`} changeLabel="daily trend" icon={Activity} />
        <StatCard title="Expected peak demand" value={number(peak.forecast, 1)} unit={kind === 'Water demand' ? 'ML / day' : 'MWh / day'} change={peak.day} changeLabel="projected peak date" icon={ArrowUpRight} tone="amber" />
        <StatCard title="Forecast confidence" value="88" unit="%" change="±6%" changeLabel="uncertainty range" icon={Gauge} tone="green" />
      </div>
      <Card className="chart-card forecast-chart-card"><SectionTitle title={`${kind} forecast`} action={<Badge tone="muted">{days}-DAY HORIZON</Badge>} /><div className="chart-legend"><span><i className="legend-water" /> Historical actual</span><span><i className="legend-forecast" /> Forecast</span><span><i className="legend-confidence" /> Confidence range</span><span className="muted-right">SIMULATED DATA</span></div><div className="chart-very-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={combined} margin={{ left: -20, right: 10, top: 15 }}><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Area type="monotone" dataKey="upper" name="Upper estimate" stroke="none" fill="#22c5d3" fillOpacity={0.09} /><Area type="monotone" dataKey="lower" name="Lower estimate" stroke="none" fill="#111b2b" fillOpacity={1} /><Line type="monotone" dataKey="actual" name="Historical actual" stroke="#20c5d5" strokeWidth={2} dot={false} connectNulls={false} /><Line type="monotone" dataKey="forecast" name="Simulated forecast" stroke="#9b87ff" strokeWidth={2.2} strokeDasharray="5 4" dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div><div className="chart-footnote"><span>Baseline mean: <b>{number(mean, 1)} {kind === 'Water demand' ? 'ML/day' : 'MWh/day'}</b></span><span>Forecasts are indicative, not machine-learning predictions.</span></div></Card>
      <div className="two-col">
        <Card className="chart-card"><SectionTitle title="Forecast values" action={<button className="outline-btn" onClick={exportForecast}><Download size={13} /> Export CSV</button>} /><div className="table-scroll small-table"><table><thead><tr><th>DATE</th><th>FORECAST</th><th>LOWER RANGE</th><th>UPPER RANGE</th></tr></thead><tbody>{projected.slice(0, 8).map((item) => <tr key={item.day}><td>{item.day}</td><td>{number(item.forecast, 1)}</td><td>{number(item.lower, 1)}</td><td>{number(item.upper, 1)}</td></tr>)}</tbody></table></div></Card>
        <Card className="method-card"><div className="method-icon"><CircleHelp size={17} /></div><div><strong>How this forecast works</strong><p>A transparent baseline combines the recent 14-day average, linear trend and a small weekly seasonal adjustment. The uncertainty interval is ±6% of each estimate. Weather and population effects are represented by simulated variables in the sample dataset.</p><div className="method-formula">forecast = rolling mean + trend × horizon + weekly seasonality</div><Badge tone="amber">NOT AN ML MODEL</Badge></div></Card>
      </div>
    </>
  )
}

function OptimizationPage({ input, setInput, result, error, onRun }: { input: OptimizationInput; setInput: (value: OptimizationInput) => void; result: OptimizationResult | null; error: string; onRun: () => void }) {
  const update = (key: keyof Omit<OptimizationInput, 'weights'>, value: number) => setInput({ ...input, [key]: value })
  const updateWeight = (key: keyof OptimizationInput['weights'], value: number) => setInput({ ...input, weights: { ...input.weights, [key]: value } })
  const weightsTotal = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0)
  return (
    <>
      <div className="optim-intro"><div className="optim-intro-icon"><SlidersHorizontal size={19} /></div><div><strong>Energy-aware pump dispatch</strong><p>Compare feasible schedules, avoid inefficient part-load operation, and prioritize energy savings while respecting demand, capacity and reservoir reserve.</p></div><Badge tone="blue">ENERGY-AWARE MODEL</Badge></div>
      <div className="optimization-layout">
        <Card className="optim-input-card">
          <div className="form-header"><div><span className="eyebrow">SYSTEM PARAMETERS</span><h2>Operating constraints</h2></div><button className="icon-btn mini-btn" title="Reset inputs" onClick={() => setInput(baseOptimisation)}><RefreshCw size={14} /></button></div>
          <div className="input-grid">
            <NumberInput label="Daily water demand" unit="ML" value={input.demandMl} onChange={(value) => update('demandMl', value)} min={0} />
            <NumberInput label="Available water supply" unit="ML" value={input.supplyMl} onChange={(value) => update('supplyMl', value)} min={0} />
            <NumberInput label="Number of pumps" unit="units" value={input.pumpCount} onChange={(value) => update('pumpCount', value)} min={1} max={50} step={1} />
            <NumberInput label="Capacity per pump" unit="ML/day" value={input.pumpCapacityMlDay} onChange={(value) => update('pumpCapacityMlDay', value)} min={0} />
            <NumberInput label="Grid tariff" unit="$/kWh" value={input.tariff} onChange={(value) => update('tariff', value)} min={0} step={0.01} />
            <NumberInput label="Solar available" unit="MWh" value={input.solarMwh} onChange={(value) => update('solarMwh', value)} min={0} />
            <NumberInput label="Reservoir capacity" unit="ML" value={input.reservoirCapacityMl} onChange={(value) => update('reservoirCapacityMl', value)} min={0} />
            <NumberInput label="Current reservoir level" unit="ML" value={input.reservoirLevelMl} onChange={(value) => update('reservoirLevelMl', value)} min={0} />
            <NumberInput label="Minimum reserve" unit="%" value={input.reservePercent} onChange={(value) => update('reservePercent', value)} min={0} max={100} />
            <NumberInput label="Current water loss" unit="%" value={input.waterLossPercent} onChange={(value) => update('waterLossPercent', value)} min={0} max={60} step={0.1} />
          </div>
          <div className="weight-head"><div><span className="eyebrow">OBJECTIVE PRIORITIES</span><strong>Weighted optimisation</strong></div><button className="outline-btn energy-preset" onClick={() => setInput({ ...input, weights: { cost: 15, energy: 60, water: 15, carbon: 10 } })}>Prioritise energy</button><span className={weightsTotal !== 100 ? 'weight-warning' : ''}>{weightsTotal}% total</span></div>
          <div className="weight-sliders">{[
            ['cost', 'Cost minimisation', '#33c6d3'], ['energy', 'Energy efficiency', '#6b9bff'], ['water', 'Water conservation', '#53d994'], ['carbon', 'Carbon reduction', '#b08cff'],
          ].map(([key, label, color]) => <label className="weight-row" key={key}><span>{label}<b>{input.weights[key as keyof OptimizationInput['weights']]}%</b></span><input type="range" min="0" max="100" step="5" value={input.weights[key as keyof OptimizationInput['weights']]} style={{ accentColor: color }} onChange={(event) => updateWeight(key as keyof OptimizationInput['weights'], Number(event.target.value))} /></label>)}</div>
          <button className="primary-btn run-btn" onClick={onRun}><Play size={14} fill="currentColor" /> RUN OPTIMISATION <ArrowRight size={14} /></button>
          <div className="input-note"><ShieldCheck size={14} /> Energy and load-efficiency results are model estimates, not measured savings. Feasibility constraints are checked before recommending a schedule.</div>
        </Card>
        <div className="optim-results">
          {error && <Card className="error-card"><AlertTriangle size={16} /><div><strong>Optimisation could not run</strong><p>{error}</p></div></Card>}
          {!result && !error && <Card className="optim-empty"><div className="empty-graphic"><Activity size={26} /></div><h3>Ready to optimise</h3><p>Adjust system inputs and objective weights, then run the solver to generate a schedule and measurable comparisons.</p><div className="empty-checks"><span><Check size={13} /> Capacity constraints</span><span><Check size={13} /> Reservoir reserve</span><span><Check size={13} /> Renewable availability</span></div></Card>}
          {result && <>
            <Card className="result-banner"><div className="result-icon"><Check size={18} /></div><div><span className="eyebrow">FEASIBLE SOLUTION FOUND</span><strong>Recommended schedule is ready</strong><p>Objective score {number(result.score, 1)} / 100 · all hard constraints satisfied</p></div><Badge tone="green">OPTIMISED</Badge></Card>
            <div className="result-stats">
              <ResultStat label="Energy saved" value={`${number(result.energySavedMwh, 1)} MWh`} detail={`${number(result.energySavedPercent, 1)}% modelled reduction`} positive />
              <ResultStat label={result.costSaved >= 0 ? 'Cost savings' : 'Cost increase'} value={usd(Math.abs(result.costSaved))} detail={result.costSaved >= 0 ? `${number(result.costSavedPercent, 1)}% daily estimate` : `${number(Math.abs(result.costSavedPercent), 1)}% above baseline`} positive={result.costSaved >= 0} />
              <ResultStat label="CO₂ reduction" value={`${number(result.carbonSavedTonnes, 1)} t`} detail="estimated per day" positive />
              <ResultStat label="Loss reduction potential" value={`${number(result.waterLossPotentialMl, 1)} ML`} detail="pressure-management estimate" positive />
            </div>
            <Card className="chart-card comparison-card"><SectionTitle title="Energy use: baseline vs optimised" action={<Badge tone="muted">MWH / DAY</Badge>} /><div className="chart-medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.comparison.slice(0, 1)} margin={{ left: -10, right: 15, top: 8 }}><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Bar dataKey="baseline" name="Baseline" fill="#42546a" radius={[4, 4, 0, 0]} /><Bar dataKey="optimised" name="Optimised" fill="#21c3d1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="comparison-table"><div className="comparison-table-head"><span>DAILY METRIC</span><span>BASELINE</span><span>OPTIMISED</span><span>CHANGE</span></div><div className="comparison-table-row"><span>Energy</span><strong>{number(result.baselineEnergyMwh, 1)} MWh</strong><strong>{number(result.optimizedEnergyMwh, 1)} MWh</strong><em>{number(result.energySavedMwh, 1)} MWh saved</em></div><div className="comparison-table-row"><span>Operating cost</span><strong>{usd(result.baselineCost)}</strong><strong>{usd(result.optimizedCost)}</strong><em>{usd(result.costSaved)} saved</em></div><div className="comparison-table-row"><span>Carbon emissions</span><strong>{number(result.baselineCarbonTonnes, 1)} tCO₂</strong><strong>{number(result.optimizedCarbonTonnes, 1)} tCO₂</strong><em>{number(result.carbonSavedTonnes, 1)} t saved</em></div><div className="comparison-table-row"><span>Water loss</span><strong>{number(result.grossDemandMl - input.demandMl, 1)} ML</strong><strong>{number(Math.max(0, result.grossDemandMl - input.demandMl - result.waterLossPotentialMl), 1)} ML*</strong><em>{number(result.waterLossPotentialMl, 1)} ML potential</em></div></div></Card>
            <Card className="schedule-card"><SectionTitle title="Recommended pump schedule" action={<Badge tone="blue">24-HOUR DISPATCH</Badge>} /><div className="schedule-timeline">{result.schedule.map((slot) => <div key={slot.hour} className={`schedule-slot ${slot.pumps ? 'running' : ''}`} title={`${slot.label}: ${slot.pumps} pumps, ${number(slot.volumeMl, 1)} ML`}><i style={{ height: `${Math.max(4, slot.pumps / input.pumpCount * 100)}%` }} /><span>{slot.hour}</span></div>)}</div><div className="schedule-legend"><span><i className="schedule-dot active" /> Pumps active</span><span><i className="schedule-dot idle" /> Standby</span><span className="schedule-volume">{number(result.grossDemandMl, 1)} ML gross supply required</span></div></Card>
            <Card className="calculation-card"><SectionTitle title="Calculation & constraint checks" action={<Badge tone="green">VALIDATED</Badge>} /><div className="calculation-grid">{result.checks.map((check) => <div className="check-row" key={check.label}><span className="check-icon"><Check size={12} /></span><span>{check.label}</span><strong>{check.value}</strong></div>)}</div><div className="model-disclosure"><CircleHelp size={14} /><span>Energy efficiency and loss-reduction figures are modelled estimates based on a flatter pressure profile; validate against utility telemetry before operational use.</span></div></Card>
          </>}
        </div>
      </div>
    </>
  )
}

function NumberInput({ label, unit, value, onChange, min, max, step = 1 }: { label: string; unit: string; value: number; onChange: (value: number) => void; min: number; max?: number; step?: number }) {
  return <label className="number-input"><span>{label}</span><div><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></div></label>
}

function ResultStat({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean }) {
  return <Card className="result-stat"><span>{label}</span><strong>{value}</strong><small className={positive ? 'trend-positive' : 'trend-negative'}>{positive && <ArrowDownRight size={12} />}{detail}</small></Card>
}

function MapPage({ onSelect }: { onSelect: (asset: Infrastructure) => void }) {
  const [filter, setFilter] = useState('All assets')
  const list = infrastructure.filter((asset) => filter === 'All assets' || asset.type === filter)
  return <div className="map-page-layout"><Card className="map-card"><div className="map-toolbar"><div><strong>Metrovale network</strong><span>12 infrastructure assets · telemetry simulated</span></div><label><SlidersHorizontal size={13} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All assets</option>{['Treatment plant', 'Reservoir', 'Pumping station', 'Solar installation', 'Distribution zone'].map((type) => <option key={type}>{type}</option>)}</select></label></div><Suspense fallback={<div className="map-loading">Loading interactive map…</div>}><SmartMap assets={list} onSelect={onSelect} /></Suspense></Card><Card className="asset-list-card"><SectionTitle title="Infrastructure assets" action={<Badge tone="muted">{list.length} ITEMS</Badge>} /><div className="asset-list">{list.map((asset) => <button className="asset-list-row" key={asset.id} onClick={() => onSelect(asset)}><span className={`asset-dot ${asset.type.toLowerCase().replaceAll(' ', '-')}`}><MapPin size={14} /></span><span className="asset-list-main"><strong>{asset.name}</strong><span>{asset.type} · {asset.zone}</span></span><span className="asset-list-status"><i className={asset.status === 'Online' ? 'online' : 'offline'} />{asset.status}</span><ChevronRight size={14} /></button>)}</div><div className="asset-list-note"><CloudSun size={15} /> Weather and telemetry readings are simulated for demonstration.</div></Card></div>
}

function SustainabilityPage() {
  return <>
    <div className="stats-grid four-stats"><StatCard title="Carbon emissions" value="31.7" unit="tCO₂ / day" change="6.8%" changeLabel="vs last month" icon={Leaf} tone="green" /><StatCard title="Renewable contribution" value="22.4" unit="%" change="5.6%" changeLabel="vs last month" icon={Sun} tone="amber" /><StatCard title="Water-energy intensity" value="411" unit="kWh / ML" change="3.2%" changeLabel="vs last month" icon={Gauge} tone="blue" /><StatCard title="Estimated savings" value="8.2" unit="tCO₂ / day" change="12.4%" changeLabel="potential" icon={Wind} /></div>
    <div className="two-col"><Card className="chart-card"><SectionTitle title="Carbon emissions trend" action={<Badge tone="blue">tCO₂ / DAY</Badge>} /><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailySeries.slice(-14)} margin={{ left: -20, right: 8, top: 8 }}><defs><linearGradient id="carbonFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#42d78a" stopOpacity={0.2} /><stop offset="100%" stopColor="#42d78a" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202d3f" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#71839a', fontSize: 10 }} /><Tooltip {...chartTooltip} /><Area type="monotone" dataKey="carbon" stroke="#42d78a" strokeWidth={2} fill="url(#carbonFill)" /></AreaChart></ResponsiveContainer></div></Card>
      <Card className="chart-card"><SectionTitle title="Baseline vs optimised" action={<Badge tone="green">MODELLED</Badge>} /><div className="sustainability-bars">{[['Carbon emissions', '31.7', '25.4', 80], ['Energy use', '93.8', '88.2', 75], ['Water loss', '8.6%', '7.9%', 68]].map(([label, baseline, optimized, width]) => <div className="sustainability-row" key={label as string}><div><span>{label}</span><strong>{baseline}<small> → {optimized}</small></strong></div><div className="compare-track"><i style={{ width: `${width}%` }} /><b style={{ width: `${Number(width) * 0.8}%` }} /></div><div className="compare-legend"><span><i className="dot-grey" /> Baseline</span><span><i className="dot-green" /> Optimised</span></div></div>)}</div><div className="method-disclaimer"><CircleHelp size={13} /> Optimised values are illustrative model outputs, not measured savings.</div></Card>
    </div>
    <div className="sustainability-score-row"><Card className="sustainability-score"><div className="sustainability-score-icon"><Leaf size={18} /></div><div><span>SUSTAINABILITY PERFORMANCE SCORE</span><strong>82<span>/100</span></strong><p>Good trajectory · +4 points from last month</p></div><div className="score-progress"><div><i /></div><span>TOP 18% OF TARGET RANGE</span></div></Card><Card className="formula-card"><div className="formula-icon"><CircleHelp size={16} /></div><div><strong>Transparent metric formulas</strong><p>Energy intensity = daily electricity ÷ water volume. Renewable share = renewable generation ÷ total electricity. Estimated CO₂ = grid energy × 0.338 tCO₂/MWh. Water loss = (supply − billed demand) ÷ supply.</p></div></Card></div>
  </>
}

function ReportsPage({ zone, setZone, period, setPeriod, ready, setReady, onCsv, onPdf, generatedAt }: { zone: string; setZone: (value: string) => void; period: string; setPeriod: (value: string) => void; ready: boolean; setReady: (value: boolean) => void; onCsv: () => void; onPdf: () => void; generatedAt: Date }) {
  return <>
    <Card className="report-builder"><div className="report-builder-icon"><Download size={18} /></div><div className="report-builder-copy"><span className="eyebrow">REPORT BUILDER</span><h2>Performance report</h2><p>Generate an exportable summary of water, energy and sustainability performance for a selected period and zone.</p></div><div className="report-filters"><label>DATE RANGE<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></label><label>URBAN ZONE<select value={zone} onChange={(event) => setZone(event.target.value)}><option>All zones</option>{zones.filter((item) => item.name !== 'All zones').map((item) => <option key={item.name}>{item.name}</option>)}</select></label><button className="primary-btn" onClick={() => setReady(true)}><Plus size={14} /> Generate report</button></div></Card>
    {ready && <Card className="report-preview"><div className="report-preview-heading"><div><span className="eyebrow">REPORT PREVIEW</span><h2>NEXUS Urban Performance Brief</h2><span>Generated {generatedAt.toLocaleString()} · {period} · {zone}</span></div><Badge tone="green">READY TO EXPORT</Badge></div><div className="report-kpis"><div><span>Water consumption</span><strong>228.4 ML/day</strong></div><div><span>Energy consumption</span><strong>93.8 MWh/day</strong></div><div><span>Water loss</span><strong>8.6%</strong></div><div><span>CO₂ emissions</span><strong>31.7 t/day</strong></div></div><div className="report-recommendation"><Sparkles size={15} /><span><b>Recommendation:</b> Prioritise pressure and meter review in the highest-loss zone; shift flexible pumping toward lower-tariff periods where reserve constraints permit.</span></div><div className="report-export"><button className="outline-btn" onClick={onCsv}><Download size={14} /> Export CSV</button><button className="primary-btn" onClick={onPdf}><Download size={14} /> Export PDF</button></div></Card>}
    <div className="report-types"><SectionTitle title="Available report sections" /><div className="report-type-grid">{[['Water performance', Droplets, 'Supply, demand, reservoir status and leakage estimates.'], ['Energy performance', Zap, 'Consumption, energy intensity, costs and renewable share.'], ['Forecast results', Activity, 'Baseline demand outlook and uncertainty intervals.'], ['Optimisation outcomes', SlidersHorizontal, 'Feasibility, recommended dispatch and modelled savings.'], ['Sustainability metrics', Leaf, 'Emissions, conservation progress and transparent formulas.']].map(([label, Icon, desc]) => { const ItemIcon = Icon as typeof Activity; return <Card className="report-type" key={label as string}><span><ItemIcon size={16} /></span><strong>{label as string}</strong><p>{desc as string}</p><Check size={14} className="included-check" /></Card> })}</div></div>
  </>
}

function SettingsPage({ mode, setMode, configured, connected, refreshing, onRefresh, onReset, authEmail, setAuthEmail, authPassword, setAuthPassword, authMessage, onAuth, userEmail, demoRole, canResetDemo, onSignOut, alertsList, onReadAlert }: {
  mode: 'simulation' | 'connected'; setMode: (mode: 'simulation' | 'connected') => void; configured: boolean; connected: boolean; refreshing: boolean; onRefresh: () => void; onReset: () => void; authEmail: string; setAuthEmail: (value: string) => void; authPassword: string; setAuthPassword: (value: string) => void; authMessage: string; onAuth: (event: React.FormEvent) => void; userEmail: string; demoRole: 'admin' | 'user' | null; canResetDemo: boolean; onSignOut: () => void
  alertsList: AlertItem[]; onReadAlert: (id: string) => void
}) {
  return <div className="settings-layout">
    <div className="settings-main">
      <Card className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Activity size={17} /></div><div><h2>Data source</h2><p>Choose between the built-in city simulation and your configured Supabase project.</p></div></div><div className="data-source-options"><button className={`source-option ${mode === 'simulation' ? 'source-active' : ''}`} onClick={() => setMode('simulation')}><span className="source-radio" /><div><strong>Simulation data</strong><p>Use persistent demonstration values stored in your browser.</p></div><Badge tone="blue">AVAILABLE</Badge></button><button className={`source-option ${mode === 'connected' ? 'source-active' : ''}`} disabled={!configured} onClick={() => setMode('connected')}><span className="source-radio" /><div><strong>Connected data</strong><p>{configured ? 'Query your configured Supabase project.' : 'Add Supabase credentials to enable a connection.'}</p></div><Badge tone={connected ? 'green' : 'muted'}>{connected ? 'CONNECTED' : configured ? 'AVAILABLE' : 'NOT CONFIGURED'}</Badge></button></div><div className="settings-actions"><button className="outline-btn" onClick={onRefresh} disabled={refreshing}><RefreshCw size={13} className={refreshing ? 'spinning' : ''} /> Test and refresh connection</button><span>{connected ? 'Last check successful' : 'Simulation data is active'}</span></div></Card>
      <Card className="settings-card"><div className="settings-card-heading"><div className="settings-icon violet"><ShieldCheck size={17} /></div><div><h2>Authentication</h2><p>{demoRole ? 'Prototype demo account; this role is not a security boundary.' : 'Supabase email/password authentication is available when credentials are configured.'}</p></div></div>{userEmail ? <div className="auth-signed-in"><span className="profile-pic">{demoRole === 'admin' ? 'AD' : demoRole === 'user' ? 'US' : 'JD'}</span><span>{demoRole ? `Demo ${demoRole} session` : 'Signed in as'} <b>{userEmail}</b></span><button className="outline-btn" onClick={onSignOut}>Sign out</button></div> : <form className="auth-form" onSubmit={onAuth}><label>Email<input type="email" placeholder="you@city.gov" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></label><label>Password<input type="password" placeholder="Your password" required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></label><button className="primary-btn" type="submit">Sign in</button></form>}{authMessage && <div className="auth-message">{authMessage}</div>}</Card>
      <Card className="settings-card"><div className="settings-card-heading"><div className="settings-icon amber"><RefreshCw size={16} /></div><div><h2>Demonstration workspace</h2><p>Reset stored alert statuses, optimisation inputs and the demo session to default values.</p></div></div><div className="reset-row"><div><strong>Reset demo data</strong><span>{canResetDemo ? 'This does not affect a connected Supabase project.' : 'Only the demo administrator can reset workspace data.'}</span></div><button className="outline-btn danger-outline" onClick={onReset} disabled={!canResetDemo}>Reset to defaults</button></div></Card>
      <Card className="settings-card"><div className="settings-card-heading"><div className="settings-icon green"><Bell size={16} /></div><div><h2>System alerts</h2><p>Update an alert status to clear it from the overview unread list.</p></div></div><div className="settings-alert-list">{initialAlerts.map((alert) => <div className="settings-alert-row" key={alert.id}><span className={`alert-symbol ${alert.severity}`}><AlertTriangle size={14} /></span><div><strong>{alert.title}</strong><span>{alert.zone} · {alert.time}</span></div>{alertsList.find((item) => item.id === alert.id)?.read ? <Badge tone="muted">ACKNOWLEDGED</Badge> : <button className="outline-btn" onClick={() => onReadAlert(alert.id)}>Acknowledge</button>}</div>)}</div></Card>
    </div>
    <div className="settings-side"><Card className="connection-card"><span className="connection-icon"><ShieldCheck size={19} /></span><span className="eyebrow">CONNECTION STATUS</span><strong>{configured ? connected ? 'Supabase connected' : 'Ready to connect' : 'Demo environment'}</strong><p>{configured ? 'The browser client uses the public anon key and Row Level Security.' : 'The application runs locally without requiring hardware or cloud credentials.'}</p><div className="connection-tags"><Badge tone={configured ? 'green' : 'blue'}>{configured ? 'SUPABASE' : 'LOCAL MODE'}</Badge><Badge tone="green">RLS READY</Badge></div></Card><Card className="settings-note"><strong>Demo data notice</strong><p>All readings and forecast outputs are synthetic and intended for product demonstrations. Validate any real-world operating decision against utility data and engineering review.</p></Card><Card className="settings-note"><strong>Integration setup</strong><p>Copy <code>.env.example</code> to <code>.env.local</code>, set the Supabase project URL and anon key, then run the schema in the Supabase SQL editor.</p></Card></div>
  </div>
}

export default App
