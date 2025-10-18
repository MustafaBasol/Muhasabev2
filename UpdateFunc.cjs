const fs = require('fs');
const path = 'App.tsx';
let data = fs.readFileSync(path, 'utf8');
const start = data.indexOf('const handleAddInvoice');
const end = data.indexOf('const handleEditInvoice', start);
if (start === -1 || end === -1) {
  throw new Error('Unable to locate handleAddInvoice block');
}
const newBlock = "const handleAddInvoice = (invoiceData: any) => {\n    const id = invoiceData?.id ? String(invoiceData.id) : Date.now().toString();\n    const nextSequence = String(invoices.length + 1).padStart(3, '0');\n    const invoiceNumber = invoiceData?.invoiceNumber || INV--;\n    const normalized = {\n      ...invoiceData,\n      id,\n      invoiceNumber,\n      issueDate: invoiceData?.issueDate || new Date().toISOString().split('T')[0],\n    };\n    setInvoices(prev => {\n      const exists = prev.some(invoice => String(invoice.id) === id);\n      return exists\n        ? prev.map(invoice => (String(invoice.id) === id ? { ...invoice, ...normalized } : invoice))\n        : [...prev, normalized];\n    });\n    setSelectedInvoice(null);\n    setShowInvoiceModal(false);\n  };\n\n";
data = data.slice(0, start) + newBlock + data.slice(end);
fs.writeFileSync(path, data);
