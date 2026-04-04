/**
 * Quick Setup Guide
 * 
 * To populate your database with sample data matching the screenshots:
 * 
 * 1. Open your browser console (F12) or terminal
 * 2. Add this code to any page component's useEffect or button click:
 * 
 *    import { seedDatabase } from "@/lib/seedData";
 *    
 *    const result = await seedDatabase();
 *    if (result) {
 *      console.log("Database seeded successfully!");
 *      window.location.reload();
 *    }
 * 
 * 3. Or add a "Seed Data" button to your Dashboard or Settings page
 * 
 * SAMPLE DATA THAT WILL BE ADDED:
 * - Products: Rice (800 in stock), Bean (180 in stock)
 * - Sales: 1 sale of Bean (99 qty, RWF 9,900)
 * - Stock Entries: 1 stock out (700 Bean), 1 stock in (80 Bean)
 * - Expenses: None (RWF 0 as shown in screenshots)
 * 
 * WHAT IT MATCHES:
 * ✓ Stock page - shows Rice and Bean with quantities
 * ✓ Sales page - shows RWF 9,900 total  
 * ✓ Stock Movement History - shows 2 entries
 * ✓ Reports page - Total Sales RWF 9,900, Net Profit RWF 9,900
 * ✓ Notifications - Shows activity summary
 */

import { seedDatabase, toggleSeedData } from "@/lib/seedData";

export { seedDatabase, toggleSeedData };
