import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Waves, Zap } from 'lucide-react'
import { useLocalization } from './i18n'

const CAPACITY_LITERS = 10_000
const SIMULATION_SPEED = 4

const initialState = {
  level: 65,
  inflowOpen: true,
  recirculationOpen: true,
  outflowOpen: true,
  running: true,
}

export default function ReservoirDemo() {
  const { t } = useLocalization()
  const [level, setLevel] = useState(initialState.level)
  const [inflowOpen, setInflowOpen] = useState(initialState.inflowOpen)
  const [recirculationOpen, setRecirculationOpen] = useState(initialState.recirculationOpen)
  const [outflowOpen, setOutflowOpen] = useState(initialState.outflowOpen)
  const [running, setRunning] = useState(initialState.running)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setLevel((current) => {
        const inflow = inflowOpen && current < 100 ? 120 : 0
        const outflow = outflowOpen && current > 0 ? 85 : 0
        const change = ((inflow - outflow) * SIMULATION_SPEED * 0.1 / CAPACITY_LITERS) * 100
        return Math.max(0, Math.min(100, current + change))
      })
    }, 100)
    return () => window.clearInterval(timer)
  }, [inflowOpen, outflowOpen, running])

  const volume = Math.round(level / 100 * CAPACITY_LITERS)
  const effectiveInflow = inflowOpen && level < 100 ? 120 : 0
  const effectiveOutflow = outflowOpen && level > 0 ? 85 : 0
  const effectiveRecirculation = recirculationOpen && level > 0 ? 45 : 0
  const power = (effectiveOutflow + effectiveRecirculation) * 0.33
  const waterHeight = level * 1.72
  const waterY = 280 - waterHeight
  const condition = t(level <= 20 ? 'Low reserve' : level >= 95 ? 'Near capacity' : 'Operating normally')

  const reset = () => {
    setLevel(initialState.level)
    setInflowOpen(initialState.inflowOpen)
    setRecirculationOpen(initialState.recirculationOpen)
    setOutflowOpen(initialState.outflowOpen)
    setRunning(initialState.running)
  }

  return (
    <section className="reservoir-demo" aria-labelledby="reservoir-demo-title">
      <div className="reservoir-demo-header">
        <div>
          <div className="reservoir-demo-kicker"><span className="reservoir-demo-live" /> {t('INTERACTIVE DEMONSTRATION')}</div>
              <h2 id="reservoir-demo-title">{t('Reservoir flow simulator')}</h2>
              <p>{t('Click a valve or pump in the diagram, or use the controls below. Watch stored water respond to flow.')}</p>
        </div>
        <div className="reservoir-demo-status"><span className={level <= 20 ? 'is-low' : ''} />{condition}</div>
      </div>

      <div className="reservoir-demo-visual">
        <div className="reservoir-demo-readouts">
          <div><span>{t('STORED VOLUME')}</span><strong>{volume.toLocaleString()} <small>L</small></strong></div>
          <div><span>{t('PUMP POWER')}</span><strong>{power.toFixed(1)} <small>kW</small></strong></div>
          <div><span>{t('NET FLOW')}</span><strong>{effectiveInflow - effectiveOutflow} <small>L/s</small></strong></div>
        </div>

        <svg className="reservoir-diagram" viewBox="0 0 800 360" role="img" aria-label={`Reservoir at ${level.toFixed(0)} percent capacity. Inflow valve ${inflowOpen ? 'open' : 'closed'}, demand valve ${outflowOpen ? 'open' : 'closed'}, recirculation ${recirculationOpen ? 'on' : 'off'}.`}>
          <defs>
            <linearGradient id="reservoir-water-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#73c9bc" stopOpacity=".78" />
              <stop offset="100%" stopColor="#4b8c91" stopOpacity=".5" />
            </linearGradient>
            <clipPath id="reservoir-tank-clip"><rect x="260" y="92" width="300" height="188" rx="3" /></clipPath>
          </defs>

          <path className="reservoir-pipe" d="M38 115 H260 V142 M260 260 H180 V64 H520 V142 M560 260 H755" />
          {inflowOpen && <path className={`reservoir-flow reservoir-flow-in ${running ? '' : 'is-paused'}`} d="M38 115 H260 V142" />}
          {recirculationOpen && level > 0 && <path className={`reservoir-flow reservoir-flow-recirculation ${running ? '' : 'is-paused'}`} d="M260 260 H180 V64 H520 V142" />}
          {outflowOpen && level > 0 && <path className={`reservoir-flow reservoir-flow-out ${running ? '' : 'is-paused'}`} d="M560 260 H755" />}

          <g
            className={`reservoir-valve ${inflowOpen ? 'is-open' : ''}`}
            transform="translate(145 115)"
            role="button"
            tabIndex={0}
            aria-label={`Main inflow valve ${inflowOpen ? 'open' : 'closed'}; click to ${inflowOpen ? 'close' : 'open'}`}
            onClick={() => setInflowOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setInflowOpen((open) => !open)
              }
            }}
          >
            <path d="M-13 -12 L0 0 L-13 12 Z M13 -12 L0 0 L13 12 Z" />
          </g>
          <g
            className={`reservoir-pump ${recirculationOpen && level > 0 ? 'is-running' : ''}`}
            transform="translate(180 196)"
            role="button"
            tabIndex={0}
            aria-label={`Recirculation pump ${recirculationOpen ? 'running' : 'stopped'}; click to ${recirculationOpen ? 'stop' : 'start'}`}
            onClick={() => setRecirculationOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setRecirculationOpen((open) => !open)
              }
            }}
          >
            <circle r="19" /><path d="M-8 -8 L8 0 L-8 8 Z" />
          </g>
          <g
            className={`reservoir-pump ${outflowOpen && level > 0 ? 'is-running' : ''}`}
            transform="translate(655 260)"
            role="button"
            tabIndex={0}
            aria-label={`Demand outflow valve ${outflowOpen ? 'open' : 'closed'}; click to ${outflowOpen ? 'close' : 'open'}`}
            onClick={() => setOutflowOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setOutflowOpen((open) => !open)
              }
            }}
          >
            <circle r="19" /><path d="M-8 -8 L8 0 L-8 8 Z" />
          </g>

          <g clipPath="url(#reservoir-tank-clip)">
            <rect x="260" y={waterY} width="300" height={waterHeight} fill="url(#reservoir-water-gradient)" className="reservoir-water" />
            <path d={`M260 ${waterY} Q300 ${waterY - 5} 340 ${waterY} T420 ${waterY} T500 ${waterY} T580 ${waterY}`} className="reservoir-waterline" />
          </g>
          <path className="reservoir-tank-outline" d="M260 92 V280 H560 V92 M250 92 H570 M260 280 H560" />
          <path className="reservoir-level-mark" d={`M568 ${waterY} H592`} />
          <text x="600" y={waterY + 4} className="reservoir-level-label">{level.toFixed(0)}%</text>
          <text x="400" y="322" textAnchor="middle" className="reservoir-tank-caption">{t('DEMO RESERVOIR · 10,000 L CAPACITY')}</text>

          <text x="38" y="91" className="reservoir-pipe-label">{t('SOURCE INFLOW')}</text>
          <text x="38" y="151" className="reservoir-flow-label">{effectiveInflow} L/s</text>
          <text x="97" y="235" className="reservoir-pipe-label">{t('RECIRCULATION')}</text>
          <text x="97" y="251" className="reservoir-flow-label">{effectiveRecirculation} L/s</text>
          <text x="665" y="235" className="reservoir-pipe-label">{t('DEMAND OUTFLOW')}</text>
          <text x="700" y="289" className="reservoir-flow-label">{effectiveOutflow} L/s</text>
        </svg>
      </div>

      <div className="reservoir-demo-controls">
        <label className="reservoir-level-control">
          <span><strong>{t('Manual level setting')}</strong><b>{level.toFixed(0)}%</b></span>
          <input aria-label="Set reservoir water level" type="range" min="0" max="100" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
          <small>{t('Drag to set the current level; the flow model continues from there.')}</small>
        </label>
        <div className="reservoir-valve-controls">
          <div className="reservoir-demo-utilities">
            <button type="button" className="reservoir-utility-btn" onClick={() => setRunning((active) => !active)}>{running ? <Pause size={13} /> : <Play size={13} />}{t(running ? 'Pause' : 'Resume')}</button>
            <button type="button" className="reservoir-utility-btn" onClick={reset}><RotateCcw size={13} />{t('Reset demo')}</button>
          </div>
          <button type="button" className={`reservoir-control inflow-control ${inflowOpen ? 'is-on' : ''}`} aria-pressed={inflowOpen} onClick={() => setInflowOpen((open) => !open)}>
            <span className="reservoir-control-dot" /><span><small>{t('MAIN INFLOW')}</small><strong>{t(inflowOpen ? 'Valve open' : 'Valve closed')}</strong></span><b>{effectiveInflow} L/s</b>
          </button>
          <button type="button" className={`reservoir-control recirculation-control ${recirculationOpen ? 'is-on' : ''}`} aria-pressed={recirculationOpen} onClick={() => setRecirculationOpen((open) => !open)}>
            <span className="reservoir-control-dot" /><span><small>{t('RECIRCULATION')}</small><strong>{t(effectiveRecirculation ? 'Pump running' : 'Pump stopped')}</strong></span><b>{effectiveRecirculation} L/s</b>
          </button>
          <button type="button" className={`reservoir-control outflow-control ${outflowOpen ? 'is-on' : ''}`} aria-pressed={outflowOpen} onClick={() => setOutflowOpen((open) => !open)}>
            <span className="reservoir-control-dot" /><span><small>{t('DEMAND OUTFLOW')}</small><strong>{t(outflowOpen ? 'Valve open' : 'Valve closed')}</strong></span><b>{effectiveOutflow} L/s</b>
          </button>
        </div>
      </div>

      <div className="reservoir-demo-footer">
        <span><Waves size={14} /> {t('1 simulator second = 4 model seconds')}</span>
        <span><Zap size={13} /> {t('Pump power estimated at 0.33 kW per L/s')}</span>
      </div>
    </section>
  )
}
