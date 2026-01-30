# Nested Groups and Bundles - Database Schema Changes

## Overview

This document describes the database schema changes made to support:

1. **Groups and Bundles**: Distinguishing between regular groups and bundles
2. **Nested Groups**: Groups that can contain other groups (hierarchical structure)
3. **Mixed Content**: Groups that can contain both items and other groups

## Migration File

`supabase/migrations/20251217195358_add_nested_groups_and_bundles.sql`

## Key Changes

### 1. Group Type Enum

Added a new enum type `group_type` with two values:

- `'group'`: Regular groups
- `'bundle'`: Bundles (can be used for different pricing/booking behavior)

**Table**: `item_groups`

- New column: `group_type group_type NOT NULL DEFAULT 'group'`
- Existing records default to `'group'`

### 2. Modified `group_items` Table

The `group_items` table now supports both items and nested groups:

**New Structure**:

- `item_id` (uuid, nullable): Reference to an item (existing behavior)
- `child_group_id` (uuid, nullable): Reference to a nested group (new)
- `quantity` (integer, NOT NULL): Quantity of the item or group

**Constraints**:

- **Exactly one must be set**: `group_items_item_or_group_check` ensures either `item_id` OR `child_group_id` is set, but not both
- **No direct self-reference**: `group_items_no_self_reference_check` prevents a group from directly containing itself
- **Circular reference prevention**: Trigger `group_items_prevent_circular_reference` prevents indirect circular references (e.g., Group A contains Group B, Group B contains Group A)

### 3. Circular Reference Prevention

**Function**: `check_circular_group_reference(parent_group_id, child_group_id)`

- Traverses up the parent chain from the child group
- Detects if adding the child would create a cycle
- Returns `true` if safe, `false` if circular

**Trigger**: `group_items_prevent_circular_reference`

- Automatically runs before INSERT/UPDATE on `group_items`
- Only checks when `child_group_id` is set
- Raises an exception if a circular reference is detected

### 4. Updated Views

#### `group_on_hand`

- Now uses recursive CTE to flatten nested group hierarchies
- Calculates `on_hand` by traversing through nested groups to find actual items
- Multiplies quantities through the hierarchy (e.g., if Group A contains 2x Group B, and Group B contains 3x Item X, then Group A effectively contains 6x Item X)

#### `group_parts`

- Shows both items and nested groups as "parts"
- New column: `part_type` ('item' or 'group')
- New columns: `child_group_id` (for nested groups)
- `item_id` is now nullable (only set for items)

#### `groups_with_rollups`

- Updated to handle nested groups in price calculations
- Recursively calculates `parts_value` through nested hierarchies
- Multiplies prices and quantities correctly through multiple levels

## Usage Examples

### Creating a Bundle

```sql
INSERT INTO item_groups (company_id, name, group_type)
VALUES ('company-uuid', 'Premium Package', 'bundle');
```

### Creating a Nested Group

```sql
-- Create parent group
INSERT INTO item_groups (company_id, name) VALUES ('company-uuid', 'Complete Setup');

-- Create child group
INSERT INTO item_groups (company_id, name) VALUES ('company-uuid', 'Audio Equipment');

-- Add child group to parent (nested)
INSERT INTO group_items (group_id, child_group_id, quantity)
VALUES ('parent-group-uuid', 'child-group-uuid', 1);

-- Add items to child group
INSERT INTO group_items (group_id, item_id, quantity)
VALUES ('child-group-uuid', 'item-uuid', 2);
```

### Mixed Content (Items + Groups)

```sql
-- Add an item to a group
INSERT INTO group_items (group_id, item_id, quantity)
VALUES ('group-uuid', 'item-uuid', 1);

-- Add a nested group to the same group
INSERT INTO group_items (group_id, child_group_id, quantity)
VALUES ('group-uuid', 'nested-group-uuid', 1);
```

## Breaking Changes

⚠️ **Important**: The `group_items.item_id` column is now nullable. Code that assumes `item_id` is always set needs to be updated to check for both `item_id` and `child_group_id`.

## Code Updates Required

1. **TypeScript Types**: Update `database.types.ts` after running migration
2. **API Queries**: Update queries that use `group_items` to handle both `item_id` and `child_group_id`
3. **UI Components**: Update group/item pickers to allow selecting groups as well as items
4. **Forms**: Update `AddGroupDialog` to support adding nested groups

## Testing Checklist

- [ ] Create a group containing items (existing functionality)
- [ ] Create a group containing another group (nested)
- [ ] Create a group containing both items and groups (mixed)
- [ ] Verify circular reference prevention works
- [ ] Verify `on_hand` calculation works for nested groups
- [ ] Verify price calculations work for nested groups
- [ ] Test with bundles vs groups
- [ ] Verify RLS policies still work correctly

## Migration Steps

1. **Test locally**: `npm run db:reset` to apply migration locally
2. **Update types**: `npm run db:types:remote` after testing
3. **Push to production**: `npm run db:push` when ready
4. **Update application code**: Modify queries and components to support new structure
