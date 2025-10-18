const fs = require('fs');
const path = 'App.tsx';
let data = fs.readFileSync(path, 'utf8');
const target = "  const handleAddInvoice = (invoiceData: any) => {\n    const newInvoice = {\n      id: Date.now().toString(),\n      invoiceNumber: INV-2024-,\n      ...invoiceData,\n      issueDate: new Date().toISOString().split('T')[0],\n    };\n    setInvoices(prev => [...prev, newInvoice]);\n    setShowInvoiceModal(false);\n    setSelectedInvoice(null);\n  };\n\n";
const replacement = "  const handleAddInvoice = (invoiceData: any) => {\n    const id = invoiceData?.id ? String(invoiceData.id) : Date.now().toString();\n    const nextSequence = String(invoices.length + 1).padStart(3, '0');\n    const invoiceNumber = invoiceData?.invoiceNumber || INV--;\n    const normalized = {\n      ...invoiceData,\n      id,\n      invoiceNumber,\n      issueDate: invoiceData?.issueDate || new Date().toISOString().split('T')[0],\n    };\n    setInvoices(prev => {\n      const exists = prev.some(invoice => String(invoice.id) === id);\n      return exists\n        ? prev.map(invoice => (String(invoice.id) === id ? { ...invoice, ...normalized } : invoice))\n        : [...prev, normalized];\n    });\n    setSelectedInvoice(null);\n    setShowInvoiceModal(false);\n  };\n\n";
if (!data.includes(target)) {
  throw new Error('handleAddInvoice block not found');
}
data = data.replace(target, replacement);
fs.writeFileSync(path, data);
