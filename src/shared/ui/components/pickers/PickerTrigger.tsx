import * as React from 'react'
import { Flex, Text } from '@radix-ui/themes'
import { Calendar } from 'iconoir-react'
import { motionEaseRevealOut, motionRevealTransition } from '@shared/lib/motion'
import './PickerTrigger.css'

export type FieldDisplay = {
  label: string
  primary: string
  secondary?: string
  muted?: boolean
  active?: boolean
}

type PickerTriggerProps = {
  fields: Array<FieldDisplay>
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  compact?: boolean
  /** When true, Start/End fields are clickable (popover open on times tab). */
  fieldInteraction?: boolean
  onFieldClick?: (field: 'start' | 'end') => void
  onOpen?: () => void
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>

const FIELD_SLOT_PADDING = '3px 6px'

function fieldId(label: string): 'start' | 'end' | null {
  if (label === 'Start') return 'start'
  if (label === 'End') return 'end'
  return null
}

function fieldAriaLabel(field: FieldDisplay): string {
  return `${field.label} ${field.primary}${field.secondary ? ` ${field.secondary}` : ''}`
}

const SURFACE_INPUT_FOCUS_OUTLINE: React.CSSProperties = {
  outline: '2px solid var(--focus-8)',
  outlineOffset: '-1px',
}

const PICKER_SURFACE_TRIGGER_CLASS = 'picker-surface-trigger'

function mergeTriggerClassName(className?: string): string {
  return [PICKER_SURFACE_TRIGGER_CLASS, className].filter(Boolean).join(' ')
}

function surfaceInputHoverShadow(invalid: boolean): string {
  return `inset 0 0 0 1px ${invalid ? 'var(--red-9)' : 'var(--gray-a8)'}`
}

function surfaceInputRestShadow(invalid: boolean): string {
  return `inset 0 0 0 1px ${invalid ? 'var(--red-8)' : 'var(--gray-a7)'}`
}

/** Matches Radix TextField/TextArea surface variant (translucent fill + inset border). */
function radixSurfaceInputStyle(
  invalid: boolean,
  hovered = false,
): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface)',
    border: 'none',
    boxShadow: hovered
      ? surfaceInputHoverShadow(invalid)
      : surfaceInputRestShadow(invalid),
  }
}

function surfaceInputOutline(active: boolean): React.CSSProperties {
  return active ? SURFACE_INPUT_FOCUS_OUTLINE : { outline: 'none' }
}

function useSurfaceInputActiveState(props: React.HTMLAttributes<HTMLElement>) {
  const [focusVisible, setFocusVisible] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const dataState = props['data-state']
  const active = focusVisible || dataState === 'open' || pressed

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      props.onFocus?.(e)
      if (e.currentTarget.matches(':focus-visible')) {
        setFocusVisible(true)
      }
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      props.onBlur?.(e)
      setFocusVisible(false)
    },
  }

  const interactionHandlers = {
    ...focusHandlers,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      props.onPointerDown?.(e)
      if (e.button !== 0 || e.defaultPrevented) return
      setPressed(true)
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      props.onPointerUp?.(e)
      setPressed(false)
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      props.onPointerCancel?.(e)
      setPressed(false)
    },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      props.onMouseEnter?.(e)
      setHovered(true)
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      props.onMouseLeave?.(e)
      setHovered(false)
      setPressed(false)
    },
  }

  return { active, hovered, interactionHandlers }
}

const containerStyle = (
  invalid: boolean,
  disabled: boolean,
  hasValue: boolean,
  active: boolean,
  hovered: boolean,
): React.CSSProperties => ({
  width: '100%',
  minHeight: hasValue ? 78 : 72,
  padding: '11px 14px',
  borderRadius: 'var(--radius-3)',
  ...radixSurfaceInputStyle(invalid, active ? false : hovered),
  ...surfaceInputOutline(active),
  opacity: disabled ? 0.6 : 1,
  transition: 'box-shadow 0.15s, outline-color 0.15s',
  textAlign: 'left',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'stretch',
})

function FieldContent({ field }: { field: FieldDisplay }) {
  return (
    <>
      <Text as="div" size="1" color="gray" weight="medium">
        {field.label}
      </Text>
      <Text
        as="div"
        size="2"
        weight="medium"
        color={field.muted ? 'gray' : undefined}
      >
        {field.primary}
      </Text>
      {field.secondary && (
        <Text as="div" size="1" color="gray" weight="medium">
          {field.secondary}
        </Text>
      )}
    </>
  )
}

function FieldHighlight({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'var(--radius-2)',
        background: 'var(--blue-a3)',
        boxShadow: 'inset 0 0 0 1px var(--blue-a6)',
        opacity: active ? 1 : 0,
        transition: motionRevealTransition(['opacity'], {
          ease: motionEaseRevealOut,
        }),
        pointerEvents: 'none',
      }}
    />
  )
}

function FieldSlot({
  field,
  interactive,
  onClick,
  disabled,
}: {
  field: FieldDisplay
  interactive?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const content = (
    <Flex
      direction="column"
      justify="center"
      gap="1"
      style={{ position: 'relative', zIndex: 1, width: '100%' }}
    >
      <FieldContent field={field} />
    </Flex>
  )

  const slotStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    padding: FIELD_SLOT_PADDING,
    borderRadius: 'var(--radius-2)',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'stretch',
  }

  if (interactive && onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={field.active ?? false}
        aria-label={fieldAriaLabel(field)}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        style={{
          ...slotStyle,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <FieldHighlight active={field.active ?? false} />
        {content}
      </button>
    )
  }

  return (
    <div style={slotStyle}>
      <FieldHighlight active={field.active ?? false} />
      {content}
    </div>
  )
}

function FieldsRow({
  fields,
  fieldInteraction,
  onFieldClick,
  disabled,
}: {
  fields: Array<FieldDisplay>
  fieldInteraction?: boolean
  onFieldClick?: (field: 'start' | 'end') => void
  disabled?: boolean
}) {
  return (
    <Flex
      align="stretch"
      justify="between"
      gap="3"
      style={{ width: '100%', flex: 1 }}
    >
      {fields.map((field) => {
        const id = fieldId(field.label)
        const interactive =
          fieldInteraction && id != null && onFieldClick != null
        return (
          <FieldSlot
            key={field.label}
            field={field}
            interactive={interactive}
            disabled={disabled}
            onClick={interactive ? () => onFieldClick(id) : undefined}
          />
        )
      })}
    </Flex>
  )
}

export const PickerTrigger = React.forwardRef<
  HTMLButtonElement | HTMLDivElement,
  PickerTriggerProps
>(function PickerTrigger(
  {
    fields,
    placeholder = 'Select',
    invalid = false,
    disabled = false,
    compact = false,
    fieldInteraction = false,
    onFieldClick,
    onOpen,
    ...buttonProps
  },
  ref,
) {
  const hasValue = fields.some((f) => !f.muted)
  const useInteractiveFields =
    fieldInteraction && hasValue && onFieldClick != null
  const { className, ...restButtonProps } = buttonProps
  const { active, hovered, interactionHandlers } =
    useSurfaceInputActiveState(restButtonProps)

  if (compact) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        aria-label={placeholder}
        onClick={onOpen}
        {...restButtonProps}
        {...interactionHandlers}
        className={mergeTriggerClassName(className)}
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-3)',
          ...radixSurfaceInputStyle(invalid, active ? false : hovered),
          ...surfaceInputOutline(active),
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.15s, outline-color 0.15s',
          ...restButtonProps.style,
        }}
      >
        <Calendar width={16} height={16} />
      </button>
    )
  }

  if (useInteractiveFields) {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        {...restButtonProps}
        {...interactionHandlers}
        className={mergeTriggerClassName(className)}
        style={{
          ...containerStyle(invalid, disabled, hasValue, active, hovered),
          ...restButtonProps.style,
        }}
      >
        <FieldsRow
          fields={fields}
          fieldInteraction
          onFieldClick={onFieldClick}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      disabled={disabled}
      onClick={onOpen}
      {...restButtonProps}
      {...interactionHandlers}
      className={mergeTriggerClassName(className)}
      style={{
        ...containerStyle(invalid, disabled, hasValue, active, hovered),
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...restButtonProps.style,
      }}
    >
      {!hasValue ? (
        <Flex align="center" gap="2" style={{ width: '100%' }}>
          <Calendar width={18} height={18} color="var(--gray-9)" />
          <Text size="2" color="gray">
            {placeholder}
          </Text>
        </Flex>
      ) : (
        <FieldsRow fields={fields} disabled={disabled} />
      )}
    </button>
  )
})

/** Matches Radix TextField size 2 (default) height and typography. */
export function textFieldLikeTriggerStyle(
  invalid: boolean,
  hasValue: boolean,
  disabled: boolean,
  active: boolean,
  hovered: boolean,
): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    height: 'var(--space-6)',
    padding: '0 var(--space-2)',
    borderRadius: 'max(var(--radius-2), var(--radius-full))',
    ...radixSurfaceInputStyle(invalid, active ? false : hovered),
    ...surfaceInputOutline(active),
    color: hasValue ? 'var(--gray-12)' : 'var(--gray-9)',
    fontSize: 'var(--font-size-2)',
    lineHeight: 'var(--line-height-2)',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'box-shadow 0.15s, outline-color 0.15s',
    textAlign: 'left',
  }
}

/** Single-field text trigger for date/time pickers. */
export const SinglePickerTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    displayValue: string
    placeholder: string
    invalid?: boolean
    disabled?: boolean
    icon?: React.ReactNode
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SinglePickerTrigger(
  {
    displayValue,
    placeholder,
    invalid = false,
    disabled = false,
    icon,
    ...buttonProps
  },
  ref,
) {
  const hasValue = displayValue !== placeholder
  const { className, ...restButtonProps } = buttonProps
  const { active, hovered, interactionHandlers } =
    useSurfaceInputActiveState(restButtonProps)

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      {...restButtonProps}
      {...interactionHandlers}
      className={mergeTriggerClassName(className)}
      style={{
        ...textFieldLikeTriggerStyle(
          invalid,
          hasValue,
          disabled,
          active,
          hovered,
        ),
        ...restButtonProps.style,
      }}
    >
      {icon ?? <Calendar width={16} height={16} />}
      {displayValue}
    </button>
  )
})
