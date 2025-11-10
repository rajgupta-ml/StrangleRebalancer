"use client"
import type React from "react"
import { useState } from "react"
import { GitMerge } from "lucide-react"

type OptionType = "call" | "put"

type MarketDataState = {
  spotPrice: number
  daysToExpiry: number
  volatility: number // percent
  riskFreeRate: number // percent
}

const calculateGreeks = (S: number, K: number, T: number, r: number, sigma: number) => {
  if (T <= 0) T = 0.001
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  return { d1, d2 }
}

const normalCDF = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - prob : prob
}

const priceOption = (S: number, K: number, T: number, r: number, sigma: number, optionType: OptionType): number => {
  const { d1, d2 } = calculateGreeks(S, K, T, r, sigma)
  if (optionType === "call") {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
  }
}

// Find strike K such that option premium equals targetPremium
const findStrikeForPremium = (
  S: number,
  T: number,
  r: number,
  sigma: number,
  targetPremium: number,
  optionType: OptionType,
  minK: number,
  maxK: number,
  tolerance = 0.01,
  maxIterations = 100,
): number => {
  let low = minK
  let high = maxK
  let iterations = 0
  while (iterations < maxIterations && high - low > 0.5) {
    const mid = (low + high) / 2
    const p = priceOption(S, mid, T, r, sigma, optionType)
    if (Math.abs(p - targetPremium) < tolerance) {
      return mid
    }
    // For puts, premium increases with K; for calls, premium decreases with K
    if (optionType === "put") {
      if (p < targetPremium) {
        low = mid
      } else {
        high = mid
      }
    } else {
      if (p > targetPremium) {
        low = mid
      } else {
        high = mid
      }
    }
    iterations++
  }
  return (low + high) / 2
}

const PremiumHedgerPage: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketDataState>({
    spotPrice: 828,
    daysToExpiry: 18,
    volatility: 20,
    riskFreeRate: 6.5,
  })
  const [inputLegType, setInputLegType] = useState<OptionType>("put")
  const [inputStrike, setInputStrike] = useState<number>(770)
  const [inputLtp, setInputLtp] = useState<number>(6.5)
  const [result, setResult] = useState<
    | null
    | {
        targetType: OptionType
        matchingStrike: number
        computedPremium: number
        inputSummary: { type: OptionType; strike: number; ltp: number }
      }
  >(null)

  const computeOppositeStrike = (): void => {
    const S = marketData.spotPrice
    const T = marketData.daysToExpiry / 365
    const sigma = marketData.volatility / 100
    const r = marketData.riskFreeRate / 100
    const targetPremium = inputLtp
    const targetType: OptionType = inputLegType === "put" ? "call" : "put"
    const minK = S * 0.5
    const maxK = S * 1.8
    const strike = findStrikeForPremium(S, T, r, sigma, targetPremium, targetType, minK, maxK)
    const computedPremium = priceOption(S, strike, T, r, sigma, targetType)
    setResult({
      targetType,
      matchingStrike: Math.round(strike),
      computedPremium,
      inputSummary: { type: inputLegType, strike: inputStrike, ltp: inputLtp },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GitMerge className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Premium Hedger</h1>
          </div>
          <p className="text-muted-foreground">
            Given an option’s LTP, find the nearest opposite option strike whose price matches that LTP (put ↔ call).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Market Data</h2>
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
                <label className="block text-sm font-medium text-foreground mb-2">Implied Volatility (%)</label>
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

          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Input Option (Put or Call)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Input Leg Type</label>
                <select
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={inputLegType}
                  onChange={(e) => setInputLegType(e.target.value as OptionType)}
                >
                  <option value="put">Put</option>
                  <option value="call">Call</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Strike (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={inputStrike}
                  onChange={(e) => setInputStrike(Number.parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">LTP (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={inputLtp}
                  onChange={(e) => setInputLtp(Number.parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={computeOppositeStrike}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Find Opposite Option Strike with Same LTP
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground mb-4">Result</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                <div className="text-sm font-medium text-blue-700 mb-1">Input</div>
                <div className="text-sm text-blue-800">
                  {result.inputSummary.type.toUpperCase()} @ ₹{result.inputSummary.strike} with LTP ₹{result.inputSummary.ltp}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-5 border border-green-200">
                <div className="text-sm font-medium text-green-700 mb-1">
                  Matching {result.targetType.toUpperCase()} Strike (same LTP)
                </div>
                <div className="text-3xl font-bold text-green-800">₹ {result.matchingStrike}</div>
                <div className="text-xs text-green-700 opacity-75 mt-1">
                  Computed premium: ₹ {result.computedPremium.toFixed(2)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Based on Black–Scholes with your inputs. Real quotes may differ due to spreads and skew.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PremiumHedgerPage


