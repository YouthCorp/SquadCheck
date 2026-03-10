import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Severity variants
        critical:
          "bg-[color-mix(in_srgb,var(--sc-red)_18%,transparent)] text-[var(--sc-red)] border-transparent sc-badge-critical",
        high:
          "bg-[color-mix(in_srgb,var(--sc-red)_18%,transparent)] text-[var(--sc-red)] border-transparent",
        moderate:
          "bg-[color-mix(in_srgb,var(--sc-yellow)_18%,transparent)] text-[var(--sc-yellow)] border-transparent",
        low:
          "bg-[color-mix(in_srgb,var(--sc-gray)_15%,transparent)] text-[var(--sc-gray)] border-transparent",
        success:
          "bg-[color-mix(in_srgb,var(--sc-green)_18%,transparent)] text-[var(--sc-green)] border-transparent",
        info:
          "bg-[color-mix(in_srgb,var(--sc-blue)_15%,transparent)] text-[var(--sc-blue)] border-transparent",
        // Form result variants
        win:
          "bg-[color-mix(in_srgb,var(--sc-green)_22%,transparent)] text-[var(--sc-green)] border-transparent font-bold",
        draw:
          "bg-[color-mix(in_srgb,var(--sc-yellow)_20%,transparent)] text-[var(--sc-yellow)] border-transparent font-bold",
        loss:
          "bg-[color-mix(in_srgb,var(--sc-red)_22%,transparent)] text-[var(--sc-red)] border-transparent font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
