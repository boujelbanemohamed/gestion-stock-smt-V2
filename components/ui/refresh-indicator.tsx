import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface RefreshIndicatorProps {
  isRefreshing: boolean
  lastRefresh?: Date
}

export function RefreshIndicator({ isRefreshing, lastRefresh }: RefreshIndicatorProps) {
  const formatLastRefresh = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return "À l'instant"
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
    return `Il y a ${Math.floor(diff / 3600)} h`
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-2">
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing ? "Actualisation..." : "Synchronisé"}
      </Badge>
      {lastRefresh && !isRefreshing && <span className="text-xs text-slate-500">{formatLastRefresh(lastRefresh)}</span>}
    </div>
  )
}
