import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import type { LiveCongestion, DashboardSummary, CongestionAlert } from '../api/dashboard'

// Determine socket URL based on environment
const getSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return envUrl
  }
  // In development, window.location.origin (e.g. http://localhost:5173) with proxy,
  // or directly http://localhost:8000
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000'
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
}

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    })
  }
  return socketInstance
}

export interface TelemetryPulsePayload {
  live: LiveCongestion[]
  server_time: string
}

export interface DashboardUpdatePayload {
  live?: LiveCongestion[]
  summary?: DashboardSummary
  alerts?: CongestionAlert[]
  server_time: string
}

export function useDashboardSocket() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [lastPulse, setLastPulse] = useState<Date | null>(null)
  const [liveStreamData, setLiveStreamData] = useState<LiveCongestion[] | null>(null)
  const [pulseCount, setPulseCount] = useState(0)

  useEffect(() => {
    const socket = getSocket()

    const onConnect = () => {
      setIsConnected(true)
    }

    const onDisconnect = () => {
      setIsConnected(false)
    }

    const onTelemetryPulse = (data: TelemetryPulsePayload) => {
      if (data?.live) {
        setLiveStreamData(data.live)
        setLastPulse(new Date(data.server_time || Date.now()))
        setPulseCount((prev) => prev + 1)
        // Also update React Query cache so other components stay in sync
        queryClient.setQueryData(['live-congestion'], data.live)
      }
    }

    const onDashboardUpdate = (data: DashboardUpdatePayload) => {
      if (data?.live) {
        setLiveStreamData(data.live)
        queryClient.setQueryData(['live-congestion'], data.live)
      }
      if (data?.summary) {
        queryClient.setQueryData(['dashboard-summary'], data.summary)
      }
      if (data?.alerts) {
        queryClient.setQueryData(['congestion-alerts'], data.alerts)
      }
      // Invalidate queries so background data refreshes properly
      queryClient.invalidateQueries({ queryKey: ['recent-forecasts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['congestion-alerts'] })
      setLastPulse(new Date(data.server_time || Date.now()))
    }

    const onDashboardInit = (data: DashboardUpdatePayload) => {
      if (data?.live) {
        setLiveStreamData(data.live)
        queryClient.setQueryData(['live-congestion'], data.live)
      }
      if (data?.summary) {
        queryClient.setQueryData(['dashboard-summary'], data.summary)
      }
      if (data?.alerts) {
        queryClient.setQueryData(['congestion-alerts'], data.alerts)
      }
      setLastPulse(new Date(data.server_time || Date.now()))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('dashboard:telemetry_pulse', onTelemetryPulse)
    socket.on('dashboard:update', onDashboardUpdate)
    socket.on('dashboard:init', onDashboardInit)

    if (socket.connected) {
      setIsConnected(true)
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('dashboard:telemetry_pulse', onTelemetryPulse)
      socket.off('dashboard:update', onDashboardUpdate)
      socket.off('dashboard:init', onDashboardInit)
    }
  }, [queryClient])

  const requestRefresh = () => {
    const socket = getSocket()
    if (socket.connected) {
      socket.emit('request_dashboard_refresh')
    }
    // Also trigger TanStack Query refetches
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    queryClient.invalidateQueries({ queryKey: ['live-congestion'] })
    queryClient.invalidateQueries({ queryKey: ['congestion-alerts'] })
    queryClient.invalidateQueries({ queryKey: ['recent-forecasts'] })
  }

  return {
    isConnected,
    lastPulse,
    liveStreamData,
    pulseCount,
    requestRefresh,
  }
}
