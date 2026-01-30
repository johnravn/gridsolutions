// src/features/company/components/CompanySetupTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  RadioGroup,
  Separator,
  Spinner,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Check, Edit, MessageText, Trash, Upload, Xmark } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import EditBrandsDialog from '@features/inventory/components/EditBrandsDialog'
import { useAuthz } from '@shared/auth/useAuthz'
import EditWelcomeMatterDialog from './dialogs/EditWelcomeMatterDialog'

type ItemCategory = {
  id: string
  company_id: string
  name: string
}

function CategoriesDialogContent({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ name: '' })
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState<string>('')

  const categoriesQueryKey = ['company', companyId, 'item-categories'] as const

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: categoriesQueryKey,
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<ItemCategory>> => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, company_id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 5_000,
  })

  const createMutation = useMutation({
    mutationFn: async (f: { name: string }) => {
      if (!companyId) throw new Error('No company selected')
      const { error } = await supabase.from('item_categories').insert({
        company_id: companyId,
        name: f.name.trim(),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setForm({ name: '' })
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      const { error } = await supabase
        .from('item_categories')
        .update({ name: payload.name.trim() })
        .eq('id', payload.id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditingId(null)
      setEditingName('')
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Edit Categories</Dialog.Title>

        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            padding: 8,
            marginTop: 12,
          }}
        >
          {isLoading ? (
            <Flex align="center" justify="center" p="4">
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            </Flex>
          ) : isError ? (
            <Text color="red">
              {(error as any)?.message ?? 'Failed to load'}
            </Text>
          ) : (categories?.length ?? 0) === 0 ? (
            <Text color="gray">No categories yet.</Text>
          ) : (
            categories!.map((c, idx) => (
              <React.Fragment key={c.id}>
                {idx > 0 && <Separator my="2" />}
                <Flex align="center" gap="2" py="1">
                  {editingId === c.id ? (
                    <>
                      <TextField.Root
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Save"
                        disabled={
                          updateMutation.isPending ||
                          editingName.trim().length === 0
                        }
                        onClick={() =>
                          updateMutation.mutate({ id: c.id, name: editingName })
                        }
                      >
                        <Check />
                      </IconButton>
                      <IconButton
                        size="2"
                        variant="ghost"
                        title="Cancel"
                        onClick={() => {
                          setEditingId(null)
                          setEditingName('')
                        }}
                      >
                        <Xmark />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Text style={{ flex: 1 }}>{c.name}</Text>
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Edit name"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditingName(c.name)
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="2"
                        color="red"
                        variant="soft"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(c.id)}
                      >
                        <Trash />
                      </IconButton>
                    </>
                  )}
                </Flex>
              </React.Fragment>
            ))
          )}
        </div>

        <Flex direction="column" gap="3" mt="3">
          <div>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              New category name
            </Text>
            <TextField.Root
              placeholder="e.g. Audio"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
            />
          </div>

          {(createMutation.isError ||
            updateMutation.isError ||
            deleteMutation.isError) && (
            <Text color="red">
              {(createMutation.error as any)?.message ||
                (updateMutation.error as any)?.message ||
                (deleteMutation.error as any)?.message ||
                'Something went wrong'}
            </Text>
          )}
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
          <Button
            onClick={() => createMutation.mutate({ name: form.name })}
            disabled={!form.name.trim() || createMutation.isPending}
            variant="classic"
          >
            {createMutation.isPending ? 'Saving…' : 'Create'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function GeneralRatesSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [isEditing, setIsEditing] = React.useState(false)
  const [employeeDailyRate, setEmployeeDailyRate] = React.useState<string>('')
  const [employeeHourlyRate, setEmployeeHourlyRate] = React.useState<string>('')
  const [ownerDailyRate, setOwnerDailyRate] = React.useState<string>('')
  const [ownerHourlyRate, setOwnerHourlyRate] = React.useState<string>('')

  // Fetch current rates
  const { data: companyRates, isLoading } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select(
          'employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate',
        )
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Initialize form when data loads
  React.useEffect(() => {
    if (companyRates && !isEditing) {
      setEmployeeDailyRate(companyRates.employee_daily_rate?.toString() ?? '')
      setEmployeeHourlyRate(companyRates.employee_hourly_rate?.toString() ?? '')
      setOwnerDailyRate(companyRates.owner_daily_rate?.toString() ?? '')
      setOwnerHourlyRate(companyRates.owner_hourly_rate?.toString() ?? '')
    }
  }, [companyRates, isEditing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        employee_daily_rate: employeeDailyRate.trim()
          ? parseFloat(employeeDailyRate)
          : null,
        employee_hourly_rate: employeeHourlyRate.trim()
          ? parseFloat(employeeHourlyRate)
          : null,
        owner_daily_rate: ownerDailyRate.trim()
          ? parseFloat(ownerDailyRate)
          : null,
        owner_hourly_rate: ownerHourlyRate.trim()
          ? parseFloat(ownerHourlyRate)
          : null,
      }

      // Validate rates
      Object.values(updateData).forEach((val) => {
        if (val !== null && (isNaN(val) || val < 0)) {
          throw new Error('All rates must be positive numbers')
        }
      })

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId)

      if (error) throw error
    },
    onSuccess: async () => {
      setIsEditing(false)
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'general-rates'],
      })
      success('General rates updated', 'Rates have been saved successfully.')
    },
    onError: (e: any) => {
      toastError('Failed to update rates', e?.message ?? 'Please try again.')
    },
  })

  if (isLoading) {
    return (
      <Flex align="center" gap="1" mb="4">
        <Text>Loading</Text>
        <Spinner size="2" />
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="4" mb="6">
      {!isEditing ? (
        <>
          <Box
            p="3"
            style={{
              border: '1px solid var(--gray-a6)',
              borderRadius: 8,
              background: 'var(--gray-a2)',
            }}
          >
            <Flex direction="column" gap="3">
              <Box>
                <Text
                  size="2"
                  weight="bold"
                  mb="2"
                  style={{ display: 'block' }}
                >
                  Employee Rates
                </Text>
                <DefinitionList>
                  <DT>Daily rate</DT>
                  <DD>
                    {companyRates?.employee_daily_rate
                      ? `${Number(companyRates.employee_daily_rate).toFixed(2)} kr per day`
                      : '—'}
                  </DD>
                  <DT>Hourly rate</DT>
                  <DD>
                    {companyRates?.employee_hourly_rate
                      ? `${Number(companyRates.employee_hourly_rate).toFixed(2)} kr per hour`
                      : '—'}
                  </DD>
                </DefinitionList>
              </Box>
              <Separator />
              <Box>
                <Text
                  size="2"
                  weight="bold"
                  mb="2"
                  style={{ display: 'block' }}
                >
                  Owner Rates
                </Text>
                <DefinitionList>
                  <DT>Daily rate</DT>
                  <DD>
                    {companyRates?.owner_daily_rate
                      ? `${Number(companyRates.owner_daily_rate).toFixed(2)} kr per day`
                      : '—'}
                  </DD>
                  <DT>Hourly rate</DT>
                  <DD>
                    {companyRates?.owner_hourly_rate
                      ? `${Number(companyRates.owner_hourly_rate).toFixed(2)} kr per hour`
                      : '—'}
                  </DD>
                </DefinitionList>
              </Box>
            </Flex>
          </Box>
          <Button size="2" variant="outline" onClick={() => setIsEditing(true)}>
            <Edit width={16} height={16} />
            Edit General Rates
          </Button>
        </>
      ) : (
        <>
          <Flex direction="column" gap="4">
            <Box>
              <Text size="2" weight="bold" mb="3" style={{ display: 'block' }}>
                Employee Rates
              </Text>
              <Flex direction="column" gap="3">
                <Box>
                  <Text
                    as="label"
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Daily rate
                  </Text>
                  <Flex align="center" gap="2">
                    <TextField.Root
                      type="number"
                      value={employeeDailyRate}
                      onChange={(e) => setEmployeeDailyRate(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{ width: 150 }}
                    />
                    <Text size="2" color="gray">
                      kr per day
                    </Text>
                  </Flex>
                </Box>
                <Box>
                  <Text
                    as="label"
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Hourly rate
                  </Text>
                  <Flex align="center" gap="2">
                    <TextField.Root
                      type="number"
                      value={employeeHourlyRate}
                      onChange={(e) => setEmployeeHourlyRate(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{ width: 150 }}
                    />
                    <Text size="2" color="gray">
                      kr per hour
                    </Text>
                  </Flex>
                </Box>
              </Flex>
            </Box>

            <Separator />

            <Box>
              <Text size="2" weight="bold" mb="3" style={{ display: 'block' }}>
                Owner Rates
              </Text>
              <Flex direction="column" gap="3">
                <Box>
                  <Text
                    as="label"
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Daily rate
                  </Text>
                  <Flex align="center" gap="2">
                    <TextField.Root
                      type="number"
                      value={ownerDailyRate}
                      onChange={(e) => setOwnerDailyRate(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{ width: 150 }}
                    />
                    <Text size="2" color="gray">
                      kr per day
                    </Text>
                  </Flex>
                </Box>
                <Box>
                  <Text
                    as="label"
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Hourly rate
                  </Text>
                  <Flex align="center" gap="2">
                    <TextField.Root
                      type="number"
                      value={ownerHourlyRate}
                      onChange={(e) => setOwnerHourlyRate(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{ width: 150 }}
                    />
                    <Text size="2" color="gray">
                      kr per hour
                    </Text>
                  </Flex>
                </Box>
              </Flex>
            </Box>
          </Flex>

          <Flex gap="2" justify="end">
            <Button
              size="2"
              variant="soft"
              onClick={() => {
                setIsEditing(false)
                // Reset to original values
                if (companyRates) {
                  setEmployeeDailyRate(
                    companyRates.employee_daily_rate?.toString() ?? '',
                  )
                  setEmployeeHourlyRate(
                    companyRates.employee_hourly_rate?.toString() ?? '',
                  )
                  setOwnerDailyRate(
                    companyRates.owner_daily_rate?.toString() ?? '',
                  )
                  setOwnerHourlyRate(
                    companyRates.owner_hourly_rate?.toString() ?? '',
                  )
                }
              }}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="2"
              variant="classic"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Spinner size="2" /> Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </Flex>
        </>
      )}
    </Flex>
  )
}

function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        rowGap: 8,
        columnGap: 12,
      }}
    >
      {children}
    </dl>
  )
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt>
      <Text size="1" color="gray">
        {children}
      </Text>
    </dt>
  )
}

function DD({ children }: { children: React.ReactNode }) {
  return (
    <dd>
      <Text size="2">{children}</Text>
    </dd>
  )
}

export default function CompanySetupTab() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const { companyRole } = useAuthz()
  const [editCategoriesOpen, setEditCategoriesOpen] = React.useState(false)
  const [editBrandsOpen, setEditBrandsOpen] = React.useState(false)
  const [welcomeMatterOpen, setWelcomeMatterOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploadingPDF, setUploadingPDF] = React.useState(false)

  // Fetch company_expansions for latest_feed_open_to_freelancers setting
  const { data: expansions, isLoading: expansionsLoading } = useQuery({
    queryKey: ['company', companyId, 'expansions'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('id, latest_feed_open_to_freelancers')
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  // Terms and conditions state - fetch from company directly
  const { data: companyTermsData } = useQuery({
    queryKey: ['company', companyId, 'terms'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select(
          'terms_and_conditions_type, terms_and_conditions_text, terms_and_conditions_pdf_path',
        )
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  const [termsType, setTermsType] = React.useState<'pdf' | 'text' | null>(null)
  const [termsText, setTermsText] = React.useState<string>('')
  const [uploadedPdfPath, setUploadedPdfPath] = React.useState<string | null>(
    null,
  )

  // Update state when company data loads
  React.useEffect(() => {
    if (companyTermsData) {
      const type = companyTermsData.terms_and_conditions_type
      setTermsType(type === 'pdf' || type === 'text' ? type : null)
      setTermsText(companyTermsData.terms_and_conditions_text || '')
      setUploadedPdfPath(companyTermsData.terms_and_conditions_pdf_path || null)
    }
  }, [companyTermsData])

  // Upload PDF function
  const uploadPDF = async (file: File) => {
    if (!companyId) throw new Error('No company selected')
    setUploadingPDF(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      if (ext !== 'pdf') {
        throw new Error('Only PDF files are allowed')
      }
      const fileName = `terms_${Date.now()}.${ext}`
      const path = `${companyId}/terms/${fileName}`

      // Delete old PDF if exists
      if (companyTermsData?.terms_and_conditions_pdf_path) {
        await supabase.storage
          .from('company_files')
          .remove([companyTermsData.terms_and_conditions_pdf_path])
      }

      const { error: uploadError } = await supabase.storage
        .from('company_files')
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (uploadError) throw uploadError

      // Update local state with uploaded path (user must click Save to persist)
      setUploadedPdfPath(path)
      info('PDF uploaded', 'Click "Save" to apply the changes.')
      return path
    } finally {
      setUploadingPDF(false)
    }
  }

  // Save terms and conditions mutation
  const saveTermsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      if (!termsType)
        throw new Error('Please select a type for terms and conditions')

      const updateData: any = {
        terms_and_conditions_type: termsType,
      }

      if (termsType === 'text') {
        updateData.terms_and_conditions_text = termsText.trim() || null
        updateData.terms_and_conditions_pdf_path = null
      } else {
        // Use uploaded PDF path or existing one
        if (
          !uploadedPdfPath &&
          !companyTermsData?.terms_and_conditions_pdf_path
        ) {
          throw new Error('Please upload a PDF file first')
        }
        updateData.terms_and_conditions_pdf_path =
          uploadedPdfPath ||
          companyTermsData?.terms_and_conditions_pdf_path ||
          null
        updateData.terms_and_conditions_text = null
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId)

      if (error) throw error
    },
    onSuccess: async () => {
      // Reset uploaded path after save
      setUploadedPdfPath(null)
      setShowEditForm(false)
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'terms'],
      })
      success(
        'Terms and conditions saved',
        'Terms will be included with offers.',
      )
    },
    onError: (error: any) => {
      toastError(
        'Failed to save terms and conditions',
        error?.message ?? 'Please try again.',
      )
    },
  })

  // Delete terms and conditions
  const deleteTermsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')

      // Delete PDF if exists
      if (companyTermsData?.terms_and_conditions_pdf_path) {
        await supabase.storage
          .from('company_files')
          .remove([companyTermsData.terms_and_conditions_pdf_path])
      }

      const { error } = await supabase
        .from('companies')
        .update({
          terms_and_conditions_type: null,
          terms_and_conditions_text: null,
          terms_and_conditions_pdf_path: null,
        })
        .eq('id', companyId)

      if (error) throw error
    },
    onSuccess: async () => {
      setTermsType(null)
      setTermsText('')
      setUploadedPdfPath(null)
      setShowEditForm(false)
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'terms'],
      })
      success('Terms and conditions deleted', 'Terms have been removed.')
    },
    onError: (error: any) => {
      toastError(
        'Failed to delete terms and conditions',
        error?.message ?? 'Please try again.',
      )
    },
  })

  // Get PDF URL if exists (use uploaded path or existing one)
  const pdfPath =
    uploadedPdfPath || companyTermsData?.terms_and_conditions_pdf_path
  const pdfUrl = React.useMemo(() => {
    if (!pdfPath) return null
    const { data } = supabase.storage
      .from('company_files')
      .getPublicUrl(pdfPath)
    return data.publicUrl
  }, [pdfPath])

  // Extract filename from PDF path
  const pdfFileName = React.useMemo(() => {
    if (!pdfPath) return null
    const parts = pdfPath.split('/')
    return parts[parts.length - 1] || 'terms.pdf'
  }, [pdfPath])

  // Check if terms are currently configured
  const isConfigured = !!(
    companyTermsData?.terms_and_conditions_type &&
    (companyTermsData.terms_and_conditions_type === 'pdf'
      ? companyTermsData.terms_and_conditions_pdf_path
      : companyTermsData.terms_and_conditions_text)
  )

  const [showEditForm, setShowEditForm] = React.useState(false)

  const [pendingToggleValue, setPendingToggleValue] = React.useState<
    boolean | null
  >(null)

  const updateFeedAccessMutation = useMutation({
    mutationFn: async (openToFreelancers: boolean) => {
      if (!companyId) throw new Error('No company selected')

      // Upsert: create if doesn't exist, update if exists
      if (expansions?.id) {
        const { error } = await supabase
          .from('company_expansions')
          .update({ latest_feed_open_to_freelancers: openToFreelancers })
          .eq('id', expansions.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('company_expansions').insert({
          company_id: companyId,
          latest_feed_open_to_freelancers: openToFreelancers,
        })
        if (error) throw error
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansions'],
      })
      if (pendingToggleValue) {
        success(
          'Latest feed enabled for freelancers',
          'Freelancers can now view the Latest feed',
        )
      } else {
        success(
          'Latest feed disabled for freelancers',
          'Freelancers can no longer view the Latest feed',
        )
      }
      setPendingToggleValue(null)
    },
    onError: (error: any) => {
      toastError(
        'Failed to update setting',
        error?.message ?? 'Please try again.',
      )
      setPendingToggleValue(null)
    },
  })

  if (!companyId) return <div>No company selected.</div>

  return (
    <>
      <CategoriesDialogContent
        open={editCategoriesOpen}
        onOpenChange={setEditCategoriesOpen}
        companyId={companyId}
      />

      <EditBrandsDialog
        open={editBrandsOpen}
        onOpenChange={setEditBrandsOpen}
        companyId={companyId}
      />

      <Card
        size="4"
        style={{
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          p="4"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {/* Welcome Matter Section */}
          <Heading size="4" mb="4">
            Welcome Message
          </Heading>
          <Flex direction="column" gap="3" mb="6">
            <Box>
              <Flex align="center" gap="3" mb="2">
                <Text as="div" size="2" weight="bold">
                  Welcome matter
                </Text>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => setWelcomeMatterOpen(true)}
                >
                  <MessageText />
                  Edit
                </Button>
              </Flex>
              <Text as="div" size="1" color="gray">
                Message sent to all users when they are added to this company
              </Text>
            </Box>
            <EditWelcomeMatterDialog
              open={welcomeMatterOpen}
              onOpenChange={setWelcomeMatterOpen}
              onSaved={() => {}}
            />
          </Flex>

          <Separator size="4" mb="6" />

          {/* Inventory Setup Section */}
          <Heading size="4" mb="4">
            Inventory setup
          </Heading>

          <Flex direction="column" gap="3" mb="6">
            <Button
              size="3"
              variant="outline"
              onClick={() => setEditCategoriesOpen(true)}
            >
              <Edit /> Manage Categories
            </Button>
            <Button
              size="3"
              variant="outline"
              onClick={() => setEditBrandsOpen(true)}
            >
              <Edit /> Manage Brands
            </Button>
          </Flex>

          <Separator size="4" mb="6" />

          {/* Terms and Conditions Section */}
          <Flex align="center" justify="between" mb="4">
            <Heading size="4">Terms and Conditions</Heading>
            {isConfigured && (
              <Badge color="green" variant="soft" size="2">
                Configured
              </Badge>
            )}
          </Flex>

          {!isConfigured && !showEditForm ? (
            <Box mb="6">
              <Text size="2" color="gray" mb="3" style={{ display: 'block' }}>
                No terms and conditions configured. Add terms to include them
                with all offers.
              </Text>
              <Button
                size="2"
                variant="outline"
                onClick={() => setShowEditForm(true)}
              >
                <Upload width={16} height={16} />
                Add Terms and Conditions
              </Button>
            </Box>
          ) : (
            <Flex direction="column" gap="4" mb="6">
              {/* Show current configuration summary */}
              {isConfigured &&
                !showEditForm &&
                (() => {
                  if (!companyTermsData) return null
                  const currentTermsType =
                    companyTermsData.terms_and_conditions_type
                  return (
                    <Box
                      p="3"
                      style={{
                        border: '1px solid var(--gray-a6)',
                        borderRadius: 8,
                        background: 'var(--gray-a2)',
                      }}
                    >
                      <Flex align="center" justify="between" gap="2">
                        <Flex direction="column" gap="1" style={{ flex: 1 }}>
                          <Flex align="center" gap="2">
                            <Text size="2" weight="medium">
                              {currentTermsType === 'pdf'
                                ? 'PDF Document'
                                : 'Text Field'}
                            </Text>
                            <Badge
                              variant="soft"
                              color={
                                currentTermsType === 'pdf' ? 'blue' : 'gray'
                              }
                              size="1"
                            >
                              {currentTermsType === 'pdf' ? 'PDF' : 'Text'}
                            </Badge>
                          </Flex>
                          {currentTermsType === 'pdf' && pdfFileName && (
                            <Text size="1" color="gray">
                              {pdfFileName}
                            </Text>
                          )}
                          {currentTermsType === 'text' &&
                            companyTermsData.terms_and_conditions_text && (
                              <Text
                                size="1"
                                color="gray"
                                style={{ maxWidth: 500 }}
                              >
                                {companyTermsData.terms_and_conditions_text
                                  .length > 100
                                  ? `${companyTermsData.terms_and_conditions_text.substring(0, 100)}...`
                                  : companyTermsData.terms_and_conditions_text}
                              </Text>
                            )}
                        </Flex>
                        <Flex gap="2">
                          {currentTermsType === 'pdf' && pdfUrl && (
                            <Button
                              size="2"
                              variant="soft"
                              onClick={() => window.open(pdfUrl, '_blank')}
                            >
                              View
                            </Button>
                          )}
                          <Button
                            size="2"
                            variant="soft"
                            onClick={() => {
                              setShowEditForm(true)
                              setTermsType(
                                currentTermsType === 'pdf' ||
                                  currentTermsType === 'text'
                                  ? currentTermsType
                                  : null,
                              )
                            }}
                          >
                            <Edit width={16} height={16} />
                            Edit
                          </Button>
                          <Button
                            size="2"
                            variant="soft"
                            color="red"
                            onClick={() => deleteTermsMutation.mutate()}
                            disabled={deleteTermsMutation.isPending}
                          >
                            <Trash width={16} height={16} />
                          </Button>
                        </Flex>
                      </Flex>
                    </Box>
                  )
                })()}

              {/* Edit Form */}
              {(showEditForm || !isConfigured) && (
                <>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="medium" mb="1">
                      Type
                    </Text>
                    <RadioGroup.Root
                      value={termsType || ''}
                      onValueChange={(value) => {
                        if (value === 'pdf' || value === 'text') {
                          setTermsType(value)
                        } else {
                          setTermsType(null)
                        }
                      }}
                    >
                      <Flex direction="column" gap="2">
                        <Text as="label" size="2">
                          <Flex align="center" gap="2">
                            <RadioGroup.Item value="pdf" />
                            <Text>PDF Document</Text>
                          </Flex>
                        </Text>
                        <Text as="label" size="2">
                          <Flex align="center" gap="2">
                            <RadioGroup.Item value="text" />
                            <Text>Text Field</Text>
                          </Flex>
                        </Text>
                      </Flex>
                    </RadioGroup.Root>
                  </Flex>

                  {termsType === 'pdf' && (
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="medium" mb="1">
                        PDF Document
                      </Text>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            await uploadPDF(file)
                          } catch (err: any) {
                            toastError(
                              'Upload failed',
                              err?.message ?? 'Please try again.',
                            )
                          } finally {
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                          }
                        }}
                      />
                      {pdfPath ? (
                        <Box
                          p="2"
                          style={{
                            border: '1px solid var(--gray-a6)',
                            borderRadius: 8,
                            background: 'var(--gray-a2)',
                          }}
                        >
                          <Flex align="center" justify="between" gap="2">
                            <Flex
                              direction="column"
                              gap="1"
                              style={{ flex: 1 }}
                            >
                              <Text size="2" weight="medium">
                                {pdfFileName || 'PDF file'}
                              </Text>
                              <Text size="1" color="gray">
                                {uploadedPdfPath
                                  ? 'New file uploaded (click Save to apply)'
                                  : 'Current file'}
                              </Text>
                            </Flex>
                            <Flex gap="2">
                              {pdfUrl && (
                                <Button
                                  size="1"
                                  variant="soft"
                                  onClick={() => window.open(pdfUrl, '_blank')}
                                >
                                  View
                                </Button>
                              )}
                              <Button
                                size="1"
                                variant="soft"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPDF}
                              >
                                <Upload width={14} height={14} />
                                {uploadingPDF ? 'Uploading...' : 'Replace'}
                              </Button>
                            </Flex>
                          </Flex>
                        </Box>
                      ) : (
                        <Button
                          size="2"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPDF}
                        >
                          <Upload width={16} height={16} />
                          {uploadingPDF ? 'Uploading...' : 'Upload PDF'}
                        </Button>
                      )}
                    </Flex>
                  )}

                  {termsType === 'text' && (
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="medium" mb="1">
                        Terms and Conditions Text
                      </Text>
                      <TextArea
                        value={termsText}
                        onChange={(e) => setTermsText(e.target.value)}
                        placeholder="Enter terms and conditions text here..."
                        rows={10}
                        resize="vertical"
                      />
                    </Flex>
                  )}

                  {termsType && (
                    <Flex gap="2" justify="end">
                      {isConfigured && (
                        <Button
                          size="2"
                          variant="soft"
                          onClick={() => {
                            setShowEditForm(false)
                            // Reset to current values
                            const currentType =
                              companyTermsData?.terms_and_conditions_type
                            setTermsType(
                              currentType === 'pdf' || currentType === 'text'
                                ? currentType
                                : null,
                            )
                            setTermsText(
                              companyTermsData?.terms_and_conditions_text || '',
                            )
                            setUploadedPdfPath(null)
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => {
                          deleteTermsMutation.mutate()
                          setShowEditForm(false)
                        }}
                        disabled={deleteTermsMutation.isPending}
                      >
                        {deleteTermsMutation.isPending
                          ? 'Deleting...'
                          : 'Delete'}
                      </Button>
                      <Button
                        size="2"
                        variant="classic"
                        onClick={() => {
                          saveTermsMutation.mutate()
                          setShowEditForm(false)
                        }}
                        disabled={
                          saveTermsMutation.isPending ||
                          (termsType === 'text' && !termsText.trim()) ||
                          (termsType === 'pdf' && !pdfPath)
                        }
                      >
                        {saveTermsMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </Flex>
                  )}
                </>
              )}
            </Flex>
          )}

          <Separator size="4" mb="6" />

          {/* General Rates Section - Owners only */}
          {companyRole === 'owner' && (
            <>
              <Heading size="4" mb="4">
                General Rates
              </Heading>
              <GeneralRatesSection companyId={companyId} />
              <Separator size="4" mb="6" />
            </>
          )}

          {/* Latest Feed Settings */}
          <Heading size="4" mb="4">
            Latest Feed Settings
          </Heading>

          <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="4">
              <Flex direction="column">
                <Text size="3" weight="medium" mb="1">
                  Allow freelancers to view Latest feed
                </Text>
                <Text size="2" color="gray">
                  When enabled, freelancers in your company can view the Latest
                  feed. They will have read-only access and can like and
                  comment.
                </Text>
              </Flex>
              {expansionsLoading ? (
                <Spinner size="2" />
              ) : (
                <Switch
                  checked={
                    updateFeedAccessMutation.isPending
                      ? !expansions?.latest_feed_open_to_freelancers
                      : (expansions?.latest_feed_open_to_freelancers ?? false)
                  }
                  onCheckedChange={(checked) => {
                    setPendingToggleValue(checked)
                    updateFeedAccessMutation.mutate(checked)
                  }}
                  disabled={updateFeedAccessMutation.isPending}
                />
              )}
            </Flex>
          </Flex>
        </Box>
      </Card>
    </>
  )
}
