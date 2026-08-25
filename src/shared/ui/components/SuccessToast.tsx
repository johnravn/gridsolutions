import * as Toast from '@radix-ui/react-toast'
import { Text } from '@radix-ui/themes'
import { CheckCircle } from 'iconoir-react'

export function SuccessToast({
  open,
  onOpenChange,
  title,
  description,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
}) {
  return (
    <Toast.Provider duration={3000}>
      <Toast.Root
        open={open}
        onOpenChange={onOpenChange}
        className="bg-green-600 text-white rounded-md shadow-lg p-3 flex gap-2 items-start"
      >
        <CheckCircle />
        <div>
          <Toast.Title className="font-medium">{title}</Toast.Title>
          {description && (
            <Toast.Description asChild>
              <Text size="2">{description}</Text>
            </Toast.Description>
          )}
        </div>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-4 right-4 w-80 max-w-full outline-none" />
    </Toast.Provider>
  )
}
