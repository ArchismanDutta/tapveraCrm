# ConfirmDialog Component

A reusable confirmation dialog component for critical actions throughout the application.

## Location

`client/src/components/common/ConfirmDialog.jsx`

## Features

- **Multiple Variants**: danger, warning, success, info
- **Loading State**: Shows spinner during async operations
- **Keyboard Support**: ESC to close, backdrop click to cancel
- **Dark Mode**: Full dark mode support
- **Animations**: Smooth fade-in and slide-up animations
- **Accessible**: Proper focus management and disabled states

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls dialog visibility |
| `onClose` | function | required | Called when dialog is closed without confirming |
| `onConfirm` | function | required | Called when user confirms the action |
| `title` | string | "Are you sure?" | Dialog title |
| `message` | string | "This action cannot be undone." | Dialog message/description |
| `confirmText` | string | "Confirm" | Text for confirm button |
| `cancelText` | string | "Cancel" | Text for cancel button |
| `variant` | string | "warning" | Dialog variant: "danger", "warning", "success", "info" |
| `loading` | boolean | false | Shows loading state on confirm button |

## Variants

### Danger
- **Use for**: Destructive actions (delete, remove, revoke)
- **Color**: Red
- **Icon**: AlertTriangle

### Warning
- **Use for**: Actions that require caution (archive, suspend, reset)
- **Color**: Yellow
- **Icon**: AlertCircle

### Success
- **Use for**: Confirmations of positive actions (approve, activate, complete)
- **Color**: Green
- **Icon**: CheckCircle

### Info
- **Use for**: Informational confirmations (proceed, continue, next)
- **Color**: Blue
- **Icon**: Info

## Usage Examples

### 1. Delete Confirmation (Danger)

```jsx
import { useState } from "react";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const MyComponent = () => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await API.delete(`/api/items/${itemId}`);
      toast.success("Item deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowDeleteDialog(true)}>
        Delete Item
      </button>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
};
```

### 2. Archive Confirmation (Warning)

```jsx
<ConfirmDialog
  isOpen={showArchiveDialog}
  onClose={() => setShowArchiveDialog(false)}
  onConfirm={handleArchive}
  title="Archive Project"
  message="Archiving this project will hide it from the active projects list. You can restore it later."
  confirmText="Archive"
  variant="warning"
  loading={archiving}
/>
```

### 3. Approval Confirmation (Success)

```jsx
<ConfirmDialog
  isOpen={showApprovalDialog}
  onClose={() => setShowApprovalDialog(false)}
  onConfirm={handleApprove}
  title="Approve Request"
  message="Are you sure you want to approve this request? The user will be notified immediately."
  confirmText="Approve"
  variant="success"
  loading={approving}
/>
```

### 4. Proceed Confirmation (Info)

```jsx
<ConfirmDialog
  isOpen={showProceedDialog}
  onClose={() => setShowProceedDialog(false)}
  onConfirm={handleProceed}
  title="Proceed to Next Step"
  message="You have unsaved changes. Do you want to proceed without saving?"
  confirmText="Proceed"
  cancelText="Go Back"
  variant="info"
/>
```

## Integration Example

The ConfirmDialog is already integrated in the **ClientRequestsPage** for deleting requests:

**File**: `client/src/pages/admin/ClientRequestsPage.jsx`

```jsx
// State management
const [deleteConfirm, setDeleteConfirm] = useState({ show: false, requestId: null });
const [deleting, setDeleting] = useState(false);

// Trigger delete
const handleDeleteClick = (requestId) => {
  setDeleteConfirm({ show: true, requestId });
};

// Confirm delete
const handleConfirmDelete = async () => {
  if (!deleteConfirm.requestId) return;

  setDeleting(true);
  try {
    await API.delete(`/api/client-requests/${deleteConfirm.requestId}`);
    toast.success("Request deleted successfully");
    fetchRequests();
    setDeleteConfirm({ show: false, requestId: null });
  } catch (error) {
    toast.error("Failed to delete request");
  } finally {
    setDeleting(false);
  }
};

// Cancel delete
const handleCancelDelete = () => {
  setDeleteConfirm({ show: false, requestId: null });
};

// Render
<ConfirmDialog
  isOpen={deleteConfirm.show}
  onClose={handleCancelDelete}
  onConfirm={handleConfirmDelete}
  title="Delete Request"
  message="Are you sure you want to delete this request? This action cannot be undone and all associated messages will be permanently deleted."
  confirmText="Delete"
  variant="danger"
  loading={deleting}
/>
```

## When to Use ConfirmDialog

### ✅ Use for:
- Deleting records
- Removing users or access
- Archiving/deactivating items
- Approving/rejecting requests
- Irreversible state changes
- Actions with significant consequences
- Proceeding despite warnings

### ❌ Don't use for:
- Simple form submissions
- Saving changes (use regular save button)
- Closing modals (use X button)
- Navigation between pages
- Non-critical confirmations

## Best Practices

1. **Clear Messaging**: Explain exactly what will happen
2. **Specific Consequences**: Mention what data will be lost or changed
3. **Appropriate Variant**: Use danger for destructive actions
4. **Loading State**: Always show loading during async operations
5. **Error Handling**: Handle errors gracefully with toast messages
6. **Consistent Wording**: Use action-specific button text (Delete, Archive, Approve)
7. **Reset State**: Clear dialog state after completion or cancellation

## Styling

The component uses Tailwind CSS with dark mode support:
- Light mode: White background, dark text
- Dark mode: Dark navy background (#1a1f2e), light text
- Smooth animations with CSS keyframes
- Backdrop blur for modal overlay
- Variant-specific colors for icons and buttons

## Accessibility

- Keyboard navigation (ESC to close)
- Click outside to close
- Disabled state during loading
- Focus management
- Clear visual feedback
- Screen reader friendly

## Future Enhancements

Potential improvements for future versions:
- Custom icons
- Custom content (React nodes)
- Multiple action buttons
- Checkbox for "Don't ask again"
- Animation customization
- Size variants (small, medium, large)
