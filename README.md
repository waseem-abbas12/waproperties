# PrimeNest Properties (`waproperties`) - WhatsApp AI Lead Qualification Agent

A production-grade **n8n + AI Agent** workflow designed to automate real estate inquiry qualification, property search, viewing appointment bookings, CRM updates, and instant sales team dispatch over WhatsApp.

---

## 🏗️ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    WhatsApp Cloud API / Twilio / WATI  │
                      └──────────────────┬─────────────────────┘
                                         │ Incoming Webhook
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          WhatsApp Webhook Node         │
                      └──────────────────┬─────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                [hub.mode === subscribe]       [Incoming Message]
                         │                               │
                         ▼                               ▼
              ┌─────────────────────┐       ┌────────────────────────┐
              │ Return Hub Challenge│       │ Extract Phone & Message│
              └─────────────────────┘       └────────────┬───────────┘
                                                         │
                                                         ▼
                                            ┌────────────────────────┐
                 ┌─────────────────────────►│  PrimeNest AI Agent    │◄────────────────────────┐
                 │                          │  (Tools Agent ReAct)   │                         │
                 │                          └────────────┬───────────┘                         │
                 ▼                                       │                                     ▼
      ┌─────────────────────┐                            │                          ┌─────────────────────┐
      │ Window Buffer Memory│                            │                          │  OpenAI / Gemini /  │
      │ (Session: Phone #)  │                            │                          │  Anthropic Model    │
      └─────────────────────┘                            │                          └─────────────────────┘
                                                         ▼
                 ┌────────────────────────────────────────────────────────────────────────┐
                 │                             Agent Tools                                │
                 │  1. search_properties (filters inventory by budget, type, beds, area) │
                 │  2. check_viewing_availability (validates official viewing windows)   │
                 │  3. qualify_and_book_viewing (logs lead & locks requested slots)       │
                 │  4. get_company_faq (commissions, documentation, mortgage partners)    │
                 └───────────────────────────────┬────────────────────────────────────────┘
                                                 │
                                                 ▼
                                    ┌────────────────────────┐
                                    │Format Output & Lead St.│
                                    └────────────┬───────────┘
                                                 │
                                 ┌───────────────┴───────────────┐
                                 │                               │
                       [is_qualified === true]                   │ Always
                                 │                               │
                                 ▼                               ▼
                    ┌────────────────────────┐       ┌───────────────────────┐
                    │ Save to CRM / Sheets   │       │ WhatsApp Reply Message│
                    └────────────┬───────────┘       └───────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ 🔥 Notify Sales Team   │
                    │ (WhatsApp / Slack CRM) │
                    └────────────────────────┘
```

---

## 📁 Repository Contents

| File | Purpose |
|------|---------|
| `waproperties_workflow.json` | The full **n8n Workflow JSON** ready for 1-click import into n8n. |
| `properties_dataset.json` | Verified property inventory with IDs (`PN-101` to `PN-106`), prices, and viewing slots. |
| `system_prompt.md` | The production AI system prompt with strict anti-hallucination protocols. |
| `crm_leads_schema.json` | CRM / Google Sheets schema for qualified lead tracking. |
| `simulate_test.js` | Test suite validating the workflow against customer conversation turns. |
| `generate_workflow.js` | Source generator script for the workflow JSON. |

---

## 🚀 Key Features Built

### 1. Natural Lead Qualification
Guides WhatsApp inquiries smoothly to capture:
- **Requirement:** Buy vs. Rent
- **Property Type:** House, Apartment, Commercial, Plot
- **Location:** Specific area (e.g., DHA, Gulberg, Bahria Town)
- **Bedrooms:** 1, 2, 3, 4, 5+
- **Budget:** Real estate conventions (e.g. PKR 5 Crore = 50,000,000)
- **Financing:** Self-funded vs. Bank Mortgage
- **Customer Identity:** Full name & verified WhatsApp number

### 2. Strict Anti-Hallucination Guardrails
- The AI **never** invents properties, prices, or viewing slots.
- Every property mentioned **must** originate from a real tool call to `search_properties`.
- If a property is not in the database, the agent explicitly says:
  > *"I checked our current database, and that property information isn't currently available in our active listings. However, our senior acquisitions team regularly sources exclusive off-market listings. Would you like me to register your requirements with our sales team?"*

### 3. Multi-Turn Memory Management
- Uses **Window Buffer Memory** keyed directly to the customer's phone number (`{{ $('Extract WhatsApp Message').item.json.sender_phone }}`).
- Allows customers to converse naturally across multiple days without losing context.

### 4. Automated Viewing Booking & Verification
- Validates preferred viewing times against the property's verified calendar slots (e.g., `PN-103` is available on Saturday between 11:00 AM – 5:00 PM).
- Rejects invalid viewing requests and offers open alternative slots.

### 5. Instant Sales Alert Dispatch
When a lead is qualified or a viewing is booked, an immediate notification is sent to the sales team:

```text
🔥 New Qualified Lead

Name: Ali Khan
WhatsApp: +923001234567
Requirement: Buy
Property Type: House
Bedrooms: 3
Location: DHA
Budget: PKR 50,000,000
Viewing Requested: Saturday

Matched Property: PN-103
Lead Status: Qualified
```

---

## 🛠️ Step-by-Step Setup in n8n

### Step 1: Import the Workflow
1. Open your n8n instance (Cloud or Self-hosted).
2. Go to **Workflows** → Click **Add Workflow** (or **+**).
3. Click the **⋮** menu in the top-right corner → Select **Import from File**.
4. Select `waproperties_workflow.json`.

### Step 2: Configure Credentials
1. **OpenAI / Gemini / Anthropic**:
   - Double-click the **OpenAI Chat Model** node.
   - Attach your OpenAI API credential (`gpt-4o` or `gpt-4o-mini`).
2. **WhatsApp Cloud API** (Optional for live Meta delivery):
   - Replace the final **Return WhatsApp Response** node with the **WhatsApp Node** or **HTTP Request Node** to send messages via Meta Graph API:
     ```
     POST https://graph.facebook.com/v20.0/{YOUR_PHONE_NUMBER_ID}/messages
     Authorization: Bearer {YOUR_META_PERMANENT_ACCESS_TOKEN}
     ```

### Step 3: Google Sheets / CRM Setup (Optional)
1. To record directly into Google Sheets, replace the **Save Lead to CRM / Google Sheet** node with the native **Google Sheets Node** (`Append row`).
2. Map fields according to `crm_leads_schema.json`.

---

## 🧪 Testing the Workflow Locally

You can run the built-in test suite to verify the logic:

```bash
node simulate_test.js
```

### Testing with Webhook Payloads
Send a simulated WhatsApp message using `curl` or Postman to your n8n test webhook URL:

```bash
curl -X POST http://localhost:5678/webhook-test/waproperties/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "senderPhone": "+923001234567",
    "senderName": "Ali Khan",
    "messageText": "Hi, I am looking for a 3-bedroom house in DHA with a budget of 5 crore. Can I see it this Saturday?"
  }'
```

**Expected Result:**
1. AI Agent queries `search_properties(location="DHA", bedrooms=3, max_budget=50000000)`.
2. Finds `PN-103`.
3. Verifies `Saturday` slot via `check_viewing_availability`.
4. Executes `qualify_and_book_viewing`.
5. Emits the formatted sales alert.
6. Returns an executive confirmation back to the customer on WhatsApp.
