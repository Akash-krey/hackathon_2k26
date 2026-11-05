export type Zone = {
  name: string
  demand: number
  supply: number
  loss: number
  intensity: number
}

export type Infrastructure = {
  id: string
  name: string
  type: 'Treatment plant' | 'Reservoir' | 'Pumping station' | 'Solar installation' | 'Distribution zone'
  zone: string
  status: 'Online' | 'Maintenance'
  throughput: number
  energy: number
  efficiency: number
  alerts: number
  lat: number
  lng: number
}

export type AlertItem = {
  id: string
  title: string
  description: string
  zone: string
  time: string
  severity: 'critical' | 'warning' | 'info'
  read: boolean
}

export const zones: Zone[] = [
  { name: 'All zones', demand: 228, supply: 250, loss: 8.6, intensity: 411 },
  { name: 'Northbank', demand: 68, supply: 73, loss: 6.8, intensity: 398 },
  { name: 'Riverside', demand: 54, supply: 60, loss: 10.1, intensity: 426 },
  { name: 'Midtown', demand: 62, supply: 67, loss: 7.5, intensity: 405 },
  { name: 'Southpoint', demand: 44, supply: 50, loss: 12.0, intensity: 423 },
]

export const dailySeries = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.now() - (29 - index) * 86400000)
  const seasonal = Math.sin(index * 0.58) * 5 + Math.cos(index * 0.21) * 2.5
  const water = 224 + seasonal + (index > 23 ? 2 : 0)
  const energy = 92 + Math.sin(index * 0.49) * 4 + Math.cos(index * 0.25) * 2
  return {
    day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    water: Number(water.toFixed(1)),
    energy: Number(energy.toFixed(1)),
    average: Number((water - 1.2).toFixed(1)),
    pumping: Number((energy * 0.55).toFixed(1)),
    treatment: Number((energy * 0.29).toFixed(1)),
    distribution: Number((energy * 0.16).toFixed(1)),
    renewable: Number((20 + Math.max(0, Math.sin(index * 0.47)) * 8).toFixed(1)),
    storage: Number((64 + Math.sin(index * 0.33) * 8 + Math.cos(index * 0.19) * 4).toFixed(1)),
    carbon: Number((energy * 0.338).toFixed(1)),
  }
})

export const monthlySeries = Array.from({ length: 12 }, (_, index) => ({
  day: new Date(2026, index, 1).toLocaleDateString('en-US', { month: 'short' }),
  water: Number((218 + Math.sin(index * 0.68) * 7 + index * 0.35).toFixed(1)),
  energy: Number((88 + Math.sin(index * 0.68) * 4 + index * 0.2).toFixed(1)),
  average: 224,
  pumping: 50,
  treatment: 27,
  distribution: 15,
  renewable: Number((19 + Math.max(0, Math.sin(index * 0.47)) * 8).toFixed(1)),
  storage: 64,
  carbon: 31,
}))

export const infrastructure: Infrastructure[] = [
  { id: 'WTP-001', name: 'East River Treatment Works', type: 'Treatment plant', zone: 'Northbank', status: 'Online', throughput: 82, energy: 31.6, efficiency: 91, alerts: 0, lat: 40.748, lng: -73.965 },
  { id: 'RES-014', name: 'Northbank Reservoir', type: 'Reservoir', zone: 'Northbank', status: 'Online', throughput: 46, energy: 3.2, efficiency: 88, alerts: 0, lat: 40.768, lng: -73.974 },
  { id: 'PMP-104', name: 'Riverside Lift Station', type: 'Pumping station', zone: 'Riverside', status: 'Online', throughput: 38, energy: 12.4, efficiency: 84, alerts: 1, lat: 40.735, lng: -73.999 },
  { id: 'SOL-003', name: 'Harbor Solar Array', type: 'Solar installation', zone: 'Riverside', status: 'Online', throughput: 0, energy: 24.6, efficiency: 96, alerts: 0, lat: 40.712, lng: -74.008 },
  { id: 'DST-022', name: 'Midtown Distribution Hub', type: 'Distribution zone', zone: 'Midtown', status: 'Online', throughput: 61, energy: 9.5, efficiency: 89, alerts: 0, lat: 40.754, lng: -73.985 },
  { id: 'PMP-217', name: 'Canal Street Booster', type: 'Pumping station', zone: 'Midtown', status: 'Maintenance', throughput: 29, energy: 10.8, efficiency: 72, alerts: 1, lat: 40.721, lng: -73.991 },
  { id: 'RES-009', name: 'Southpoint Storage', type: 'Reservoir', zone: 'Southpoint', status: 'Online', throughput: 35, energy: 2.6, efficiency: 86, alerts: 1, lat: 40.704, lng: -73.988 },
  { id: 'WTP-002', name: 'West Canal Purification Plant', type: 'Treatment plant', zone: 'Midtown', status: 'Online', throughput: 71, energy: 27.1, efficiency: 89, alerts: 0, lat: 40.741, lng: -74.016 },
]

export const pumpRows = [
  { id: 'PMP-104', zone: 'Riverside', hours: 18.4, energy: 12.4, efficiency: 84, status: 'Online' },
  { id: 'PMP-110', zone: 'Northbank', hours: 17.2, energy: 11.8, efficiency: 91, status: 'Online' },
  { id: 'PMP-217', zone: 'Midtown', hours: 20.1, energy: 10.8, efficiency: 72, status: 'Maintenance' },
  { id: 'PMP-223', zone: 'Southpoint', hours: 15.8, energy: 9.6, efficiency: 87, status: 'Online' },
  { id: 'PMP-231', zone: 'Northbank', hours: 16.9, energy: 9.4, efficiency: 89, status: 'Online' },
]

export const alerts: AlertItem[] = [
  { id: 'AL-2401', title: 'Potential leakage detected', description: 'Unaccounted flow above the 12% threshold.', zone: 'Southpoint', time: '12 min ago', severity: 'critical', read: false },
  { id: 'AL-2398', title: 'Abnormal pumping energy', description: 'PMP-217 running 18% above expected load.', zone: 'Midtown', time: '48 min ago', severity: 'warning', read: false },
  { id: 'AL-2394', title: 'Reservoir approaching low level', description: 'Southpoint storage at 38% capacity.', zone: 'Southpoint', time: '1 hr ago', severity: 'warning', read: false },
  { id: 'AL-2389', title: 'High-demand window forecast', description: 'Demand may exceed baseline by 6% tomorrow.', zone: 'Northbank', time: '3 hrs ago', severity: 'info', read: false },
]
