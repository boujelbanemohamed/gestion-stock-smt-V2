import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

describe("DateRangePicker", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("affiche un texte d'invite quand aucune période n'est sélectionnée", () => {
    render(<DateRangePicker dateRange={undefined} onDateRangeChange={vi.fn()} />)
    expect(screen.getByText("Sélectionner une période")).toBeInTheDocument()
  })

  it("affiche une seule date formatée quand seule la date de début est définie", () => {
    render(
      <DateRangePicker
        dateRange={{ from: new Date(2026, 0, 15), to: undefined }}
        onDateRangeChange={vi.fn()}
      />,
    )
    expect(screen.getByText("15 janv. 2026")).toBeInTheDocument()
  })

  it("affiche la plage de dates formatée quand début et fin sont définis", () => {
    render(
      <DateRangePicker
        dateRange={{ from: new Date(2026, 0, 15), to: new Date(2026, 0, 20) }}
        onDateRangeChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/15 janv\. 2026\s*-\s*20 janv\. 2026/)).toBeInTheDocument()
  })

  it("réinitialise la période sélectionnée au clic sur Réinitialiser", async () => {
    const onDateRangeChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DateRangePicker
        dateRange={{ from: new Date(2026, 0, 15), to: new Date(2026, 0, 20) }}
        onDateRangeChange={onDateRangeChange}
      />,
    )

    await user.click(screen.getByRole("button", { name: /15 janv\. 2026/ }))
    await user.click(await screen.findByRole("button", { name: "Réinitialiser" }))

    expect(onDateRangeChange).toHaveBeenCalledWith(undefined)
  })
})
