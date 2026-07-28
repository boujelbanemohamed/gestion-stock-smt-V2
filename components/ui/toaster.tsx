'use client'

import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

// Une icône par variante : toutes les notifications de l'application passent
// désormais par ici, la nature du message (succès / erreur / information) doit
// donc se lire avant même le texte. Cela remplace les « ✅ » et « ❌ » qui
// étaient écrits à la main dans certains messages et absents des autres.
const ICONE = {
  success: CheckCircle2,
  destructive: AlertCircle,
  default: Info,
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        const Icone = ICONE[variant ?? 'default'] ?? ICONE.default

        return (
          // Une erreur mérite plus de temps de lecture qu'une confirmation ;
          // props est étalé en dernier pour qu'un appelant puisse imposer sa
          // propre durée.
          <Toast
            key={id}
            variant={variant}
            duration={variant === 'destructive' ? 8000 : 5000}
            {...props}
          >
            <div className="flex items-start gap-3">
              <Icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  // whitespace-pre-line : certains messages repris des anciens
                  // alert() comportent des retours à la ligne volontaires.
                  <ToastDescription className="whitespace-pre-line">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
