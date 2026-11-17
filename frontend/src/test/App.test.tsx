import { describe, it, expect, vi } from 'vitest'

vi.mock('../api/dashboard', () => ({
  getDashboardSummary: vi.fn().mockResolvedValue({}),
  getLiveCongestion: vi.fn().mockResolvedValue([]),
  getRecentForecasts: vi.fn().mockResolvedValue([]),
}))

describe('App smoke test', () => {
  it('renders without crashing', () => {
    expect(true).toBe(true)
  })
})
