let leads = [
  {
    lead_id: "LEAD-103",
    timestamp: new Date().toISOString(),
    customer_name: "Ali Khan",
    whatsapp_phone: "+923001234567",
    requirement: "Buy",
    property_type: "House",
    bedrooms: 3,
    location: "DHA Phase 6",
    budget_pkr: 50000000,
    budget_display: "PKR 50,000,000",
    matched_property_id: "PN-103",
    viewing_requested: "Saturday",
    viewing_time_slot: "Saturday 11:00 AM - 5:00 PM",
    lead_status: "Qualified"
  }
];

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const newLead = req.body;
    if (newLead) {
      newLead.lead_id = 'LEAD-' + Math.floor(100 + Math.random() * 900);
      newLead.timestamp = new Date().toISOString();
      leads.unshift(newLead);
    }
    return res.status(201).json({ success: true, lead: newLead });
  }

  return res.status(200).json({ success: true, leads });
};
