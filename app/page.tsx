"use client"
import type React from "react"
import { useState } from "react"
import { Zap, GitMerge } from "lucide-react" // Added icons
type OptionType = "call" | "put"
type PositionType = "short" | "long"

type Greeks = {
  delta: number
  d1: number
  d2: number
}

type ExistingLegState = {
  type: OptionType
  strike: number
  quantity: number
  position: PositionType
}

type LegToFindState = {
  type: OptionType
  position: PositionType
}

type MarketDataState = {
  spotPrice: number
  daysToExpiry: number
  volatility: number // percent
  riskFreeRate: number // percent
}

type ResultsState = {
  existingLeg: ExistingLegState & {
    positionDelta: string
    rawDelta: string
  }
  newLeg: LegToFindState & {
    strike: number
    quantity: number
    positionDelta: string
    rawDelta: string
  }
  netDelta: string
} | null

// Black-Scholes Greeks calculation (Unchanged from your code)
const calculateGreeks = (S: number, K: number, T: number, r: number, sigma: number, optionType: OptionType): Greeks => {
  if (T <= 0) T = 0.001
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  const normalCDF = (x: number): number => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989423 * Math.exp((-x * x) / 2)
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return x > 0 ? 1 - prob : prob
  }

  let delta
  if (optionType === "call") {
    delta = normalCDF(d1)
  } else {
    delta = normalCDF(d1) - 1
  }

  return { delta, d1, d2 }
}

// Find strike price that gives target delta (Unchanged from your code)
const findStrikeForDelta = (
  S: number,
  targetDelta: number,
  T: number,
  r: number,
  sigma: number,
  optionType: OptionType,
  minStrike: number,
  maxStrike: number,
): number => {
  const tolerance = 0.001
  let low = minStrike
  let high = maxStrike
  let iterations = 0
  const maxIterations = 100

  while (iterations < maxIterations && high - low > 0.5) {
    const mid = (low + high) / 2
    const greeks = calculateGreeks(S, mid, T, r, sigma, optionType)
    // The findStrike function already uses absolute delta, so this is robust
    const delta = Math.abs(greeks.delta)
    const target = Math.abs(targetDelta)

    if (Math.abs(delta - target) < tolerance) {
      return mid
    }

    if (delta > target) {
      if (optionType === "call") {
        low = mid
      } else {
        high = mid
      }
    } else {
      if (optionType === "call") {
        high = mid
      } else {
        low = mid
      }
    }

    iterations++
  }

  return (low + high) / 2
}

// *** NEW: Renamed and refactored component ***
const StrangleRebalancer: React.FC = () => {
  // *** NEW: State for the one leg you already have ***
  const [existingLeg, setExistingLeg] = useState<ExistingLegState>({
    type: "call",
    strike: 850,
    quantity: 1,
    position: "short",
  })

  // *** NEW: State for the new leg you WANT to find ***
  const [legToFind, setLegToFind] = useState<LegToFindState>({
    type: "put",
    position: "short",
  })

  const [marketData, setMarketData] = useState<MarketDataState>({
    spotPrice: 828,
    daysToExpiry: 18,
    volatility: 20,
    riskFreeRate: 6.5,
  })

  const [results, setResults] = useState<ResultsState>(null)

  // *** NEW: Refactored calculation logic ***
  const findBalancingLeg = (): void => {
    const S = marketData.spotPrice
    const T = marketData.daysToExpiry / 365
    const sigma = marketData.volatility / 100
    const r = marketData.riskFreeRate / 100

    // 1. Calculate existing leg's position delta
    const existingGreeks = calculateGreeks(S, existingLeg.strike, T, r, sigma, existingLeg.type)

    // This is the 'raw' delta from B-S
    const rawExistingDelta = existingGreeks.delta

    // This is your actual position delta (e.g., -0.35 for a short call)
    let existingPositionDelta = rawExistingDelta * existingLeg.quantity
    if (existingLeg.position === "short") {
      existingPositionDelta = -existingPositionDelta
    }

    // 2. Determine target delta for the new leg
    // We want: existingPositionDelta + newPositionDelta = 0
    // So: newPositionDelta = -existingPositionDelta
    const targetNewPositionDelta = -existingPositionDelta

    // 3. Determine the required *raw* delta (from Black-Scholes) for the new leg
    // We assume the new leg has the same quantity as the existing leg
    const newQty = existingLeg.quantity
    let targetRawDelta

    if (legToFind.position === "short") {
      // e.g., targetNewPositionDelta = +0.35 (to offset short call)
      // newPositionDelta = -(raw_put_delta) * qty
      // +0.35 = -(raw_put_delta) * 1
      // raw_put_delta = -0.35
      targetRawDelta = -targetNewPositionDelta / newQty
    } else {
      // 'long'
      // e.g., if we wanted to BUY a call to hedge
      // newPositionDelta = (raw_call_delta) * qty
      // +0.35 = (raw_call_delta) * 1
      // raw_call_delta = +0.35
      targetRawDelta = targetNewPositionDelta / newQty
    }

    // 4. Find the strike using your original function
    // Your function `findStrikeForDelta` correctly uses Math.abs(), so we can
    // pass the signed targetRawDelta and it will find the correct strike.
    const optimalStrike = findStrikeForDelta(
      S,
      targetRawDelta, // Pass the signed raw delta (e.g., -0.35 for a put)
      T,
      r,
      sigma,
      legToFind.type,
      S * 0.7, // Min strike search
      S * 1.5, // Max strike search
    )

    // 5. Set results
    const newLegGreeks = calculateGreeks(S, optimalStrike, T, r, sigma, legToFind.type)
    let newLegPositionDelta = newLegGreeks.delta * newQty
    if (legToFind.position === "short") {
      newLegPositionDelta = -newLegPositionDelta
    }

    setResults({
      existingLeg: {
        ...existingLeg,
        positionDelta: existingPositionDelta.toFixed(4),
        rawDelta: rawExistingDelta.toFixed(4),
      },
      newLeg: {
        ...legToFind,
        strike: Math.round(optimalStrike),
        quantity: newQty,
        positionDelta: newLegPositionDelta.toFixed(4),
        rawDelta: newLegGreeks.delta.toFixed(4),
      },
      netDelta: (existingPositionDelta + newLegPositionDelta).toFixed(4),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GitMerge className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Strangle Rebalancer</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Find the optimal balancing leg for delta-neutral options trading
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 1. Your Existing Leg */}
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-lg font-semibold text-foreground">Existing Leg</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Your Current Position</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Position Type</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={existingLeg.position}
                  onChange={(e) => setExistingLeg({ ...existingLeg, position: e.target.value as PositionType })}
                >
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Option Type</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={existingLeg.type}
                  onChange={(e) => setExistingLeg({ ...existingLeg, type: e.target.value as OptionType })}
                >
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Strike Price (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={existingLeg.strike}
                  onChange={(e) => setExistingLeg({ ...existingLeg, strike: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Quantity (Lots)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={existingLeg.quantity}
                  onChange={(e) => setExistingLeg({ ...existingLeg, quantity: Number.parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* 2. Find Balancing Leg */}
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-lg font-semibold text-foreground">Balancing Leg</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Find This</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure the new leg to calculate optimal strike for delta neutrality.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Position Type</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={legToFind.position}
                  onChange={(e) => setLegToFind({ ...legToFind, position: e.target.value as PositionType })}
                >
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Option Type</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={legToFind.type}
                  onChange={(e) => setLegToFind({ ...legToFind, type: e.target.value as OptionType })}
                >
                  <option value="put">Put</option>
                  <option value="call">Call</option>
                </select>
              </div>
              <div className="pt-8 flex items-center justify-center text-center">
                <div>
                  <div className="text-3xl font-bold text-muted-foreground mb-2">?</div>
                  <p className="text-xs text-muted-foreground">Strike price will be calculated</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Market Data */}
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-lg font-semibold text-foreground">Market Data</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Inputs</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Spot Price (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={marketData.spotPrice}
                  onChange={(e) => setMarketData({ ...marketData, spotPrice: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Days to Expiry</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={marketData.daysToExpiry}
                  onChange={(e) => setMarketData({ ...marketData, daysToExpiry: Number.parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Volatility (%)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={marketData.volatility}
                  onChange={(e) => setMarketData({ ...marketData, volatility: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Risk-Free Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={marketData.riskFreeRate}
                  onChange={(e) => setMarketData({ ...marketData, riskFreeRate: Number.parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={findBalancingLeg}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg mb-8"
        >
          <Zap className="w-5 h-5" />
          Calculate Balancing Leg
        </button>

        {/* Results */}
        {results && (
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-8">Calculation Results</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
                <div className="text-sm font-medium text-red-600 mb-2">Existing Leg Delta</div>
                <div className="text-3xl font-bold text-red-700 mb-1">{results.existingLeg.positionDelta}</div>
                <div className="text-xs text-red-600 opacity-75">
                  {results.existingLeg.quantity}x {results.existingLeg.position}{" "}
                  {results.existingLeg.type.toUpperCase()} @ ₹{results.existingLeg.strike}
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <div className="text-sm font-medium text-green-600 mb-2">New Leg Delta</div>
                <div className="text-3xl font-bold text-green-700 mb-1">{results.newLeg.positionDelta}</div>
                <div className="text-xs text-green-600 opacity-75">
                  {results.newLeg.quantity}x {results.newLeg.position} {results.newLeg.type.toUpperCase()} @ ₹
                  {results.newLeg.strike}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <div className="text-sm font-medium text-blue-600 mb-2">Combined Net Delta</div>
                <div className="text-3xl font-bold text-blue-700 mb-1">{results.netDelta}</div>
                <div className="text-xs text-blue-600 opacity-75">Target: ≈ 0 (Delta Neutral)</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white mb-8">
              <h3 className="text-lg font-semibold mb-4">📌 Recommended Trade</h3>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm opacity-90">Execute:</span>
                  <div className="text-2xl font-bold uppercase">
                    {results.newLeg.position} {results.newLeg.quantity} LOT
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm opacity-90">Strike:</span>
                  <div className="text-2xl font-bold">₹ {results.newLeg.strike}</div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm opacity-90">Type:</span>
                  <div className="text-2xl font-bold uppercase">{results.newLeg.type}</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 rounded p-6">
              <h4 className="font-semibold text-foreground mb-3">How This Works</h4>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>
                  Your existing {results.existingLeg.position} {results.existingLeg.type} position has a delta of{" "}
                  <span className="font-semibold text-foreground">{results.existingLeg.positionDelta}</span>
                </li>
                <li>
                  To achieve delta neutrality, you need to offset this with a delta of{" "}
                  <span className="font-semibold text-foreground">{results.newLeg.positionDelta}</span>
                </li>
                <li>
                  A{" "}
                  <span className="font-semibold text-foreground">
                    {results.newLeg.position} {results.newLeg.type}
                  </span>{" "}
                  at strike <span className="font-semibold text-foreground">₹{results.newLeg.strike}</span> provides
                  exactly this exposure
                </li>
                <li>
                  Combined, your position achieves a net delta of{" "}
                  <span className="font-semibold text-foreground">{results.netDelta}</span> (delta-neutral)
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StrangleRebalancer
