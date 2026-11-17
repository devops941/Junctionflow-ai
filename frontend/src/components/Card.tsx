import { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export default function Card({ title, children, className = '', action }: Props) {
  return (
    <div className={`bg-white rounded-2xl shadow-xs border border-slate-200/80 transition-all duration-200 ${className}`}>
      {title && (
        <div className="px-5 py-4 border-b border-slate-100/90 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h2>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
