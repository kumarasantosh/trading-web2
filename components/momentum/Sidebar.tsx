'use client'

import { useState } from 'react'

interface SidebarProps {
  selectedTool: string | null
  onToolSelect: (toolId: string) => void
  isOpen?: boolean
}

interface MenuItem {
  id: string
  label: string
  icon?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    id: 'market-overview',
    label: 'Market Overview',
    icon: '📊',
    children: [
      {
        id: 'fno-overview',
        label: 'FNO Stocks Overview',
        children: [
          { id: 'intraday-gainers', label: 'Intraday Gainers (Top 16)' },
          { id: 'intraday-losers', label: 'Intraday Losers (Top 16)' },
          { id: 'high-breakout', label: 'Previous Day High Breakout' },
          { id: 'low-breakdown', label: 'Previous Day Low Breakdown' },
        ],
      },
      {
        id: 'sectoral-indices',
        label: 'Sectoral Indices',
      },
    ],
  },
]

export default function Sidebar({ selectedTool, onToolSelect, isOpen = false }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['market-overview', 'fno-overview']))

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const handleItemClick = (item: MenuItem) => {
    if (item.children) {
      toggleExpand(item.id)
    } else {
      onToolSelect(item.id)
    }
  }

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    const isSelected = selectedTool === item.id

    return (
      <div key={item.id}>
        <button
          onClick={() => handleItemClick(item)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
            isSelected
              ? 'bg-black text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
        >
          <div className="flex items-center space-x-3">
            {item.icon && <span className="text-xl">{item.icon}</span>}
            <span className="font-medium">{item.label}</span>
          </div>
          {hasChildren && (
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={`fixed left-0 top-32 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-50 lg:z-30 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 transition-transform duration-300`}>
      <div className="p-4">
        <h2 className="text-xl font-bold text-black mb-6 px-4">Tools Menu</h2>
        <nav className="space-y-1">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>
      </div>
    </aside>
  )
}

