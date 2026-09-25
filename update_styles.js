const fs = require('fs');
const files = [
  'client/src/pages/Pelanggan.jsx',
  'client/src/pages/Tagihan.jsx',
  'client/src/pages/Tickets.jsx',
  'client/src/pages/WhatsAppAdmin.jsx',
  'client/src/pages/QualityCheckInput.jsx',
  'client/src/pages/Settings.jsx',
  'client/src/pages/CustomerDetail.jsx',
  'client/src/pages/Login.jsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');

  // Specific Tagihan shared class replacements (must come first)
  content = content.replace(
    /const card = 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-black\/5 dark:border-slate-800\/80 dark:bg-slate-900\/40 dark:shadow-xl dark:shadow-black\/20 dark:ring-white\/5'/g,
    "const card = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40'"
  );
  content = content.replace(
    /const thead = 'border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800\/80 dark:bg-slate-900\/60'/g,
    "const thead = 'border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-900/60'"
  );
  content = content.replace(
    /const sel = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950\/80 dark:text-slate-100'/g,
    "const sel = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'"
  );
  
  // Specific Ticket/Settings card class if they match slightly different ones
  content = content.replace(
    /const card\s*=\s*'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-black\/5 dark:border-slate-800\/80 dark:bg-slate-900\/40 dark:shadow-xl dark:ring-white\/5'/g,
    "const card   = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40'"
  );

  // Change heavy shadows to sm
  content = content.replace(/shadow-2xl/g, 'shadow-sm');
  content = content.replace(/shadow-xl/g, 'shadow-sm');
  
  // Change rounded corners
  content = content.replace(/rounded-2xl/g, 'rounded-lg');
  content = content.replace(/rounded-xl/g, 'rounded-lg');
  content = content.replace(/rounded-full/g, 'rounded-md');

  // Update table cells to be tighter
  content = content.replace(/px-4 py-4/g, 'px-3 py-3');
  content = content.replace(/px-4 py-3\.5/g, 'px-3 py-2.5');
  
  // Replace button px-4 py-2.5 with px-3 py-2
  content = content.replace(/px-4 py-2\.5/g, 'px-3 py-2');

  // Generic form fields adjustment for all instances
  content = content.replace(
    /mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2\.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950\/80 dark:text-slate-100 dark:placeholder-slate-600/g,
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-600"
  );
  
  // Modals specific replacement
  content = content.replace(
    /fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black\/40 p-4 backdrop-blur-sm dark:bg-black\/60/g,
    "fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 dark:bg-black/60"
  );
  content = content.replace(
    /fixed inset-0 z-50 flex items-center justify-center bg-black\/40 p-4 backdrop-blur-sm dark:bg-black\/60/g,
    "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60"
  );

  fs.writeFileSync(file, content, 'utf-8');
  console.log('Updated', file);
}
