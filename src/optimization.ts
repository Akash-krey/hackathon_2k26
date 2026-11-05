export type OptimizationInput = {
  demandMl: number
  supplyMl: number
  pumpCount: number
  pumpCapacityMlDay: number
  tariff: number
  solarMwh: number
  reservoirCapacityMl: number
  reservoirLevelMl: number
  reservePercent: number
  waterLossPercent: number
  weights: { cost: number; energy: number; water: number; carbon: number }
}

export type ScheduleSlot = { hour: string; label: string; pumps: number; volumeMl: number }
export type OptimizationResult = {
  score: number
  grossDemandMl: number
  baselineEnergyMwh: number
  optimizedEnergyMwh: number
  energySavedMwh: number
  energySavedPercent: number
  baselineCost: number
  optimizedCost: number
  costSaved: number
  costSavedPercent: number
  baselineCarbonTonnes: number
  optimizedCarbonTonnes: number
  carbonSavedTonnes: number
  waterLossPotentialMl: number
  schedule: ScheduleSlot[]
  comparison: { label: string; baseline: number; optimised: number }[]
  checks: { label: string; value: string }[]
}

type Candidate = {
  concurrency: number
  energy: number
  cost: number
  carbon: number
  waterPotential: number
  slots: ScheduleSlot[]
}

const carbonFactor = 0.338
const energyPerMl = 0.42
const energyModel = {
  efficientBase: 1.03,
  partLoadPenalty: 0.12,
  concurrencyPenalty: 0.02,
  baselineFactor: 1.08,
}

function tariffAt(hour: number, base: number): number {
  const multipliers = hour >= 17 && hour <= 21 ? 1.62 : hour >= 6 && hour <= 9 ? 1.2 : hour >= 10 && hour <= 15 ? 0.92 : 0.68
  return base * multipliers
}

function solarAt(hour: number, dailySolarMwh: number): number {
  const profile = Array.from({ length: 24 }, (_, index) => Math.max(0, Math.sin(((index - 6) / 12) * Math.PI)))
  const total = profile.reduce((sum, value) => sum + value, 0)
  return total ? dailySolarMwh * profile[hour] / total : 0
}

function buildCandidate(input: OptimizationInput, grossDemandMl: number, concurrency: number): Candidate {
  const perPumpHourlyMl = input.pumpCapacityMlDay / 24
  const pool = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    price: tariffAt(hour, input.tariff),
    solar: solarAt(hour, input.solarMwh),
  }))
  pool.sort((a, b) => {
    const priceA = a.price - Math.min(a.solar / Math.max(1, concurrency * perPumpHourlyMl * energyPerMl), a.price * 0.75)
    const priceB = b.price - Math.min(b.solar / Math.max(1, concurrency * perPumpHourlyMl * energyPerMl), b.price * 0.75)
    return priceA - priceB || a.hour - b.hour
  })

  const maxHourlyVolume = concurrency * perPumpHourlyMl
  const activeHours = Math.ceil(grossDemandMl / maxHourlyVolume)
  const volumePerActiveHour = grossDemandMl / activeHours
  const allocated = new Map<number, number>()
  for (const slot of pool.slice(0, activeHours)) allocated.set(slot.hour, volumePerActiveHour)

  const slots = Array.from({ length: 24 }, (_, hour) => {
    const volumeMl = allocated.get(hour) ?? 0
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      label: `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`,
      pumps: volumeMl > 0 ? Math.min(concurrency, Math.ceil(volumeMl / perPumpHourlyMl - 1e-8)) : 0,
      volumeMl,
    }
  })

  let energy = 0
  let cost = 0
  let carbon = 0
  let renewableRemaining = input.solarMwh
  for (const slot of slots) {
    if (!slot.volumeMl) continue
    const hour = Number(slot.hour.slice(0, 2))
    const pumpCapacityThisHour = slot.pumps * perPumpHourlyMl
    const utilization = slot.volumeMl / pumpCapacityThisHour
    const partLoadPenalty = energyModel.partLoadPenalty * (1 - utilization) ** 2
    const concurrencyPenalty = energyModel.concurrencyPenalty * (slot.pumps / input.pumpCount)
    const energyForHour = slot.volumeMl * energyPerMl * (energyModel.efficientBase + partLoadPenalty + concurrencyPenalty)
    energy += energyForHour
    const renewable = Math.min(renewableRemaining, solarAt(hour, input.solarMwh), energyForHour)
    renewableRemaining -= renewable
    const gridEnergy = energyForHour - renewable
    cost += gridEnergy * 1000 * tariffAt(hour, input.tariff)
    carbon += gridEnergy * carbonFactor
  }

  const pressureSmoothing = 1 - concurrency / input.pumpCount
  const waterPotential = grossDemandMl * input.waterLossPercent / 100 * (0.03 + 0.07 * pressureSmoothing)
  return { concurrency, energy, cost, carbon, waterPotential, slots }
}

function normalized(value: number, low: number, high: number): number {
  if (high - low < 1e-9) return 0
  return (value - low) / (high - low)
}

function reservoirScheduleIsFeasible(input: OptimizationInput, candidate: Candidate, grossDemandMl: number): boolean {
  const reserveMl = input.reservoirCapacityMl * input.reservePercent / 100
  const hourlyDemandMl = grossDemandMl / 24
  let level = input.reservoirLevelMl
  for (const slot of candidate.slots) {
    level += slot.volumeMl - hourlyDemandMl
    if (level < reserveMl - 1e-7 || level > input.reservoirCapacityMl + 1e-7) return false
  }
  return true
}

export function optimize(input: OptimizationInput): OptimizationResult {
  const values = [
    input.demandMl, input.supplyMl, input.pumpCount, input.pumpCapacityMlDay,
    input.tariff, input.solarMwh, input.reservoirCapacityMl, input.reservoirLevelMl,
    input.reservePercent, input.waterLossPercent,
    input.weights.cost, input.weights.energy, input.weights.water, input.weights.carbon,
  ]
  if (values.some((value) => !Number.isFinite(value))) throw new Error('All fields must contain valid finite numbers.')
  if (input.demandMl <= 0 || input.supplyMl < 0 || input.pumpCount < 1 || input.pumpCapacityMlDay <= 0 || input.tariff < 0 || input.solarMwh < 0) {
    throw new Error('Demand, pump count and pump capacity must be positive; supply, tariff and solar availability cannot be negative.')
  }
  if (!Number.isInteger(input.pumpCount) || input.pumpCount > 50) throw new Error('Pump count must be a whole number between 1 and 50.')
  if (input.reservoirCapacityMl <= 0 || input.reservoirLevelMl < 0 || input.reservoirLevelMl > input.reservoirCapacityMl) {
    throw new Error('Reservoir capacity must be positive and the current level must be between zero and capacity.')
  }
  if (input.reservePercent < 0 || input.reservePercent >= 100 || input.waterLossPercent < 0 || input.waterLossPercent >= 60) {
    throw new Error('Minimum reserve must be from 0% to less than 100%; water loss must be from 0% to less than 60%.')
  }
  if (Object.values(input.weights).some((weight) => weight < 0) || Object.values(input.weights).every((weight) => weight === 0)) {
    throw new Error('Objective weights must be non-negative and at least one must be greater than zero.')
  }

  const grossDemandMl = input.demandMl / (1 - input.waterLossPercent / 100)
  const reserveMl = input.reservoirCapacityMl * input.reservePercent / 100
  const constraints = [
    input.supplyMl + input.reservoirLevelMl - reserveMl >= grossDemandMl - 1e-8,
    input.supplyMl >= grossDemandMl - 1e-8,
    input.pumpCount * input.pumpCapacityMlDay >= grossDemandMl - 1e-8,
    input.reservoirLevelMl >= reserveMl - 1e-8,
    grossDemandMl <= input.reservoirCapacityMl + input.supplyMl - reserveMl + 1e-8,
  ]
  const failed = constraints.flatMap((valid, index) => valid ? [] : [
    [
      'Starting water plus daily supply cannot meet demand while maintaining the minimum reserve.',
      'Available supply is below demand adjusted for current water losses.',
      'Combined pump capacity is below the water volume required.',
      'Current reservoir level is already below the minimum reserve.',
      'Reservoir capacity is insufficient for the planned daily throughput and reserve.',
    ][index],
  ])
  if (failed.length) throw new Error(`Infeasible scenario: ${failed.join(' ')}`)

  const minimumConcurrency = Math.ceil(grossDemandMl / input.pumpCapacityMlDay)
  const candidates = Array.from({ length: input.pumpCount - minimumConcurrency + 1 }, (_, index) => buildCandidate(input, grossDemandMl, minimumConcurrency + index))
    .filter((candidate) => candidate.slots.reduce((sum, slot) => sum + slot.volumeMl, 0) >= grossDemandMl - 1e-7)
    .filter((candidate) => reservoirScheduleIsFeasible(input, candidate, grossDemandMl))
  if (!candidates.length) throw new Error('No pump schedule satisfies reservoir capacity and minimum-reserve limits across the full day. Adjust demand, pump count, starting storage, or reserve.')

  const costs = candidates.map((candidate) => candidate.cost)
  const energies = candidates.map((candidate) => candidate.energy)
  const water = candidates.map((candidate) => -candidate.waterPotential)
  const carbon = candidates.map((candidate) => candidate.carbon)
  const weightTotal = Object.values(input.weights).reduce((sum, weight) => sum + weight, 0)
  const score = (candidate: Candidate) => {
    const value = input.weights.cost * normalized(candidate.cost, Math.min(...costs), Math.max(...costs))
      + input.weights.energy * normalized(candidate.energy, Math.min(...energies), Math.max(...energies))
      + input.weights.water * normalized(-candidate.waterPotential, Math.min(...water), Math.max(...water))
      + input.weights.carbon * normalized(candidate.carbon, Math.min(...carbon), Math.max(...carbon))
    return value / weightTotal
  }
  const selected = [...candidates].sort((a, b) => score(a) - score(b))[0]
  const baselineEnergyMwh = grossDemandMl * energyPerMl * energyModel.baselineFactor
  const baselineCost = baselineEnergyMwh * 1000 * input.tariff * 1.19
  const baselineCarbonTonnes = baselineEnergyMwh * carbonFactor
  const energySavedMwh = baselineEnergyMwh - selected.energy
  const costSaved = baselineCost - selected.cost
  const carbonSavedTonnes = baselineCarbonTonnes - selected.carbon
  const waterLossPotentialMl = selected.waterPotential
  const formatWeight = (value: number) => `${Number((value / weightTotal * 100).toFixed(0))}%`

  return {
    score: Math.max(0, 100 * (1 - score(selected))),
    grossDemandMl,
    baselineEnergyMwh,
    optimizedEnergyMwh: selected.energy,
    energySavedMwh,
    energySavedPercent: energySavedMwh / baselineEnergyMwh * 100,
    baselineCost,
    optimizedCost: selected.cost,
    costSaved,
    costSavedPercent: costSaved / baselineCost * 100,
    baselineCarbonTonnes,
    optimizedCarbonTonnes: selected.carbon,
    carbonSavedTonnes,
    waterLossPotentialMl,
    schedule: selected.slots,
    comparison: [
      { label: 'Energy (MWh)', baseline: baselineEnergyMwh, optimised: selected.energy },
      { label: 'Cost ($)', baseline: baselineCost, optimised: selected.cost },
      { label: 'Carbon (t)', baseline: baselineCarbonTonnes, optimised: selected.carbon },
      { label: 'Loss potential (ML)', baseline: grossDemandMl * input.waterLossPercent / 100, optimised: Math.max(0, grossDemandMl * input.waterLossPercent / 100 - waterLossPotentialMl) },
    ],
    checks: [
      { label: 'Water demand incl. losses', value: `${grossDemandMl.toFixed(1)} ML/day` },
      { label: 'Available supply', value: `${input.supplyMl.toFixed(1)} ML/day` },
      { label: 'Combined pump capacity', value: `${(input.pumpCount * input.pumpCapacityMlDay).toFixed(0)} ML/day` },
      { label: 'Reservoir reserve', value: `${reserveMl.toFixed(1)} ML minimum` },
      { label: 'Available solar energy', value: `${input.solarMwh.toFixed(1)} MWh/day` },
      { label: 'Energy model', value: 'Per-pump load and concurrency penalties' },
      { label: 'Weights (cost / energy / water / carbon)', value: `${formatWeight(input.weights.cost)} / ${formatWeight(input.weights.energy)} / ${formatWeight(input.weights.water)} / ${formatWeight(input.weights.carbon)}` },
      { label: 'Recommended pump concurrency', value: `${selected.concurrency} of ${input.pumpCount} units` },
    ],
  }
}
