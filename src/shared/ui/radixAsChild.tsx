import { Dialog, DropdownMenu, Popover } from '@radix-ui/themes'
import type * as React from 'react'

type AsChildProps = React.PropsWithChildren<{ asChild?: boolean }>

/** Radix Themes supports asChild at runtime; types omit it on some triggers. */
export const PopoverTrigger = Popover.Trigger as React.FC<AsChildProps>
export const DialogTrigger = Dialog.Trigger as React.FC<AsChildProps>
export const DropdownMenuTrigger =
  DropdownMenu.Trigger as React.FC<AsChildProps>
