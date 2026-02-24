// src/features/company/components/ThemePreview.tsx
import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Dialog,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  IconButton,
  Link,
  Popover,
  Progress,
  RadioGroup,
  SegmentedControl,
  Select,
  Separator,
  Spinner,
  Switch,
  Table,
  Tabs,
  Text,
  TextArea,
  TextField,
  Theme,
} from '@radix-ui/themes'
import {
  CheckCircle,
  InfoCircle,
  NavArrowDown,
  WarningTriangle,
} from 'iconoir-react'
import type {
  RadixAccentColor,
  RadixGrayColor,
  RadixPanelBackground,
  RadixRadius,
  RadixScaling,
} from '../api/queries'

interface ThemePreviewProps {
  accentColor: RadixAccentColor
  radius: RadixRadius
  grayColor: RadixGrayColor
  panelBackground: RadixPanelBackground
  scaling: RadixScaling
}

export default function ThemePreview({
  accentColor,
  radius,
  grayColor,
  panelBackground,
  scaling,
}: ThemePreviewProps) {
  const [switchChecked, setSwitchChecked] = React.useState(true)
  const [checkboxChecked, setCheckboxChecked] = React.useState(true)
  const [radioValue, setRadioValue] = React.useState('option1')
  const [selectValue, setSelectValue] = React.useState('option1')
  const [tabValue, setTabValue] = React.useState('tab1')
  const [segmentedValue, setSegmentedValue] = React.useState('option1')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [popoverOpen, setPopoverOpen] = React.useState(false)

  // Convert scaling percentage to a scale factor for CSS
  const scaleFactor = parseFloat(scaling) / 100

  return (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Flex align="center" gap="2" mb="2">
        <Heading size="3">Preview</Heading>
        <Badge size="1" color="blue" variant="soft">
          Live
        </Badge>
      </Flex>
      <Text as="div" size="1" color="gray" mb="3" style={{ fontSize: '11px' }}>
        Real-time preview of your theme
      </Text>

      {/* Preview Container with scaling */}
      <Card
        style={{
          border: '2px dashed var(--gray-a6)',
          background: 'var(--gray-a1)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box p="3" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Text
            size="1"
            color="gray"
            mb="2"
            style={{ fontStyle: 'italic', fontSize: '10px' }}
          >
            Preview Area
          </Text>
          <Separator mb="3" />
          <div
            style={{
              transform: `scale(${scaleFactor})`,
              transformOrigin: 'top left',
              width: `${100 / scaleFactor}%`,
            }}
          >
            {/* Wrap preview in Theme component to show actual theme effects */}
            <Theme
              accentColor={accentColor}
              radius={radius}
              grayColor={grayColor}
              panelBackground={panelBackground}
              scaling="100%"
            >
              <Flex direction="column" gap="4">
                {/* Typography Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Typography</Heading>
                    <Flex direction="column" gap="1">
                      <Heading size="6">Heading 6</Heading>
                      <Heading size="5">Heading 5</Heading>
                      <Heading size="4">Heading 4</Heading>
                      <Heading size="3">Heading 3</Heading>
                      <Text size="3" weight="bold">
                        Bold Text
                      </Text>
                      <Text size="2">Regular Text</Text>
                      <Text size="1" color="gray">
                        Gray Text
                      </Text>
                    </Flex>
                  </Flex>
                </Card>

                {/* Buttons Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Buttons</Heading>
                    <Flex gap="2" wrap="wrap">
                      <Button color={accentColor}>Primary</Button>
                      <Button variant="soft" color={accentColor}>
                        Soft
                      </Button>
                      <Button variant="outline" color={accentColor}>
                        Outline
                      </Button>
                      <Button variant="ghost" color={accentColor}>
                        Ghost
                      </Button>
                      <Button color={accentColor} size="1">
                        Small
                      </Button>
                      <Button color={accentColor} size="3">
                        Large
                      </Button>
                      <IconButton color={accentColor}>
                        <CheckCircle />
                      </IconButton>
                    </Flex>
                  </Flex>
                </Card>

                {/* Badges Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Badges</Heading>
                    <Flex gap="2" wrap="wrap" align="center">
                      <Badge color={accentColor}>Default</Badge>
                      <Badge color={accentColor} variant="soft">
                        Soft
                      </Badge>
                      <Badge color={accentColor} variant="outline">
                        Outline
                      </Badge>
                      <Badge color="green">Success</Badge>
                      <Badge color="red">Error</Badge>
                      <Badge color="yellow">Warning</Badge>
                    </Flex>
                  </Flex>
                </Card>

                {/* Form Controls Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Form Controls</Heading>
                    <Flex direction="column" gap="3">
                      <TextField.Root placeholder="Text input field" />
                      <TextField.Root
                        placeholder="With color"
                        color={accentColor}
                      />
                      <Select.Root
                        value={selectValue}
                        onValueChange={setSelectValue}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="option1">Option 1</Select.Item>
                          <Select.Item value="option2">Option 2</Select.Item>
                          <Select.Item value="option3">Option 3</Select.Item>
                        </Select.Content>
                      </Select.Root>
                      <Flex gap="3" align="center">
                        <Switch
                          checked={switchChecked}
                          onCheckedChange={(checked) =>
                            setSwitchChecked(checked === true)
                          }
                          color={accentColor}
                        />
                        <Text size="2">Toggle switch</Text>
                      </Flex>
                      <Flex gap="3" align="center">
                        <Checkbox
                          checked={checkboxChecked}
                          onCheckedChange={(checked) =>
                            setCheckboxChecked(checked === true)
                          }
                          color={accentColor}
                        />
                        <Text size="2">Checkbox option</Text>
                      </Flex>
                      <RadioGroup.Root
                        value={radioValue}
                        onValueChange={setRadioValue}
                      >
                        <Flex direction="column" gap="2">
                          <Text size="2" weight="medium">
                            Radio Group
                          </Text>
                          <Text as="label" size="2">
                            <Flex align="center" gap="2">
                              <RadioGroup.Item value="option1" />
                              <Text>Option 1</Text>
                            </Flex>
                          </Text>
                          <Text as="label" size="2">
                            <Flex align="center" gap="2">
                              <RadioGroup.Item value="option2" />
                              <Text>Option 2</Text>
                            </Flex>
                          </Text>
                        </Flex>
                      </RadioGroup.Root>
                    </Flex>
                  </Flex>
                </Card>

                {/* Tabs Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Tabs</Heading>
                    <Tabs.Root value={tabValue} onValueChange={setTabValue}>
                      <Tabs.List>
                        <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
                        <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
                        <Tabs.Trigger value="tab3">Tab 3</Tabs.Trigger>
                      </Tabs.List>
                      <Box pt="3">
                        <Tabs.Content value="tab1">
                          <Text size="2">Content for Tab 1</Text>
                        </Tabs.Content>
                        <Tabs.Content value="tab2">
                          <Text size="2">Content for Tab 2</Text>
                        </Tabs.Content>
                        <Tabs.Content value="tab3">
                          <Text size="2">Content for Tab 3</Text>
                        </Tabs.Content>
                      </Box>
                    </Tabs.Root>
                  </Flex>
                </Card>

                {/* Alerts/Callouts Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Alerts</Heading>
                    <Flex direction="column" gap="2">
                      <Callout.Root color={accentColor}>
                        <Callout.Icon>
                          <InfoCircle />
                        </Callout.Icon>
                        <Callout.Text>
                          This is an informational callout
                        </Callout.Text>
                      </Callout.Root>
                      <Callout.Root color="green">
                        <Callout.Icon>
                          <CheckCircle />
                        </Callout.Icon>
                        <Callout.Text>Success message</Callout.Text>
                      </Callout.Root>
                      <Callout.Root color="yellow">
                        <Callout.Icon>
                          <WarningTriangle />
                        </Callout.Icon>
                        <Callout.Text>Warning message</Callout.Text>
                      </Callout.Root>
                    </Flex>
                  </Flex>
                </Card>

                {/* Table Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Table</Heading>
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Status
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Action
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        <Table.Row>
                          <Table.RowHeaderCell>Item 1</Table.RowHeaderCell>
                          <Table.Cell>
                            <Badge color={accentColor}>Active</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <Button size="1" variant="soft">
                              Edit
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                        <Table.Row>
                          <Table.RowHeaderCell>Item 2</Table.RowHeaderCell>
                          <Table.Cell>
                            <Badge color="gray">Inactive</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <Button size="1" variant="soft">
                              Edit
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      </Table.Body>
                    </Table.Root>
                  </Flex>
                </Card>

                {/* TextArea Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Text Area</Heading>
                    <TextArea placeholder="Multi-line text input..." rows={3} />
                    <TextArea
                      placeholder="With color"
                      rows={2}
                      color={accentColor}
                    />
                  </Flex>
                </Card>

                {/* Segmented Control Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Segmented Control</Heading>
                    <SegmentedControl.Root
                      value={segmentedValue}
                      onValueChange={setSegmentedValue}
                    >
                      <SegmentedControl.Item value="option1">
                        Option 1
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="option2">
                        Option 2
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="option3">
                        Option 3
                      </SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </Flex>
                </Card>

                {/* Grid Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Grid Layout</Heading>
                    <Grid columns="3" gap="2">
                      <Box
                        p="2"
                        style={{
                          background: 'var(--gray-a2)',
                          borderRadius: 'var(--radius-2)',
                        }}
                      >
                        <Text size="1">Grid Item 1</Text>
                      </Box>
                      <Box
                        p="2"
                        style={{
                          background: 'var(--gray-a2)',
                          borderRadius: 'var(--radius-2)',
                        }}
                      >
                        <Text size="1">Grid Item 2</Text>
                      </Box>
                      <Box
                        p="2"
                        style={{
                          background: 'var(--gray-a2)',
                          borderRadius: 'var(--radius-2)',
                        }}
                      >
                        <Text size="1">Grid Item 3</Text>
                      </Box>
                    </Grid>
                  </Flex>
                </Card>

                {/* Avatars Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Avatars</Heading>
                    <Flex gap="2" align="center" wrap="wrap">
                      <Avatar
                        src=""
                        fallback="JD"
                        size="1"
                        color={accentColor}
                      />
                      <Avatar
                        src=""
                        fallback="AB"
                        size="2"
                        color={accentColor}
                      />
                      <Avatar
                        src=""
                        fallback="CD"
                        size="3"
                        color={accentColor}
                      />
                      <Avatar
                        src=""
                        fallback="EF"
                        size="4"
                        color={accentColor}
                      />
                      <Avatar
                        src=""
                        fallback="GH"
                        size="5"
                        color={accentColor}
                      />
                    </Flex>
                  </Flex>
                </Card>

                {/* Dropdown Menu Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Dropdown Menu</Heading>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <Button variant="soft" color={accentColor}>
                          Menu
                          <NavArrowDown />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item>Edit</DropdownMenu.Item>
                        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item color="red">
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Flex>
                </Card>

                {/* Dialog Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Dialog</Heading>
                    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
                      <Dialog.Trigger>
                        <Button variant="outline" color={accentColor}>
                          Open Dialog
                        </Button>
                      </Dialog.Trigger>
                      <Dialog.Content style={{ maxWidth: 450 }}>
                        <Dialog.Title>Dialog Example</Dialog.Title>
                        <Dialog.Description size="2" mb="4">
                          This is a sample dialog showing your theme settings.
                        </Dialog.Description>
                        <Flex direction="column" gap="3">
                          <TextField.Root placeholder="Name" />
                          <TextArea placeholder="Description" rows={3} />
                        </Flex>
                        <Flex gap="3" mt="4" justify="end">
                          <Dialog.Close>
                            <Button variant="soft" color="gray">
                              Cancel
                            </Button>
                          </Dialog.Close>
                          <Dialog.Close>
                            <Button color={accentColor}>Save</Button>
                          </Dialog.Close>
                        </Flex>
                      </Dialog.Content>
                    </Dialog.Root>
                  </Flex>
                </Card>

                {/* Popover Section */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Popover</Heading>
                    <Popover.Root
                      open={popoverOpen}
                      onOpenChange={setPopoverOpen}
                    >
                      <Popover.Trigger>
                        <Button variant="soft" color={accentColor}>
                          Open Popover
                        </Button>
                      </Popover.Trigger>
                      <Popover.Content style={{ width: 260 }}>
                        <Flex direction="column" gap="2">
                          <Heading size="3">Popover Title</Heading>
                          <Text size="2">
                            This is a popover component showing your theme.
                          </Text>
                          <Button size="2" color={accentColor} mt="2">
                            Action
                          </Button>
                        </Flex>
                      </Popover.Content>
                    </Popover.Root>
                  </Flex>
                </Card>

                {/* Progress & Other Components */}
                <Card>
                  <Flex direction="column" gap="3" p="3">
                    <Heading size="4">Progress & More</Heading>
                    <Flex direction="column" gap="3">
                      <Box>
                        <Text size="2" mb="1" as="div">
                          Progress Bar
                        </Text>
                        <Progress value={65} color={accentColor} />
                      </Box>
                      <Flex gap="2" align="center">
                        <Spinner size="2" />
                        <Text size="2">Loading spinner</Text>
                      </Flex>
                      <Flex gap="2" align="center">
                        <Link href="#" color={accentColor}>
                          Link example
                        </Link>
                        <Text size="2" color="gray">
                          •
                        </Text>
                        <Link href="#">Ghost link</Link>
                      </Flex>
                    </Flex>
                  </Flex>
                </Card>
              </Flex>
            </Theme>
          </div>
        </Box>
      </Card>
    </Box>
  )
}
