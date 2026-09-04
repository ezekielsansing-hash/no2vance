/**
 * Facility Rental Agreement, version 1.
 *
 * Transcribed from No2Vance_Facility_Rental_Agreement_TEMPLATE.docx with the
 * legal language unchanged. Two deliberate departures from the Word document,
 * both noted in QUICKBOOKS.md:
 *
 *   1. The wet-signature block is replaced by the acceptance record — the
 *      checkbox, timestamp, IP, and typed name captured on the acceptance
 *      page. Section 18 already permits electronic delivery.
 *   2. The Credit Card Authorization page is omitted entirely. It collects a
 *      card number and CVV as free text, which must never be a field on a web
 *      page. Card-on-file belongs in QuickBooks, which vaults it properly.
 *
 * Stored as a .ts string rather than a .md file so it bundles reliably on
 * Vercel without a filesystem read or a webpack loader.
 *
 * {{placeholders}} are filled at link-generation time. Never edit this file to
 * change terms for a new booking — add v2.ts and bump CONTRACT_VERSION, so
 * every past acceptance keeps pointing at the text that was actually agreed to.
 */
export const CONTRACT_V1 = `# H. & S. Printing Co., Inc. dba No. 2 Vance
## Facility Rental Agreement

This Facility Rental Agreement (the "Agreement") is entered into between H. & S. Printing Co., Inc., a Tennessee corporation doing business as No. 2 Vance ("No. 2 Vance," "we," "us," or "our"), and the undersigned renter ("Renter" or "you"), for use of the facility located at 325 Wagner Pl., Memphis, Tennessee 38103 (the "Facility"). Your acceptance confirms that you have read, understand, and agree to all terms, rules, and facility use requirements set out below.

### 1. EVENT INFORMATION

- **Type of Event:** {{eventType}}
- **Event Date(s):** {{eventDates}}
- **Expected Attendance:** {{expectedAttendance}} (Max. Occupancy: 75)
- **Access / Setup Time:** {{accessTime}}
- **Event Start:** {{eventStart}}
- **Event End:** {{eventEnd}}
- **Contracted Exit Time (all persons and property removed):** {{exitTime}}

The rental period consists of the access time through the contracted exit time stated above. Setup, decorating, vendor load-in, tear-down, and clean-up all occur within the rental period.

### 2. RENTER INFORMATION

- **Name / Company:** {{renterName}}
- **Address:** {{renterAddress}}
- **City:** {{renterCity}}  **State:** {{renterState}}  **Zip:** {{renterZip}}
- **Phone:** {{renterPhone}}  **Cell:** {{renterCell}}
- **Contact Name:** {{contactName}}  **E-Mail:** {{renterEmail}}
- **On-Site Responsible Party (if different):** {{onSiteParty}}  **Cell:** {{onSiteCell}}

The Renter accepting below is personally responsible for performance of this Agreement. If the Renter is a company or organization, the individual accepting represents that he or she is authorized to bind it.

### 3. RENTAL RATE, DEPOSIT AND PAYMENT

**Rental Rate:** The total rental rate for the rental period stated above is {{rentalRate}}.

**Deposit:** One-half (1/2) of the total rental rate is due with this signed Agreement in order to reserve the date. The deposit is non-refundable. No date is held or reserved until both the signed Agreement and the deposit have been received. The deposit for this event is {{depositAmount}}.

**Balance:** The remaining one-half (1/2) of the total rental rate is due no later than seven (7) days before the first Event Date. If the balance is not received by that date, No. 2 Vance may cancel the reservation, release the date, and retain the deposit. Reservations made within seven (7) days of the Event Date require payment in full at signing.

**Payment Methods:** {{paymentMethods}}

**Additional Charges:** Any charges for overtime, damage, extra cleaning, or other amounts owed under this Agreement will be invoiced after the event and are due within ten (10) days of the invoice date. Amounts not paid when due accrue interest at 1.5% per month (or the maximum rate allowed by law, if lower). Returned checks and failed payments are subject to a {{returnedCheckFee}} fee.

### 4. CANCELLATION AND DATE CHANGES

**Cancellation by Renter:** Cancellation must be submitted in writing. Cancellation of this Agreement will result in forfeiture of the deposited rental fee. If the balance has already been paid at the time of cancellation, the balance will be refunded and the deposit retained.

**Date Changes:** A request to move the event to a different date is not a right and is subject to availability and our written approval. If approved, the deposit may be applied one time to a new date occurring within twelve (12) months.

**Cancellation by No. 2 Vance:** We may cancel this Agreement and retain the deposit if the balance is not timely paid, if the event as actually planned differs materially from the event described in Section 1, or if the Renter breaches any term of this Agreement.

### 5. USE OF THE FACILITY

**Permitted Use:** The Facility may be used only for the event described in Section 1 and only during the rental period. The Renter may not assign this Agreement, sublet the Facility, or allow any other party to use the Facility. Ticketed, public, or admission-charging events require our prior written approval.

**Condition:** The Renter accepts the Facility, its furnishings, and its equipment in "as-is" condition and is satisfied that it is suitable for the intended event.

**Occupancy:** Attendance may not exceed the maximum occupancy of 75 persons at any time. This limit is set by fire and safety code and will be strictly enforced.

**Overtime:** Access is limited to the contracted hours. If persons or property remain past the contracted exit time, overtime will be charged at {{overtimeRate}} per hour or any fraction of an hour.

**Supervision:** The Renter or a designated representative identified in Section 2 must be on site throughout the event, from setup through clean-up. No. 2 Vance will provide a staff member to assist with questions during setup and the event; that staff member does not manage, host, or supervise the event.

### 6. FURNISHINGS AND EQUIPMENT PROVIDED

No. 2 Vance supplies the room with eight (8) 60" round tables, eight (8) 6' rectangle tables, eight (8) 36" round tables, eight (8) bistro tables, white table linens, up to 75 chairs, and a 5-disc CD player with iPod dock. All furnishings and equipment are provided as available and in as-is condition, and remain the property of No. 2 Vance.

**Additional items included for this event (if any):** {{additionalItems}}

### 7. FOOD, BEVERAGE, VENDORS AND DELIVERIES

**Food & Beverage:** The Renter will subcontract all food, beverage, and equipment. The Renter is solely responsible for selecting, supervising, and paying all vendors, and is responsible for their acts, omissions, conduct, and compliance with this Agreement. A list of vendors and their contact information is due at least seven (7) days before the event.

**Deliveries:** Rental equipment may be delivered on the day of the event and must be removed the same day unless we have approved otherwise in writing. No. 2 Vance personnel may sign for deliveries but will not be responsible for the accuracy, condition, or completeness of any delivery.

**Personal Property:** No. 2 Vance is not responsible for loss, theft, or damage to rental equipment, gifts, personal belongings, or any other property brought onto the premises by the Renter, its guests, or its vendors. Any items left in or on the property will be held for seven (7) business days, after which they will be disposed of at the discretion of No. 2 Vance staff. Storage and removal costs are charged to the Renter.

### 8. ALCOHOLIC BEVERAGES

Alcoholic beverages are permitted only when served by a licensed and insured bartender engaged by the Renter. Self-service, guest-poured, and unattended alcohol is prohibited in all forms. The Renter and its bartender are responsible for full compliance with Tennessee law, including verifying age and refusing service to any person who is under 21 or visibly intoxicated. All bars must close at least sixty (60) minutes prior to the contracted exit time. No. 2 Vance staff may stop alcohol service or terminate the event at any time if service appears unsafe or unlawful, without refund.

### 9. CLEAN-UP AND EXIT

All food, beverages, supplies, equipment, and decorations not owned by No. 2 Vance must be removed from the premises immediately following the event. To ensure the contracted exit time, all bars and food and beverage stations must close sixty (60) minutes prior to the contracted exit time. Trash must be placed in the containers designated by staff, and the Facility must be returned in substantially the condition in which it was received.

### 10. DECORATIONS

Nothing may be attached to walls, floors, ceilings, fixtures, sprinklers, or lighting with nails, screws, staples, tacks, or any tape or adhesive that marks or removes finish. Glitter, confetti, rice, birdseed, silly string, and artificial flower petals are prohibited. Open flame is prohibited except for candles fully enclosed in glass. All decorations must be removed by the contracted exit time. Any other decorating plan requires our advance written approval.

### 11. MUSIC AND NOISE

No. 2 Vance supplies with room rental the use of a 5-disc CD player and iPod dock. Musical activities must be confined to the interior of the Facility, and audio volume must remain within reasonable levels as determined by No. 2 Vance staff. Excessive, high-decibel music or other noise causing complaints may result in a required volume reduction or termination of your event without refund.

### 12. GENERAL RULES AND REGULATIONS

**Parking:** No. 2 Vance does not provide parking. Street parking only. The Facility is located on the trolley line. No. 2 Vance is not responsible for security, and is not responsible for vehicles or their contents.

**Smoking:** The entire Facility is non-smoking, including electronic cigarettes and vaping devices.

**Animals:** No animals are allowed on the premises except working service animals.

**Prohibited:** Weapons, illegal substances, fireworks and pyrotechnics, smoke or fog machines, and open-flame cooking equipment are prohibited inside the Facility.

**Conduct:** The Renter is responsible for the conduct of all guests, invitees, vendors, and any person admitted to the Facility during the rental period, and for ensuring they follow these rules and the direction of No. 2 Vance staff.

### 13. DAMAGE AND EXTRA CLEANING

The cost of any special cleaning or of damage to the Facility, equipment, furnishings, or grounds arising out of the event will be charged to the Renter, including the full cost of repair or replacement, associated labor, and an administrative fee of fifteen percent (15%). The Renter is responsible for such costs whether caused by the Renter or by its guests, invitees, employees, agents, or vendors. These charges are not limited by the amount of any deposit or card authorization on file, and are due within ten (10) days of invoice.

### 14. ADDITIONAL REQUIREMENTS FOR THIS EVENT

The following apply only if checked below. Items left unchecked are not required for this event.

{{additionalRequirements}}

### 15. RIGHT TO ENTER, SUPERVISE AND TERMINATE

No. 2 Vance staff may enter any part of the Facility at any time during the rental period. We may terminate the event immediately, clear the Facility, and retain all amounts paid, without refund and without liability, if: the maximum occupancy is exceeded; any illegal activity occurs; alcohol is served to a minor or to a visibly intoxicated person; any person creates a threat to the safety of persons or property; the Renter, a guest, or a vendor refuses to follow the reasonable direction of staff; or the event is materially different from the event described in Section 1. Termination does not relieve the Renter of liability for damage or other amounts owed.

### 16. FORCE MAJEURE

If No. 2 Vance is unable to make the Facility available because of causes beyond its reasonable control — including fire, flood, storm, structural damage, loss of power or water, labor dispute, epidemic, or order of a governmental authority — either party may terminate this Agreement. In that event, our sole and entire obligation is to refund all amounts paid by the Renter, including the deposit, or, if both parties agree in writing, to apply those amounts to a rescheduled date subject to availability. We are not liable for any other cost, expense, or damage of any kind, including deposits or fees the Renter has paid to third parties. If the Renter is unable to hold the event for such causes, the deposit remains non-refundable, but we will work in good faith to reschedule subject to availability.

### 17. LIMITATION OF LIABILITY

To the fullest extent permitted by law, the total liability of H. & S. Printing Co., Inc. dba No. 2 Vance arising out of or relating to this Agreement or the use of the Facility, regardless of the theory of liability, shall not exceed the total rental fees actually paid by the Renter. In no event will we be liable for indirect, incidental, consequential, special, or punitive damages, for lost profits, or for the cost of substitute facilities or services.

### 18. GENERAL PROVISIONS

**Entire Agreement:** This Agreement is the entire agreement between the parties regarding the Facility and supersedes all prior discussions, quotes, and understandings. It may be amended only in a writing signed by both parties.

**Governing Law and Venue:** This Agreement is governed by the laws of the State of Tennessee. The parties consent to exclusive jurisdiction and venue in the state and federal courts located in Shelby County, Tennessee.

**Attorney's Fees:** In any action to enforce this Agreement, the prevailing party is entitled to recover its reasonable attorney's fees and costs.

**Independent Parties:** Nothing in this Agreement creates a partnership, joint venture, agency, or employment relationship between the parties.

**Severability and Waiver:** If any provision is held unenforceable, the remaining provisions remain in full force. Our failure to enforce any provision is not a waiver of that or any other provision.

**Photography:** No. 2 Vance may photograph the Facility during or after the event and use those images for promotional purposes, unless the Renter opts out: {{photographyOptOut}}

**Signatures:** This Agreement may be signed in counterparts and delivered electronically, each of which is an original.

**Survival:** Sections 13, 17, and the Hold Harmless, Indemnification and Waiver Agreement survive the expiration or termination of this Agreement.

---

## Hold Harmless, Indemnification and Waiver Agreement

**Indemnification** — The undersigned ("user"), as renter or agent for the renter of this facility, shall indemnify, defend, and hold harmless H. & S. Printing Co., Inc. dba No. 2 Vance and its officials, officers, employees, and agents from and against any and all liabilities, judgments, settlements, losses, costs, or charges (including attorney fees) incurred by H. & S. Printing Co., Inc. dba No. 2 Vance and/or any of its officials, employees, and agents as a result of any claim, demand, action, or suit relating to any bodily injury (including death), loss, or property damage caused by, arising out of, related to, or associated with this Agreement or the use of the Property — including any claim brought by or on behalf of the user's guests, invitees, employees, agents, vendors, contractors, or any other person present at the user's invitation.

**Waiver and Assumption of Risk** — The undersigned knows, understands, and acknowledges the risks and hazards associated with using the property and hereby assumes any and all such risks and hazards. The user, on behalf of itself and, to the fullest extent permitted by law, its guests, invitees, employees, agents, and vendors, irrevocably waives any and all claims against H. & S. Printing Co., Inc. dba No. 2 Vance or any of its officials, employees, and agents for any bodily injury (including death), loss, or property damage incurred as a result of using the property, and irrevocably releases and discharges H. & S. Printing Co., Inc. dba No. 2 Vance from any and all claims of liability arising out of or associated with the use of the Property.

**Property Damage** — The undersigned shall pay H. & S. Printing Co., Inc. dba No. 2 Vance for any and all physical loss or damage to the Property (including the cost to repair or replace the property) caused by, arising out of, or relating to or associated with the use of the Property by the user or by the user's members, employees, agents, guests, vendors, or invitees.

**Responsibility for Others** — The undersigned is responsible for the acts and omissions of every person admitted to the Property during the rental period, and agrees that the obligations in this Agreement apply regardless of who caused the injury, loss, or damage.
`
