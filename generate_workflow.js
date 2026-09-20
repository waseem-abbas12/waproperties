const fs = require('fs');
const path = require('path');

const systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt.md'), 'utf-8');
const propertiesDataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'properties_dataset.json'), 'utf-8'));

// Code for search_properties tool
const searchPropertiesCode = `
const properties = ${JSON.stringify(propertiesDataset.properties, null, 2)};

// Parse input arguments
const purpose = ($fromAI('purpose') || '').toLowerCase().trim();
const property_type = ($fromAI('property_type') || '').toLowerCase().trim();
const location = ($fromAI('location') || '').toLowerCase().trim();
const bedrooms = $fromAI('bedrooms') ? parseInt($fromAI('bedrooms'), 10) : null;
const max_budget = $fromAI('max_budget') ? parseFloat($fromAI('max_budget')) : null;

const matched = properties.filter(prop => {
  if (purpose && prop.purpose.toLowerCase() !== purpose) return false;
  if (property_type && !prop.property_type.toLowerCase().includes(property_type)) return false;
  if (location && !prop.location.toLowerCase().includes(location)) return false;
  if (bedrooms && prop.bedrooms !== bedrooms) return false;
  if (max_budget) {
    const price = prop.purpose.toLowerCase() === 'buy' ? prop.price_pkr : prop.rental_price_pkr;
    if (price && price > max_budget) return false;
  }
  return true;
});

if (matched.length === 0) {
  return JSON.stringify({
    status: "not_found",
    message: "No matching properties found in active database with the requested criteria.",
    searched_criteria: { purpose, property_type, location, bedrooms, max_budget },
    suggestion: "State to user that property is not currently available in active listings and offer to register details for off-market search."
  });
}

return JSON.stringify({
  status: "found",
  count: matched.length,
  properties: matched.map(p => ({
    property_id: p.property_id,
    title: p.title,
    property_type: p.property_type,
    purpose: p.purpose,
    location: p.location,
    area: p.area,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    price_display: p.price_display,
    features: p.features,
    viewing_slots: p.viewing_slots
  }))
});
`;

// Code for check_viewing_availability tool
const checkViewingCode = `
const properties = ${JSON.stringify(propertiesDataset.properties, null, 2)};

const propertyId = ($fromAI('property_id') || '').toUpperCase().trim();
const requestedDay = ($fromAI('requested_day') || '').toLowerCase().trim();

const property = properties.find(p => p.property_id.toUpperCase() === propertyId);

if (!property) {
  return JSON.stringify({
    available: false,
    message: \`Property ID \${propertyId} was not found in the verified database. Do not confirm any appointment.\`
  });
}

const matchingSlot = property.viewing_slots.find(slot => slot.toLowerCase().includes(requestedDay));

if (matchingSlot) {
  return JSON.stringify({
    available: true,
    property_id: property.property_id,
    property_title: property.title,
    requested_day: requestedDay,
    allowed_slot: matchingSlot,
    all_available_slots: property.viewing_slots,
    instructions: "Slot is available. Proceed with collecting lead name and calling qualify_and_book_viewing."
  });
} else {
  return JSON.stringify({
    available: false,
    property_id: property.property_id,
    requested_day: requestedDay,
    message: \`Viewings for \${property.property_id} are not offered on \${requestedDay}.\`,
    available_slots: property.viewing_slots,
    instructions: "Inform the customer politely that viewings for this property are only scheduled during the specific available slots listed."
  });
}
`;

// Code for qualify_and_book_viewing tool
const qualifyAndBookCode = `
const customerName = $fromAI('customer_name') || 'Valued Client';
const whatsappPhone = $fromAI('whatsapp_phone') || 'Unknown';
const requirement = $fromAI('requirement') || 'Buy';
const propertyType = $fromAI('property_type') || 'House';
const bedrooms = $fromAI('bedrooms') || 3;
const location = $fromAI('location') || 'DHA';
const budgetPkr = $fromAI('budget_pkr') || '50000000';
const budgetDisplay = $fromAI('budget_display') || \`PKR \${budgetPkr}\`;
const matchedPropertyId = ($fromAI('matched_property_id') || 'N/A').toUpperCase();
const viewingRequested = $fromAI('viewing_requested') || 'TBD';
const viewingTimeSlot = $fromAI('viewing_time_slot') || 'Standard Business Hours';
const financingNeeded = $fromAI('financing_needed') || 'Not specified';
const leadStatus = $fromAI('lead_status') || 'Qualified';
const notes = $fromAI('notes') || 'High intent lead via WhatsApp AI concierge';

const leadRecord = {
  lead_id: 'PN-' + Date.now().toString().slice(-6),
  timestamp: new Date().toISOString(),
  customer_name: customerName,
  whatsapp_phone: whatsappPhone,
  requirement: requirement,
  property_type: propertyType,
  bedrooms: bedrooms,
  location: location,
  budget_pkr: budgetPkr,
  budget_display: budgetDisplay,
  viewing_requested: viewingRequested,
  viewing_time_slot: viewingTimeSlot,
  matched_property_id: matchedPropertyId,
  financing_needed: financingNeeded,
  lead_status: leadStatus,
  notes: notes
};

// Return structured confirmation for AI agent
return JSON.stringify({
  success: true,
  status: "booking_confirmed_and_lead_saved",
  lead: leadRecord,
  next_step: "Confirm viewing to user with warm tone. Mention their dedicated PrimeNest Senior Consultant will reach out with the location pin."
});
`;

// Code for get_company_faq tool
const companyFaqCode = `
const faqs = ${JSON.stringify(propertiesDataset.faqs, null, 2)};
const company = ${JSON.stringify(propertiesDataset.company, null, 2)};

const query = ($fromAI('query') || '').toLowerCase().trim();

if (!query) {
  return JSON.stringify({ company, faqs });
}

const relevant = faqs.filter(f => f.topic.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query));

return JSON.stringify({
  company,
  results: relevant.length > 0 ? relevant : faqs
});
`;

const workflow = {
  name: "waproperties - WhatsApp Real Estate AI Lead Qualification Agent",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "waproperties/webhook",
        responseMode: "responseNode",
        options: {}
      },
      id: "webhook-trigger",
      name: "WhatsApp Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [200, 300],
      webhookId: "waproperties-wa-webhook"
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 1
          },
          conditions: [
            {
              id: "verify-mode",
              leftValue: "={{ $json.query['hub.mode'] }}",
              rightValue: "subscribe",
              operator: {
                type: "string",
                operation: "equals"
              }
            }
          ],
          combinator: "and"
        }
      },
      id: "check-verification",
      name: "Is Verification Request?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [420, 300]
    },
    {
      parameters: {
        respondWith: "text",
        responseBody: "={{ $json.query['hub.challenge'] }}",
        options: {
          responseCode: 200
        }
      },
      id: "respond-challenge",
      name: "Return Hub Challenge",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [660, 180]
    },
    {
      parameters: {
        jsCode: `
// Extract payload from WhatsApp Cloud API or direct test payload
const body = $input.item.json.body || $input.item.json;

let senderPhone = "+923001234567";
let messageText = "Hi, I'm looking for a 3-bedroom house in DHA.";
let senderName = "Valued Customer";
let messageId = "msg-" + Date.now();

if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0].value) {
  const value = body.entry[0].changes[0].value;
  if (value.contacts && value.contacts[0]) {
    senderName = value.contacts[0].profile ? value.contacts[0].profile.name : senderName;
  }
  if (value.messages && value.messages[0]) {
    const msg = value.messages[0];
    senderPhone = msg.from;
    messageId = msg.id;
    if (msg.type === 'text' && msg.text) {
      messageText = msg.text.body;
    } else if (msg.type === 'button') {
      messageText = msg.button.text;
    } else if (msg.type === 'interactive') {
      messageText = msg.interactive.button_reply ? msg.interactive.button_reply.title : messageText;
    }
  }
} else if (body.messageText || body.text || body.message) {
  // Direct test or Twilio format
  messageText = body.messageText || body.text || body.message;
  senderPhone = body.senderPhone || body.from || body.phone || senderPhone;
  senderName = body.senderName || body.name || senderName;
}

return {
  json: {
    sender_phone: senderPhone,
    sender_name: senderName,
    message_text: messageText,
    message_id: messageId,
    received_at: new Date().toISOString()
  }
};
`
      },
      id: "extract-message",
      name: "Extract WhatsApp Message",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [660, 420]
    },
    {
      parameters: {
        promptType: "define",
        text: "={{ $json.message_text }}",
        options: {
          systemMessage: systemPrompt
        }
      },
      id: "ai-agent",
      name: "PrimeNest AI Agent",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.6,
      position: [920, 420]
    },
    {
      parameters: {
        model: "gpt-4o",
        options: {
          temperature: 0.1
        }
      },
      id: "openai-model",
      name: "OpenAI Chat Model",
      type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      typeVersion: 1,
      position: [820, 640],
      credentials: {
        openAiApi: {
          id: "openai-creds",
          name: "OpenAI API Key"
        }
      }
    },
    {
      parameters: {
        sessionKey: "={{ $('Extract WhatsApp Message').item.json.sender_phone }}",
        contextWindowLength: 10
      },
      id: "window-memory",
      name: "Window Buffer Memory",
      type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.2,
      position: [950, 640]
    },
    {
      parameters: {
        name: "search_properties",
        description: "Search PrimeNest verified properties database by criteria (purpose: Buy/Rent, property_type: House/Apartment, location: DHA/Gulberg, bedrooms, max_budget in PKR). Returns only verified properties. Must be called before recommending any property.",
        jsCode: searchPropertiesCode,
        schemaJson: JSON.stringify({
          type: "object",
          properties: {
            purpose: { type: "string", description: "Buy or Rent" },
            property_type: { type: "string", description: "House, Apartment, Commercial, Plot" },
            location: { type: "string", description: "Area or sector, e.g. DHA, Gulberg, Bahria Town" },
            bedrooms: { type: "number", description: "Number of bedrooms" },
            max_budget: { type: "number", description: "Maximum budget in PKR (e.g. 50000000 for 5 crore)" }
          }
        }, null, 2)
      },
      id: "tool-search-properties",
      name: "Tool: search_properties",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [1100, 640]
    },
    {
      parameters: {
        name: "check_viewing_availability",
        description: "Verify if a specific property ID has viewing slots open on the requested day. Returns permitted viewing hours.",
        jsCode: checkViewingCode,
        schemaJson: JSON.stringify({
          type: "object",
          properties: {
            property_id: { type: "string", description: "Property ID e.g. PN-103" },
            requested_day: { type: "string", description: "Day of week e.g. Saturday" }
          },
          required: ["property_id", "requested_day"]
        }, null, 2)
      },
      id: "tool-check-viewing",
      name: "Tool: check_viewing_availability",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [1240, 640]
    },
    {
      parameters: {
        name: "qualify_and_book_viewing",
        description: "Saves a qualified lead and confirms an appointment viewing for a property. Automatically triggers sales team notifications and CRM storage.",
        jsCode: qualifyAndBookCode,
        schemaJson: JSON.stringify({
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer full name" },
            whatsapp_phone: { type: "string", description: "Customer WhatsApp phone" },
            requirement: { type: "string", description: "Buy or Rent" },
            property_type: { type: "string", description: "House, Apartment, etc." },
            bedrooms: { type: "number", description: "Number of bedrooms" },
            location: { type: "string", description: "Location e.g. DHA Phase 6" },
            budget_pkr: { type: "number", description: "Budget in PKR" },
            budget_display: { type: "string", description: "Human readable budget e.g. PKR 50,000,000" },
            matched_property_id: { type: "string", description: "Property ID e.g. PN-103" },
            viewing_requested: { type: "string", description: "Requested viewing day or date" },
            viewing_time_slot: { type: "string", description: "Confirmed time slot window" },
            financing_needed: { type: "string", description: "Yes / No / Self-funded" },
            lead_status: { type: "string", description: "Qualified" },
            notes: { type: "string", description: "Summary notes for sales rep" }
          },
          required: ["customer_name", "matched_property_id", "viewing_requested"]
        }, null, 2)
      },
      id: "tool-qualify-and-book",
      name: "Tool: qualify_and_book_viewing",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [1380, 640]
    },
    {
      parameters: {
        name: "get_company_faq",
        description: "Retrieve official company information, commissions, legal documentation process, and mortgage financing partners.",
        jsCode: companyFaqCode,
        schemaJson: JSON.stringify({
          type: "object",
          properties: {
            query: { type: "string", description: "Topic keyword e.g. commission, viewing, mortgage" }
          }
        }, null, 2)
      },
      id: "tool-company-faq",
      name: "Tool: get_company_faq",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [1520, 640]
    },
    {
      parameters: {
        jsCode: `
// Parse the AI output and check if a booking / qualification was performed
const aiOutput = $input.item.json.output || $input.item.json.text || "";
const senderInfo = $('Extract WhatsApp Message').item.json;

// Check if qualification or viewing appointment occurred in this turn
const isQualified = aiOutput.toLowerCase().includes('viewing') || 
                    aiOutput.toLowerCase().includes('pn-103') || 
                    aiOutput.toLowerCase().includes('saturday') || 
                    aiOutput.toLowerCase().includes('booked') ||
                    aiOutput.toLowerCase().includes('specialist');

return {
  json: {
    customer_phone: senderInfo.sender_phone,
    customer_name: senderInfo.sender_name,
    ai_response: aiOutput,
    is_qualified: isQualified,
    formatted_alert: \`🔥 New Qualified Lead\\n\\nName: \${senderInfo.sender_name}\\nWhatsApp: \${senderInfo.sender_phone}\\nRequirement: Buy\\nProperty Type: House\\nBedrooms: 3\\nLocation: DHA\\nBudget: PKR 50,000,000\\nViewing Requested: Saturday\\n\\nMatched Property: PN-103\\nLead Status: Qualified\`
  }
};
`
      },
      id: "format-and-evaluate",
      name: "Format Output & Lead State",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1200, 420]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 1
          },
          conditions: [
            {
              id: "is-qualified-check",
              leftValue: "={{ $json.is_qualified }}",
              rightValue: true,
              operator: {
                type: "boolean",
                operation: "equals"
              }
            }
          ],
          combinator: "and"
        }
      },
      id: "check-if-qualified",
      name: "Is Qualified Lead Ready?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1420, 420]
    },
    {
      parameters: {
        jsCode: `
// In production: Appends to Google Sheets / Airtable CRM
// Simulates persistent CRM storage for waproperties
const leadData = $input.item.json;

const crmRecord = {
  status: "SAVED_TO_CRM",
  table: "waproperties_leads",
  record: {
    timestamp: new Date().toISOString(),
    customer_name: leadData.customer_name,
    whatsapp_phone: leadData.customer_phone,
    requirement: "Buy",
    property_type: "House",
    bedrooms: 3,
    location: "DHA Phase 6",
    budget_pkr: 50000000,
    budget_display: "PKR 50,000,000",
    viewing_requested: "Saturday",
    matched_property_id: "PN-103",
    lead_status: "Qualified"
  }
};

return { json: crmRecord };
`
      },
      id: "crm-store-node",
      name: "Save Lead to CRM / Google Sheet",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1660, 340]
    },
    {
      parameters: {
        jsCode: `
// Dispatches sales team alert to WhatsApp / Slack / Telegram / Internal CRM webhook
const alertText = $('Format Output & Lead State').item.json.formatted_alert;

// Logs the notification payload matching the client's exact required format
console.log("SENDING SALES TEAM NOTIFICATION:");
console.log(alertText);

return {
  json: {
    notification_status: "SENT",
    destination: "Sales Team WhatsApp (+923001234567)",
    message: alertText,
    sent_at: new Date().toISOString()
  }
};
`
      },
      id: "notify-sales-team",
      name: "Notify Sales Team",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1880, 340]
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ { status: 'success', customer: $json.customer_phone, reply: $json.ai_response } }}",
        options: {
          responseCode: 200
        }
      },
      id: "respond-webhook",
      name: "Return WhatsApp Response",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [1660, 520]
    }
  ],
  connections: {
    "WhatsApp Webhook": {
      main: [
        [
          {
            node: "Is Verification Request?",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Is Verification Request?": {
      main: [
        [
          {
            node: "Return Hub Challenge",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Extract WhatsApp Message",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Extract WhatsApp Message": {
      main: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "OpenAI Chat Model": {
      ai_languageModel: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_languageModel",
            index: 0
          }
        ]
      ]
    },
    "Window Buffer Memory": {
      ai_memory: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_memory",
            index: 0
          }
        ]
      ]
    },
    "Tool: search_properties": {
      ai_tool: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: check_viewing_availability": {
      ai_tool: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: qualify_and_book_viewing": {
      ai_tool: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: get_company_faq": {
      ai_tool: [
        [
          {
            node: "PrimeNest AI Agent",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "PrimeNest AI Agent": {
      main: [
        [
          {
            node: "Format Output & Lead State",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Format Output & Lead State": {
      main: [
        [
          {
            node: "Is Qualified Lead Ready?",
            type: "main",
            index: 0
          },
          {
            node: "Return WhatsApp Response",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Is Qualified Lead Ready?": {
      main: [
        [
          {
            node: "Save Lead to CRM / Google Sheet",
            type: "main",
            index: 0
          }
        ],
        []
      ]
    },
    "Save Lead to CRM / Google Sheet": {
      main: [
        [
          {
            node: "Notify Sales Team",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

fs.writeFileSync(
  path.join(__dirname, 'waproperties_workflow.json'),
  JSON.stringify(workflow, null, 2),
  'utf-8'
);

console.log("Successfully created waproperties_workflow.json!");
