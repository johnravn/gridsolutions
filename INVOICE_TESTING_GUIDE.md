# Invoice Testing Guide

## Overview

This guide explains how to test invoice creation through the Conta API integration and how to use the new invoice tracking and preview features.

## Testing Approaches

### 1. **Conta Sandbox Environment (Recommended)**

The best way to test invoices is using Conta's sandbox environment:

1. **Set up Sandbox Access:**
   - Register at [https://app.conta-sandbox.no](https://app.conta-sandbox.no)
   - Contact Conta support at [email protected] to verify your account
   - Generate API keys in Settings → User account → Manage API keys

2. **Configure Your Environment:**
   - Set `VITE_CONTA_API_URL` to the sandbox API URL in your `.env` file
   - The system will automatically detect test mode and show a "🧪 TEST MODE" indicator

3. **Test Invoice Creation:**
   - Create test jobs with offers or bookings
   - Use the "Preview Invoice" button to review before creating
   - Create invoices and verify they appear in the Conta sandbox dashboard
   - Check the Invoice History section to see all created invoices

### 2. **Read-Only Mode**

The system includes a read-only mode that prevents write operations:

- Configured via database function `get_accounting_read_only()`
- When enabled, all POST/PUT/DELETE operations are blocked
- Useful for testing API connectivity without creating actual invoices

### 3. **Invoice Preview Feature**

Before creating an invoice, you can preview what will be sent:

- Click "Preview" button next to any offer
- Click "Preview Invoice" for bookings-based invoices
- Review customer, dates, line items, and totals
- Confirm before creating the actual invoice

## New Features

### Invoice Tracking

All invoices are now tracked in the `job_invoices` table with:

- **Status**: `pending`, `created`, or `failed`
- **Conta Invoice ID**: The ID returned from Conta API
- **Full Request/Response**: Complete invoice data and API response stored as JSONB
- **Error Messages**: Detailed error information if creation fails

### Invoice History

The Invoice History section shows:

- All invoices created for the job
- Creation date and time
- Invoice basis (offer or bookings)
- Status with visual indicators
- Conta Invoice ID
- Link to view invoice in Conta (if available)
- Error messages for failed invoices

### Test Mode Indicator

When connected to a sandbox/test environment:

- Yellow banner appears at the bottom of the Invoice tab
- Clearly indicates you're in test mode
- Reminds that invoices won't appear in production

### Status Indicators

- ✅ **Green**: Invoice successfully created
- ❌ **Red**: Invoice creation failed
- ⏳ **Gray**: Invoice creation pending

## Database Migration

Run the migration to enable invoice tracking:

```bash
# Apply the migration
npx supabase migration up
```

The migration creates:

- `job_invoices` table
- Indexes for efficient queries
- RLS policies for security
- Update timestamp trigger

## Best Practices

1. **Always Preview First**: Use the preview feature to verify invoice details before creating
2. **Check Invoice History**: Review created invoices to ensure they match expectations
3. **Monitor Errors**: Failed invoices show error messages in the history
4. **Test in Sandbox**: Always test in sandbox before using production API
5. **Verify in Conta**: After creating an invoice, verify it appears in your Conta dashboard

## Troubleshooting

### Invoice Creation Fails

1. Check the Invoice History for error messages
2. Verify your Conta API key is valid
3. Ensure organization ID is correctly configured
4. Check that customer exists or can be created in Conta
5. Review the full error in the browser console

### Invoice Not Appearing in Conta

1. Verify you're using the correct environment (sandbox vs production)
2. Check the Conta Invoice ID in Invoice History
3. Use the "View in Conta" link if available
4. Verify API credentials have write permissions

### Preview Not Showing

1. Ensure you have accepted offers or bookings
2. Check that customer information is available
3. Verify accounting configuration is set up

## API Response Handling

The system stores the full API response from Conta, which typically includes:

- Invoice ID
- Invoice number
- Status
- Created date
- Other metadata

This information is displayed in the Invoice History and can be used for further integration.
