import pathlib
path = pathlib.Path('App.tsx')
data = path.read_text(encoding='utf8')
old_block = """  const handleAddInvoice = (invoiceData: any) => {\n    const newInvoice = {\n      id: Date.now().toString(),\n      invoiceNumber: INV-2024-,\n      ...invoiceData,\n      issueDate: new Date().toISOString().split('T')[0],\n    };\n    setInvoices(prev => [...prev, newInvoice]);\n    setShowInvoiceModal(false);\n    setSelectedInvoice(null);\n  };\n\n"""
new_block = """  const handleAddInvoice = (invoiceData: any) => {\n    const id = invoiceData?.id ? String(invoiceData.id) : Date.now().toString();\n    const nextSequence = String(invoices.length + 1).padStart(3, '0');\n    const invoiceNumber = invoiceData?.invoiceNumber || INV--;\n    const normalized = {\n      ...invoiceData,\n      id,\n      invoiceNumber,\n      issueDate: invoiceData?.issueDate || new Date().toISOString().split('T')[0],\n    };\n    setInvoices(prev => {\n      const exists = prev.some(invoice => String(invoice.id) === id);\n      return exists\n        ? prev.map(invoice => (String(invoice.id) === id ? { ...invoice, ...normalized } : invoice))\n        : [...prev, normalized];\n    });\n    setSelectedInvoice(null);\n    setShowInvoiceModal(false);\n  };\n\n"""
if old_block not in data:
    raise SystemExit('Old block missing')
path.write_text(data.replace(old_block, new_block), encoding='utf8')
