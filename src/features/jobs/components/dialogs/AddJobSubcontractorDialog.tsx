import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, Text, TextArea } from '@radix-ui/themes'
import { partnerCustomersQuery } from '@features/inventory/api/partners'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  addJobSubcontractor,
  jobSubcontractorsKey,
} from '../../api/subcontractorQueries'

export default function AddJobSubcontractorDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  excludeCustomerIds = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  excludeCustomerIds?: Array<string>
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [customerId, setCustomerId] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId }),
    enabled: open && !!companyId,
  })

  const availablePartners = partners.filter(
    (p) => !excludeCustomerIds.includes(p.id),
  )

  React.useEffect(() => {
    if (!open) {
      setCustomerId('')
      setNotes('')
    }
  }, [open])

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Select a partner')
      await addJobSubcontractor({
        jobId,
        customerId,
        notes: notes.trim() || null,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
      success('Subcontractor added', 'Partner was added to this job')
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toastError('Could not add subcontractor', e.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Add subcontractor</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Choose a partner customer to use as a subcontractor on this job.
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <Select.Root value={customerId} onValueChange={setCustomerId}>
            <Select.Trigger placeholder="Select partner…" />
            <Select.Content style={{ zIndex: 10000 }}>
              {availablePartners.length === 0 ? (
                <Text size="2" color="gray" p="2">
                  No partners available
                </Text>
              ) : (
                availablePartners.map((p) => (
                  <Select.Item key={p.id} value={p.id}>
                    {p.name}
                  </Select.Item>
                ))
              )}
            </Select.Content>
          </Select.Root>

          <TextArea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <Flex gap="2" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!customerId || addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
