'use client'

import { useState, useEffect } from 'react'
import DynamicTable from './DynamicTable'
import { fetchWidgetData } from '@/services/momentumApi'

interface Filter {
  id: string
  label: string
  type: 'dropdown' | 'radio' | 'date'
  options?: { value: string; label: string }[]
}

interface WidgetData {
  title: string
  description?: string
  filters?: Filter[]
  columns: string[]
  data: Record<string, any>[]
}

interface WidgetContainerProps {
  toolId: string
}

export default function WidgetContainer({ toolId }: WidgetContainerProps) {
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  useEffect(() => {
    loadWidgetData()
  }, [toolId, filters])

  const loadWidgetData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWidgetData(toolId, filters)
      setWidgetData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load widget data')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (filterId: string, value: string) => {
    setFilters((prev) => ({ ...prev, [filterId]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading widget data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error Loading Data</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!widgetData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available for this tool.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
      {/* Widget Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-black mb-2">{widgetData.title}</h2>
            {widgetData.description && (
              <p className="text-gray-600">{widgetData.description}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        {widgetData.filters && widgetData.filters.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-4">
            {widgetData.filters.map((filter) => (
              <div key={filter.id} className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">{filter.label}:</label>
                {filter.type === 'dropdown' && filter.options && (
                  <select
                    value={filters[filter.id] || ''}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  >
                    <option value="">All</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {filter.type === 'radio' && filter.options && (
                  <div className="flex space-x-4">
                    {filter.options.map((option) => (
                      <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name={filter.id}
                          value={option.value}
                          checked={filters[filter.id] === option.value}
                          onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                          className="w-4 h-4 text-black focus:ring-black"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget Body - Table */}
      <div className="p-6">
        <DynamicTable
          columns={widgetData.columns}
          data={widgetData.data}
        />
      </div>
    </div>
  )
}

