import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './formContext'
import { Checkbox } from './fields/Checkbox'
import { Select } from './fields/Select'
import { SubmitButton } from './fields/SubmitButton'
import { Switch } from './fields/Switch'
import { TextArea } from './fields/TextArea'
import { TextField } from './fields/TextField'

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextArea,
    Select,
    Switch,
    Checkbox,
  },
  formComponents: {
    SubmitButton,
  },
})
