"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, Landmark, CreditCard, MapPin, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { authenticatedFetch } from "@/lib/api-client"

interface SearchResults {
  banks: Array<{ id: string; name: string; code: string }>
  cards: Array<{ id: string; name: string; type: string; bankName: string }>
  locations: Array<{ id: string; name: string; bankName: string }>
  users: Array<{ id: string; name: string; email: string; role: string }>
}

const EMPTY_RESULTS: SearchResults = { banks: [], cards: [], locations: [], users: [] }

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await authenticatedFetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        const data = await response.json()
        if (data.success) {
          setResults(data.data)
        }
      } catch (error) {
        console.error("Error searching:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const hasResults =
    results.banks.length > 0 || results.cards.length > 0 || results.locations.length > 0 || results.users.length > 0

  const closeSearch = () => {
    setIsOpen(false)
    setQuery("")
    setResults(EMPTY_RESULTS)
  }

  const goTo = (href: string) => {
    router.push(href)
    closeSearch()
  }

  return (
    <Popover
      open={isOpen && query.trim().length >= 2}
      onOpenChange={(open) => {
        if (!open) closeSearch()
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher une carte, une banque..."
            className="pl-9"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] p-0 sm:w-96"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-96 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche...
            </div>
          ) : !hasResults ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucun résultat pour « {query} »</p>
          ) : (
            <div className="space-y-3">
              {results.banks.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-semibold uppercase text-slate-400">Banques</p>
                  {results.banks.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => goTo(`/dashboard/banks?q=${encodeURIComponent(bank.name)}`)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <Landmark className="h-4 w-4 shrink-0 text-[#008DA8]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{bank.name}</p>
                        <p className="text-xs text-slate-500">{bank.code}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.cards.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-semibold uppercase text-slate-400">Cartes</p>
                  {results.cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => goTo(`/dashboard/cards/${card.id}`)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <CreditCard className="h-4 w-4 shrink-0 text-[#008DA8]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{card.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {card.bankName} • {card.type}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.locations.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-semibold uppercase text-slate-400">Emplacements</p>
                  {results.locations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => goTo(`/dashboard/locations?q=${encodeURIComponent(location.name)}`)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-[#008DA8]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{location.name}</p>
                        <p className="truncate text-xs text-slate-500">{location.bankName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.users.length > 0 && (
                <div>
                  <p className="px-2 text-xs font-semibold uppercase text-slate-400">Utilisateurs</p>
                  {results.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => goTo(`/dashboard/users?q=${encodeURIComponent(user.name)}`)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <Users className="h-4 w-4 shrink-0 text-[#008DA8]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
