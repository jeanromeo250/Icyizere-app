# Database Seeding Guide

## Quick Setup for Sample Data

This guide helps you populate your app with the same sample data shown in the screenshots (Stock, Sales, Expenses, etc.).

### Method 1: Browser Console (Quickest)

1. **Open the app in your browser** and log in
2. **Open Developer Tools** (Press `F12`)
3. **Go to Console tab**
4. **Run this command:**
   ```javascript
   seedDatabase()
   ```
5. **Wait for success message** then refresh the page (Ctrl+R or Cmd+R)

### Method 2: Add a Seed Button to Dashboard

If you want a visible button, here's how to add it:

**Edit: `src/pages/Dashboard.tsx`**

Add this import at the top:
```typescript
import { seedDatabase } from "@/lib/seedData";
```

Add this button in the Dashboard (after PageHeader):
```tsx
<div className="px-4 mt-2">
  <button
    onClick={async () => {
      const result = await seedDatabase();
      if (result) {
        window.location.reload();
      }
    }}
    className="w-full px-4 py-2 bg-blue-500 text-white rounded text-sm"
  >
    Load Sample Data
  </button>
</div>
```

### What Gets Added

The seed script adds:

**Products:**
- Rice: 800 units in stock (Category: Grains)
- Bean: 180 units in stock (Category: Legumes)

**Sales:**
- 1 sale: 99 Bean @ RWF 100 each = **RWF 9,900 total**

**Stock Movements:**
- Stock Out: 700 Bean (date: 2026-04-04)
- Stock In: 80 Bean (date: 2026-04-04, note: "note")

**Expenses:**
- None (RWF 0) - matching your screenshots

### What You'll See

After seeding, when you visit each page:

✓ **Stock Page** - Rice and Bean products in table with quantities
✓ **Sales Page** - Total Sales: RWF 9,900
✓ **Expenses Page** - Total: RWF 0
✓ **Reports Page** - Total Sales RWF 9,900, Net Profit RWF 9,900
✓ **Notifications** - Activity summary with stock and sales
✓ **Dashboard** - Recent sales and inventory overview

### Reset Data

If you want to clear and re-seed the data:

**In Browser Console:**
```javascript
toggleSeedData()
```

This will:
1. Delete all existing products, sales, stock entries, and expenses
2. Re-seed with the sample data
3. Show success message

### Troubleshooting

**"Data already exists" message?**
- This means sample data is already loaded
- Use `toggleSeedData()` to refresh it

**No data appearing after seeding?**
- Refresh the page with Ctrl+R or Cmd+R
- Check browser console for errors (F12)
- Make sure you're logged in

**Want to add more data manually?**
- Use the app's UI directly:
  - **Stock**: Use "Stock IN/OUT" buttons  
  - **Sales**: Use "Record Sale" button
  - **Products**: Add from Products page
  - **Expenses**: Use "Add Expense" button

## Updates Made to Pages

The following pages now display data in improved formats:

1. **Stock.tsx** - Added product table and stock movement history table
2. **Sales.tsx** - Added stat cards (Total Sales, Today's Revenue, Transactions)
3. **Expenses.tsx** - Added stat cards (Total Expenses, This Month, Categories)
4. **StatCard.tsx** - Enhanced with compact mode for smaller displays

All pages maintain full functionality for adding/editing/deleting entries.
