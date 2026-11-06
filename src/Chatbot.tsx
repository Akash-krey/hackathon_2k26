import { useEffect, useRef, useState } from 'react'
import { Bot, Droplets, Leaf, Send, Sparkles, X, Zap } from 'lucide-react'
import type { AlertItem, Infrastructure, Zone } from './data'
import { useLocalization } from './i18n'

type ChatMessage = { id: number; role: 'assistant' | 'user'; text: string }

type ChatbotProps = {
  water: number
  supply: number
  energy: number
  renewable: number
  intensity: number
  lossPercent: number
  emissions: number
  forecast: { value: number; kind: string; unit: string }
  dataMode: 'simulation' | 'connected'
  zones: Zone[]
  alerts: AlertItem[]
  infrastructure: Infrastructure[]
}

const suggestions = [
  'Summarize network performance',
  'Any critical alerts?',
  'Which zone has the highest water loss?',
]

function answerQuestion(question: string, context: ChatbotProps): string {
  const query = question.toLowerCase()
  const dataLabel = context.dataMode === 'connected' ? 'Connected readings' : 'Demonstration data'

  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(query)) {
    return 'Hello! I can help you explore water and energy performance, zone losses, forecasts, alerts, and infrastructure in this workspace.'
  }

  if (/alert|critical|warning|issue|problem/.test(query)) {
    const activeAlerts = context.alerts.filter((alert) => !alert.read)
    if (!activeAlerts.length) return 'There are no unread alerts in the current workspace.'
    const critical = activeAlerts.filter((alert) => alert.severity === 'critical')
    const alertLines = activeAlerts.slice(0, 3).map((alert) => `${alert.severity.toUpperCase()}: ${alert.title} (${alert.zone})`)
    return `${critical.length ? `${critical.length} critical alert${critical.length === 1 ? '' : 's'} need attention. ` : ''}${activeAlerts.length} unread alert${activeAlerts.length === 1 ? '' : 's'}:\n${alertLines.join('\n')}`
  }

  if (/forecast|tomorrow|predict|upcoming/.test(query)) {
    return `The current ${context.forecast.kind.toLowerCase()} baseline forecast is ${context.forecast.value.toFixed(1)} ${context.forecast.unit} for the next forecast day. This is a rolling-mean and trend estimate, not an ML prediction.`
  }

  const matchedZone = context.zones.find((zone) => zone.name !== 'All zones' && query.includes(zone.name.toLowerCase()))
  if (matchedZone) {
    return `${matchedZone.name} is showing ${matchedZone.demand} ML/day demand, ${matchedZone.supply} ML/day supply, and ${matchedZone.loss.toFixed(1)}% estimated water loss. Network energy intensity for this zone is ${matchedZone.intensity} kWh/ML.`
  }

  if (/water|loss|leak|supply|consumption|demand/.test(query)) {
    const highestLoss = [...context.zones].filter((zone) => zone.name !== 'All zones').sort((a, b) => b.loss - a.loss)[0]
    return `${dataLabel}: water demand is ${context.water.toFixed(1)} ML/day and supply is ${context.supply.toFixed(1)} ML/day, with estimated network loss of ${context.lossPercent.toFixed(1)}%. ${highestLoss.name} has the highest zone loss (${highestLoss.loss.toFixed(1)}%).`
  }

  if (/energy|power|electric|renewable|solar|carbon|emission/.test(query)) {
    const renewableShare = context.energy > 0 ? context.renewable / context.energy * 100 : 0
    return `${dataLabel}: energy use is ${context.energy.toFixed(1)} MWh/day, including ${context.renewable.toFixed(1)} MWh/day renewable generation (${renewableShare.toFixed(1)}%). Energy intensity is ${context.intensity.toFixed(0)} kWh/ML and estimated emissions are ${context.emissions.toFixed(1)} tCO2/day.`
  }

  if (/optim|schedule|pump|save|saving|cost|tariff/.test(query)) {
    return 'Open Optimisation engine to calculate a feasible pump schedule. It balances energy, cost, water, and carbon objectives while checking supply, pump capacity, and reservoir reserves. Results are modelled estimates and should be validated before operational use.'
  }

  const namedAsset = context.infrastructure.find((asset) =>
    query.includes(asset.name.toLowerCase()) || query.includes(asset.id.toLowerCase()),
  )
  if (namedAsset) {
    return `${namedAsset.name} (${namedAsset.id}) is ${namedAsset.status.toLowerCase()} in ${namedAsset.zone}. It reports ${namedAsset.throughput} ML/day throughput, ${namedAsset.energy.toFixed(1)} MWh/day energy use, and ${namedAsset.alerts} open alert${namedAsset.alerts === 1 ? '' : 's'}.`
  }

  if (/asset|pump|station|reservoir|plant|maintenance|infrastructure/.test(query)) {
    const maintenance = context.infrastructure.filter((asset) => asset.status === 'Maintenance')
    return `${context.infrastructure.length} infrastructure assets are listed. ${maintenance.length ? `${maintenance.map((asset) => `${asset.name} (${asset.id})`).join(', ')} is currently marked for maintenance.` : 'No assets are currently marked for maintenance.'} Open Infrastructure map to inspect assets.`
  }

  if (/summar|overview|status|performance|network/.test(query)) {
    return `${dataLabel} summary: water demand ${context.water.toFixed(1)} ML/day, energy use ${context.energy.toFixed(1)} MWh/day, estimated water loss ${context.lossPercent.toFixed(1)}%, renewable generation ${context.renewable.toFixed(1)} MWh/day, and ${context.alerts.filter((alert) => !alert.read).length} unread alert${context.alerts.filter((alert) => !alert.read).length === 1 ? '' : 's'}.`
  }

  return 'I can answer questions about current water and energy metrics, zone losses, forecasts, alerts, or infrastructure. Try one of the suggested questions below. I only use data already available in this dashboard.'
}

export default function Chatbot(props: ChatbotProps) {
  const { t } = useLocalization()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', text: 'Hi! I’m your NEXUS assistant. Ask me about network performance, alerts, zones, forecasts, or infrastructure.' },
  ])
  const nextId = useRef(1)
  const endOfMessages = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const sendMessage = (text: string) => {
    const question = text.trim()
    if (!question) return
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text: question },
      { id: nextId.current++, role: 'assistant', text: answerQuestion(question, props) },
    ])
    setInput('')
  }

  return (
    <div className="nexus-chat">
      {isOpen && (
        <section className="nexus-chat-panel" aria-label={t('NEXUS assistant')}>
          <header className="nexus-chat-header">
            <div className="nexus-chat-avatar"><Bot size={19} /></div>
            <div className="nexus-chat-title">
              <strong>{t('NEXUS assistant')}</strong>
              <span><i /> {t('Dashboard data · on-device')}</span>
            </div>
            <button type="button" className="nexus-chat-close" aria-label={t('Close chat')} onClick={() => setIsOpen(false)}><X size={18} /></button>
          </header>
          <div className="nexus-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <div className={`nexus-chat-message ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <span className="nexus-chat-message-icon"><Sparkles size={13} /></span>}
                <p>{message.text}</p>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="nexus-chat-suggestions">
                <span>{t('TRY ASKING')}</span>
                {suggestions.map((suggestion, index) => {
                  const Icon = [Zap, Droplets, Leaf][index]
                  return <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)}><Icon size={13} />{t(suggestion)}</button>
                })}
              </div>
            )}
            <div ref={endOfMessages} />
          </div>
          <form className="nexus-chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage(input) }}>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t('Ask about your network...')} aria-label={t('Message the NEXUS assistant')} />
            <button type="submit" disabled={!input.trim()} aria-label={t('Send message')}><Send size={16} /></button>
          </form>
          <div className="nexus-chat-disclaimer">{t('Answers use current dashboard data and may be estimates.')}</div>
        </section>
      )}
      <button
        type="button"
        className={`nexus-chat-launcher ${isOpen ? 'is-open' : ''}`}
        aria-label={t(isOpen ? 'Close NEXUS assistant' : 'Open NEXUS assistant')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={21} /> : <><Sparkles size={17} /><span>{t('Ask NEXUS')}</span></>}
      </button>
    </div>
  )
}
