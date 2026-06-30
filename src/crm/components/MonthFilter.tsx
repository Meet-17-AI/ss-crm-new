import { useState, useRef, useEffect } from 'react'
import './MonthFilter.css'

interface MonthFilterProps {
  selectedMonth?: string;
  onChange?: (month: string) => void;
}

const MonthFilter = ({ selectedMonth, onChange }: MonthFilterProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Generate months from Jan 2024 to current month
  const generateMonths = () => {
    const months: string[] = []
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    const start = new Date(2024, 0, 1) // Jan 2024
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
      months.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`)
    }
    return months
  }

  const months = generateMonths()
  const defaultMonth = months[0]
  const current = selectedMonth || defaultMonth

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (month: string) => {
    if (onChange) {
      onChange(month);
    }
    setIsOpen(false)
  }

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span>{current}</span>
        <svg
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <div
            className={`dropdown-item ${current === 'All Time' ? 'selected' : ''}`}
            onClick={() => handleSelect('All Time')}
          >
            All Time
          </div>
          {months.map((month) => (
            <div
              key={month}
              className={`dropdown-item ${month === current ? 'selected' : ''}`}
              onClick={() => handleSelect(month)}
            >
              {month}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MonthFilter
