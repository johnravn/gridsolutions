import { z } from 'zod'

export type PasswordRequirement = {
  id: string
  label: string
  check: (password: string) => boolean
}

/** Single source of truth for signup + change-password strength rules. */
export const PASSWORD_REQUIREMENTS: Array<PasswordRequirement> = [
  {
    id: 'length',
    label: 'At least 12 characters',
    check: (pwd) => pwd.length >= 12,
  },
  {
    id: 'lowercase',
    label: 'Contains lowercase letter',
    check: (pwd) => /[a-z]/.test(pwd),
  },
  {
    id: 'uppercase',
    label: 'Contains uppercase letter',
    check: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    id: 'number',
    label: 'Contains number',
    check: (pwd) => /[0-9]/.test(pwd),
  },
  {
    id: 'special',
    label: 'Contains special character (!@#$%^&*...)',
    check: (pwd) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
  },
]

export function passwordMeetsRequirements(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.check(password))
}

/** Zod schema for a new password that must satisfy PASSWORD_REQUIREMENTS. */
export const strongPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(passwordMeetsRequirements, {
    message: 'Password does not meet all requirements.',
  })
