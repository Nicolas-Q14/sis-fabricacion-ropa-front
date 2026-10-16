"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"

function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props<string>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: RadioPrimitive.Root.Props<string>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "relative size-4 shrink-0 rounded-full border border-input text-primary outline-none after:absolute after:inset-0 after:m-auto after:size-2 after:rounded-full after:bg-current after:opacity-0 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:after:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
