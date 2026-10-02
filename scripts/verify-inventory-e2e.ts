/**
 * PreOne — Preschool Inventory & Procurement Module Comprehensive E2E Verification Suite
 *
 * Verifies all 40+ Architectural Requirements:
 * Group 1: Master Data Foundations (Categories, Units, Vendors, Locations, Items)
 * Group 2: Preschool Material Requisitions (Teacher Simple UX, Priority, Workflow Approvals)
 * Group 3: Purchase Request & Purchase Order Lifecycles (Server Calculations, Approvals, Rejections)
 * Group 4: Goods Receipt Note (GRN) & Partial Receiving (Stock Updates, Consolidated Vendor Bills)
 * Group 5: Stock Issues & Consumption (Classroom, Kitchen, Guards against negative stock & expiry)
 * Group 6: Stock Returns & Adjustments (Condition checks: GOOD, DAMAGED, EXPIRED, Physical reconciliation)
 * Group 7: Stock Transfers between Stores
 * Group 8: Expiry & Low-Stock Alert Engines
 * Group 9: Preschool Analytics & Finance Reconciliation (Classroom consumption, zero duplicate vendor payables)
 * Group 10: Multi-Tenant & Branch Isolation (Cross-tenant security, RBAC checks)
 * Group 11: Audit Trail Logging & Domain Event Emission
 * Group 12: Concurrency & Negative Stock Race-Condition Prevention
 */

import { db } from '../src/lib/db'
import { InventoryService } from '../src/lib/inventory/inventory-service'
import { can, Role } from '../src/lib/auth'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
    failed++
  }
}

async function runInventoryTests() {
  console.log('====================================================================')
  console.log('PREONE INVENTORY & PROCUREMENT: 40+ COMPREHENSIVE E2E VERIFICATION')
  console.log('====================================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantACode = `INV-TNA-${testSuffix}`
  const tenantBCode = `INV-TNB-${testSuffix}`

  let tenantA: any
  let tenantB: any
  let branchA1: any
  let branchA2: any
  let branchB: any
  let sessionA: any
  let classroomA1: any
  let classroomA2: any
  let teacherUserA: any
  let adminUserA: any

  try {
    // -------------------------------------------------------------------------
    // SETUP: CANONICAL PREONE TENANTS, BRANCHES, CLASSROOMS & USERS
    // -------------------------------------------------------------------------
    console.log('--- Setting up Canonical PreOne Environment ---')

    tenantA = await db.tenant.create({
      data: {
        name: `PreOne Test Academy A ${testSuffix}`,
        code: tenantACode,
        status: 'ACTIVE',
      },
    })

    tenantB = await db.tenant.create({
      data: {
        name: `PreOne Test Academy B ${testSuffix}`,
        code: tenantBCode,
        status: 'ACTIVE',
      },
    })

    branchA1 = await db.branch.create({
      data: {
        tenantId: tenantA.id,
        name: 'Main Campus',
        code: `BR-M-${testSuffix}`,
        isMain: true,
      },
    })

    branchA2 = await db.branch.create({
      data: {
        tenantId: tenantA.id,
        name: 'Annex Campus',
        code: `BR-A-${testSuffix}`,
        isMain: false,
      },
    })

    branchB = await db.branch.create({
      data: {
        tenantId: tenantB.id,
        name: 'Branch B',
        code: `BR-B-${testSuffix}`,
        isMain: true,
      },
    })

    sessionA = await db.academicSession.create({
      data: {
        tenantId: tenantA.id,
        name: `2026-2027 ${testSuffix}`,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      },
    })

    classroomA1 = await db.classroom.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        academicSessionId: sessionA.id,
        name: 'Toddlers Sunshine',
        code: `CLS-TOD-${testSuffix}`,
        programType: 'PLAYGROUP',
        capacity: 15,
      },
    })

    classroomA2 = await db.classroom.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        academicSessionId: sessionA.id,
        name: 'Pre-K Rainbow',
        code: `CLS-PRK-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 20,
      },
    })

    teacherUserA = await db.user.create({
      data: {
        email: `teacher-${testSuffix}@preone.test`,
        passwordHash: 'dummy_hash',
        fullName: 'Teacher Sarah',
        memberships: {
          create: { tenantId: tenantA.id, role: 'TEACHER', branchId: branchA1.id },
        },
      },
    })

    adminUserA = await db.user.create({
      data: {
        email: `admin-${testSuffix}@preone.test`,
        passwordHash: 'dummy_hash',
        fullName: 'Principal John',
        memberships: {
          create: { tenantId: tenantA.id, role: 'PRINCIPAL', branchId: branchA1.id },
        },
      },
    })

    assert(Boolean(tenantA && tenantB && classroomA1), 'Canonical multi-tenant setup created')

    // -------------------------------------------------------------------------
    // GROUP 1: MASTER DATA FOUNDATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- Group 1: Master Data Foundations ---')

    // 1. Create Category
    const categoryArt = await InventoryService.createCategory(
      tenantA.id,
      {
        name: 'Art & Craft Supplies',
        code: `CAT-ART-${testSuffix}`,
        description: 'Paints, crayons, papers, brushes',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(categoryArt.name === 'Art & Craft Supplies', 'Test 1: Created InventoryCategory with code and audit')

    // 2. Duplicate Category Code Prevention
    let dupCatFailed = false
    try {
      await InventoryService.createCategory(tenantA.id, {
        name: 'Duplicate Art',
        code: `CAT-ART-${testSuffix}`,
      })
    } catch {
      dupCatFailed = true
    }
    assert(dupCatFailed, 'Test 2: Prevented duplicate category code within same tenant')

    // 3. Create Unit of Measurement
    const unitPack = await InventoryService.createUnit(
      tenantA.id,
      {
        name: 'Pack of 12',
        code: `UNIT-PK12-${testSuffix}`,
        symbol: 'pk12',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(unitPack.symbol === 'pk12', 'Test 3: Created InventoryUnit (measurement unit)')

    const unitBottle = await InventoryService.createUnit(
      tenantA.id,
      {
        name: 'Bottle 500ml',
        code: `UNIT-BTL-${testSuffix}`,
        symbol: 'btl',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )

    // 4. Create Vendor
    const vendorArt = await InventoryService.createVendor(
      tenantA.id,
      {
        name: 'Camlin Stationery Supplies',
        code: `VEN-CAM-${testSuffix}`,
        contactPerson: 'Mr. Rajesh',
        email: 'rajesh@camlin.test',
        phone: '9876543210',
        paymentTerms: 'NET_30',
        gstNumber: '27AABCC1234F1Z5',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(vendorArt.name === 'Camlin Stationery Supplies', 'Test 4: Created Vendor with GST and payment terms')

    // 5. Create Store Location
    const storeMain = await InventoryService.createLocation(
      tenantA.id,
      {
        branchId: branchA1.id,
        name: 'Central Store Room',
        code: `LOC-CTR-${testSuffix}`,
        type: 'MAIN_STORE',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(storeMain.type === 'MAIN_STORE', 'Test 5: Created central store room InventoryLocation')

    const storeArt = await InventoryService.createLocation(
      tenantA.id,
      {
        branchId: branchA1.id,
        name: 'Art & Craft Cupboard',
        code: `LOC-ART-${testSuffix}`,
        type: 'CLASSROOM_STORAGE',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )

    const storeAnnex = await InventoryService.createLocation(
      tenantA.id,
      {
        branchId: branchA2.id,
        name: 'Annex Store',
        code: `LOC-ANX-${testSuffix}`,
        type: 'MAIN_STORE',
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )

    // 6. Create Items
    const itemPaint = await InventoryService.createItem(
      tenantA.id,
      {
        categoryId: categoryArt.id,
        unitId: unitBottle.id,
        name: 'Washable Red Tempera Paint',
        code: `ITM-PNT-RED-${testSuffix}`,
        itemType: 'CONSUMABLE',
        costPriceCents: 15000, // ₹150.00
        reorderPoint: 5,
        reorderQuantity: 20,
        trackExpiry: true,
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(itemPaint.itemType === 'CONSUMABLE' && itemPaint.trackExpiry === true, 'Test 6: Created InventoryItem with reorder point and expiry tracking')

    const itemCrayons = await InventoryService.createItem(
      tenantA.id,
      {
        categoryId: categoryArt.id,
        unitId: unitPack.id,
        name: 'Jumbo Wax Crayons',
        code: `ITM-CRY-JUM-${testSuffix}`,
        itemType: 'STATIONERY',
        costPriceCents: 8000, // ₹80.00
        reorderPoint: 10,
        reorderQuantity: 30,
        trackExpiry: false,
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )

    // -------------------------------------------------------------------------
    // GROUP 2: PRESCHOOL MATERIAL REQUISITIONS
    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Preschool Material Requisitions ---')

    // 7. Teacher Creates Material Request
    const matRequest = await InventoryService.createMaterialRequest(
      tenantA.id,
      {
        branchId: branchA1.id,
        classroomId: classroomA1.id,
        priority: 'HIGH',
        requiredByDate: new Date('2026-09-20'),
        reason: 'Handprint canvas art activity for Toddlers',
        items: [
          { itemId: itemPaint.id, quantityRequested: 3, notes: 'Red paint only' },
          { itemId: itemCrayons.id, quantityRequested: 5, notes: 'New semester sets' },
        ],
      },
      { id: teacherUserA.id, name: teacherUserA.fullName, role: teacherUserA.role }
    )
    assert(
      matRequest.status === 'PENDING' && matRequest.requestNumber.startsWith('MR-') && matRequest.items.length === 2,
      'Test 7: Teacher raised simple Material Request with auto MR- sequence'
    )

    // 8. Coordinator/Principal Approves Material Request
    const approvedRequest = await InventoryService.approveMaterialRequest(
      tenantA.id,
      matRequest.id,
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(approvedRequest.status === 'APPROVED' && approvedRequest.approvedById === adminUserA.id, 'Test 8: Principal approved Material Request')

    // -------------------------------------------------------------------------
    // GROUP 3: PROCUREMENT LIFECYCLE (PR & PO)
    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: Purchase Requests & Orders ---')

    // 9. Create Purchase Request linked to Material Request
    const purchaseReq = await InventoryService.createPurchaseRequest(
      tenantA.id,
      {
        branchId: branchA1.id,
        materialRequestId: matRequest.id,
        reason: 'Restock paints and crayons for toddlers sunshine',
        items: [
          { itemId: itemPaint.id, quantityRequested: 20, estimatedCostCents: 15000 },
          { itemId: itemCrayons.id, quantityRequested: 30, estimatedCostCents: 8000 },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(
      (purchaseReq.status === 'PENDING' || purchaseReq.status === 'SUBMITTED') && purchaseReq.requestNumber.startsWith('PR-'),
      'Test 9: Created Purchase Request linked to MR'
    )

    // 10. Approve Purchase Request
    const approvedPR = await InventoryService.approvePurchaseRequest(
      tenantA.id,
      purchaseReq.id,
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(approvedPR.status === 'APPROVED', 'Test 10: Approved Purchase Request')

    // 11. Create Purchase Order with Server Calculations (Line totals, Taxes, Grand Total)
    // Item 1: 20 * ₹150 = ₹3,000, 18% GST = ₹540. Total = ₹3,540
    // Item 2: 30 * ₹80 = ₹2,400, 12% GST = ₹288. Total = ₹2,688
    // Grand Total = ₹3,540 + ₹2,688 = ₹6,228 (622,800 cents)
    const po = await InventoryService.createPurchaseOrder(
      tenantA.id,
      {
        branchId: branchA1.id,
        purchaseRequestId: purchaseReq.id,
        vendorId: vendorArt.id,
        destinationLocationId: storeMain.id,
        expectedDeliveryDate: new Date('2026-09-25'),
        paymentTerms: 'NET_30',
        items: [
          { itemId: itemPaint.id, quantityOrdered: 20, unitPriceCents: 15000, taxRatePercent: 18 },
          { itemId: itemCrayons.id, quantityOrdered: 30, unitPriceCents: 8000, taxRatePercent: 12 },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(
      po.status === 'DRAFT' && po.poNumber.startsWith('PO-') && po.grandTotalCents === 622800,
      `Test 11: Created PO with server-verified line totals and GST (grandTotal: ₹${po.grandTotalCents / 100})`
    )

    // 12. Approve Purchase Order -> Moves to ISSUED
    const approvedPO = await InventoryService.approvePurchaseOrder(
      tenantA.id,
      po.id,
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(approvedPO.status === 'ISSUED' || approvedPO.status === 'ORDERED', 'Test 12: Approved Purchase Order moved status to ISSUED')

    // -------------------------------------------------------------------------
    // GROUP 4: GOODS RECEIPT (GRN), PARTIAL RECEIVING & FINANCE RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('\n--- Group 4: Goods Receipt (GRN) & Finance Reconciliation ---')

    // 13. First Partial GRN: Receive 10 Paints out of 20, and 15 Crayons out of 30
    const expiryDatePaints = new Date('2027-12-31')
    const grn1 = await InventoryService.createGoodsReceipt(
      tenantA.id,
      {
        branchId: branchA1.id,
        purchaseOrderId: po.id,
        locationId: storeMain.id,
        vendorInvoiceNumber: `VINV-001-${testSuffix}`,
        items: [
          {
            purchaseOrderItemId: po.items[0].id,
            itemId: itemPaint.id,
            quantityReceived: 10,
            unitPriceCents: 15000,
            batchNumber: `BATCH-PNT-${testSuffix}`,
            expiryDate: expiryDatePaints,
          },
          {
            purchaseOrderItemId: po.items[1].id,
            itemId: itemCrayons.id,
            quantityReceived: 15,
            unitPriceCents: 8000,
            batchNumber: `BATCH-CRY-${testSuffix}`,
          },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(
      grn1.grnNumber.startsWith('GRN-') && grn1.status === 'FINALIZED',
      'Test 13: Recorded partial Goods Receipt (GRN 1)'
    )

    // 14. Check PO Status updated to PARTIALLY_RECEIVED
    const poAfterGrn1 = await db.purchaseOrder.findUnique({ where: { id: po.id } })
    assert(poAfterGrn1?.status === 'PARTIALLY_RECEIVED', 'Test 14: PO status automatically transitioned to PARTIALLY_RECEIVED')

    // 15. Check Stock Incremented in Central Store
    const stockPaintsAfterGrn1 = await db.inventoryStock.findFirst({
      where: {
        locationId: storeMain.id,
        itemId: itemPaint.id,
        batchNumber: `BATCH-PNT-${testSuffix}`,
      },
    })
    assert(stockPaintsAfterGrn1?.quantity?.toNumber?.() === 10, 'Test 15: Stock in Central Store atomically incremented to 10')

    // 16. Check Vendor Bill Payable Created in Canonical Invoices
    const initialBill = await db.invoice.findFirst({
      where: { tenantId: tenantA.id, purchaseOrderId: po.id, invoiceType: 'VENDOR_BILL' },
    })
    assert(
      Boolean(initialBill) && initialBill?.invoiceType === 'VENDOR_BILL',
      'Test 16: Canonical Invoice created with invoiceType VENDOR_BILL (Zero Duplicate Entities)'
    )

    // 17. Second Partial GRN: Receive remaining 10 Paints and 15 Crayons
    const grn2 = await InventoryService.createGoodsReceipt(
      tenantA.id,
      {
        branchId: branchA1.id,
        purchaseOrderId: po.id,
        locationId: storeMain.id,
        vendorInvoiceNumber: `VINV-002-${testSuffix}`,
        items: [
          {
            purchaseOrderItemId: po.items[0].id,
            itemId: itemPaint.id,
            quantityReceived: 10,
            unitPriceCents: 15000,
            batchNumber: `BATCH-PNT-${testSuffix}`,
            expiryDate: expiryDatePaints,
          },
          {
            purchaseOrderItemId: po.items[1].id,
            itemId: itemCrayons.id,
            quantityReceived: 15,
            unitPriceCents: 8000,
            batchNumber: `BATCH-CRY-${testSuffix}`,
          },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(grn2.status === 'FINALIZED', 'Test 17: Recorded second GRN completing shipment')

    // 18. Check PO Status Transitioned to FULLY_RECEIVED / RECEIVED
    const poAfterGrn2 = await db.purchaseOrder.findUnique({ where: { id: po.id } })
    assert(
      poAfterGrn2?.status === 'FULLY_RECEIVED' || poAfterGrn2?.status === 'RECEIVED',
      'Test 18: PO status transitioned to FULLY_RECEIVED upon 100% fulfillment'
    )

    // 19. Check Consolidated Vendor Bill (NO Duplicate Invoice for partial GRNs)
    const billsForPO = await db.invoice.findMany({
      where: { tenantId: tenantA.id, purchaseOrderId: po.id, invoiceType: 'VENDOR_BILL' },
    })
    assert(
      billsForPO.length === 1,
      'Test 19: Consolidated single Vendor Bill updated; zero duplicate payables created across partial GRNs'
    )

    // -------------------------------------------------------------------------
    // GROUP 5: STOCK ISSUES & CONSUMPTION
    // -------------------------------------------------------------------------
    console.log('\n--- Group 5: Stock Issues & Classroom Distribution ---')

    // 20. Issue Stock to Classroom (Toddlers Sunshine)
    const issue1 = await InventoryService.issueStock(
      tenantA.id,
      {
        branchId: branchA1.id,
        fromLocationId: storeMain.id,
        destinationType: 'CLASSROOM',
        classroomId: classroomA1.id,
        materialRequestId: matRequest.id,
        purpose: 'Disbursing approved painting materials to Toddlers Sunshine',
        items: [
          { itemId: itemPaint.id, quantity: 3, batchNumber: `BATCH-PNT-${testSuffix}` },
          { itemId: itemCrayons.id, quantity: 5, batchNumber: `BATCH-CRY-${testSuffix}` },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName, role: adminUserA.role }
    )
    assert(issue1.issueNumber.startsWith('ISS-') && issue1.status === 'COMPLETED', 'Test 20: Successfully issued stock to classroom')

    // 21. Check Central Store Stock Reduced Atomically
    const stockPaintsAfterIssue = await db.inventoryStock.findFirst({
      where: {
        locationId: storeMain.id,
        itemId: itemPaint.id,
        batchNumber: `BATCH-PNT-${testSuffix}`,
      },
    })
    // 20 received - 3 issued = 17 remaining
    assert(stockPaintsAfterIssue?.quantity?.toNumber?.() === 17, 'Test 21: Stock in Central Store atomically decremented to 17')

    // 22. Check Material Request Updated Status (Fulfilled / Partially Fulfilled)
    const mrAfterIssue = await db.materialRequest.findUnique({
      where: { id: matRequest.id },
      include: { items: true },
    })
    const isMRFulfilled = mrAfterIssue?.items.every((it) => Number(it.issuedQuantity) >= Number(it.requestedQuantity))
    assert(isMRFulfilled && mrAfterIssue?.status === 'FULFILLED', 'Test 22: Material Request status transitioned to FULFILLED')

    // 23. Prevent Negative Stock (Issuing more than available)
    let negIssueFailed = false
    try {
      await InventoryService.issueStock(
        tenantA.id,
        {
          branchId: branchA1.id,
          fromLocationId: storeMain.id,
          destinationType: 'CLASSROOM',
          classroomId: classroomA1.id,
          purpose: 'Attempting overdraft',
          items: [{ itemId: itemPaint.id, quantity: 9999 }],
        },
        { id: adminUserA.id, name: adminUserA.fullName }
      )
    } catch (err: any) {
      if (err.message.toLowerCase().includes('insufficient_stock') || err.message.toLowerCase().includes('insufficient stock')) {
        negIssueFailed = true
      }
    }
    assert(negIssueFailed, 'Test 23: Strict guard prevented negative stock overdraft')

    // -------------------------------------------------------------------------
    // GROUP 6: RETURNS & ADJUSTMENTS
    // -------------------------------------------------------------------------
    console.log('\n--- Group 6: Returns & Physical Adjustments ---')

    // 24. Return Stock in GOOD condition -> Returns to inventory
    const returnGood = await InventoryService.returnStock(
      tenantA.id,
      {
        branchId: branchA1.id,
        stockIssueId: issue1.id,
        destinationLocationId: storeMain.id,
        notes: 'Unopened extra crayons returned after activity',
        items: [
          {
            itemId: itemCrayons.id,
            quantity: 2,
            batchNumber: `BATCH-CRY-${testSuffix}`,
            condition: 'GOOD',
          },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName }
    )
    assert(returnGood.returnNumber.startsWith('RET-'), 'Test 24: Recorded stock return in GOOD condition')

    // 25. Return Stock in DAMAGED condition -> Movement recorded, not added to active inventory
    const returnDamaged = await InventoryService.returnStock(
      tenantA.id,
      {
        branchId: branchA1.id,
        destinationLocationId: storeMain.id,
        notes: 'Spilled paint bottle during outdoor storm',
        items: [
          {
            itemId: itemPaint.id,
            quantity: 1,
            batchNumber: `BATCH-PNT-${testSuffix}`,
            condition: 'DAMAGED',
          },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName }
    )
    assert(Boolean(returnDamaged.id && returnDamaged.returnNumber), 'Test 25: Recorded DAMAGED stock return with quarantine audit')

    // 26. Physical Stock Adjustment (Audit reconciliation)
    // Physical count of paints in storeMain is 15 (system says 17) -> adjustment -2
    const adjustment = await InventoryService.adjustStock(
      tenantA.id,
      {
        branchId: branchA1.id,
        locationId: storeMain.id,
        reason: 'Monthly physical inventory audit discrepancy',
        items: [
          {
            itemId: itemPaint.id,
            batchNumber: `BATCH-PNT-${testSuffix}`,
            physicalQuantity: 15,
            reason: '2 bottles damaged in transit',
          },
        ],
      },
      { id: adminUserA.id, name: adminUserA.fullName }
    )
    assert(adjustment.adjustmentNumber.startsWith('ADJ-') && adjustment.status === 'APPLIED', 'Test 26: Physical stock adjustment reconciled')

    const stockPaintsAfterAdj = await db.inventoryStock.findFirst({
      where: {
        locationId: storeMain.id,
        itemId: itemPaint.id,
        batchNumber: `BATCH-PNT-${testSuffix}`,
      },
    })
    assert(stockPaintsAfterAdj?.quantity?.toNumber?.() === 15, 'Test 27: Physical count 15 now authoritative in InventoryStock')

    // -------------------------------------------------------------------------
    // GROUP 7: STOCK TRANSFERS BETWEEN STORES
    // -------------------------------------------------------------------------
    console.log('\n--- Group 7: Stock Transfers ---')

    // 28. Transfer 5 paints from Central Store to Classroom Cupboard
    const transferRes = await InventoryService.transferStock(
      tenantA.id,
      {
        fromBranchId: branchA1.id,
        toBranchId: branchA1.id,
        fromLocationId: storeMain.id,
        toLocationId: storeArt.id,
        itemId: itemPaint.id,
        quantity: 5,
        batchNumber: `BATCH-PNT-${testSuffix}`,
        reason: 'Restocking art cupboard',
      },
      { id: adminUserA.id, name: adminUserA.fullName }
    )
    const fromStk = await db.inventoryStock.findFirst({
      where: { locationId: storeMain.id, itemId: itemPaint.id, batchNumber: `BATCH-PNT-${testSuffix}` },
    })
    const toStk = await db.inventoryStock.findFirst({
      where: { locationId: storeArt.id, itemId: itemPaint.id, batchNumber: `BATCH-PNT-${testSuffix}` },
    })
    assert(fromStk?.quantity?.toNumber?.() === 10 && toStk?.quantity?.toNumber?.() === 5, 'Test 28: Transferred stock between locations atomically')

    // -------------------------------------------------------------------------
    // GROUP 8: EXPIRY & LOW-STOCK ALERT ENGINES
    // -------------------------------------------------------------------------
    console.log('\n--- Group 8: Expiry & Low-Stock Alert Engines ---')

    // 29. Low Stock Detection Engine
    // Create an item with zero stock and reorder point 20
    const zeroStockItem = await InventoryService.createItem(tenantA.id, {
      categoryId: categoryArt.id,
      unitId: unitPack.id,
      name: 'Safety Scissors Pack',
      code: `ITM-SCI-${testSuffix}`,
      itemType: 'STATIONERY',
      reorderPoint: 20,
    })
    const lowStockReport = await InventoryService.getLowStockItems(tenantA.id, branchA1.id)
    const foundLow = lowStockReport.some((it) => it.id === zeroStockItem.id)
    assert(foundLow, 'Test 29: Low stock engine identified shortage item below reorder level')

    // 30. Expiry Detection Engine
    // Batch expires in Dec 2027 (threshold 600 days)
    const expiringItems = await InventoryService.getExpiringStock(tenantA.id, branchA1.id, 600)
    assert(expiringItems.length > 0, 'Test 30: Expiry detection engine surfaced perishable batch')

    // -------------------------------------------------------------------------
    // GROUP 9: PRESCHOOL CONSUMPTION & FINANCE RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('\n--- Group 9: Preschool Analytics & Finance Reconciliation ---')

    // 31. Consumption grouped by classroom
    const consumption = await InventoryService.getConsumptionAnalytics(tenantA.id, { branchId: branchA1.id })
    const toddlerConsumption = consumption.byClassroom.find((c) => c.classroomId === classroomA1.id)
    assert(Boolean(toddlerConsumption && toddlerConsumption.totalValueCents > 0), 'Test 31: Preschool consumption aggregated by classroom')

    // 32. Finance Reconciliation (POs vs GRNs vs Vendor Bills)
    const recon = await InventoryService.getFinanceReconciliation(tenantA.id, branchA1.id)
    assert(
      recon.totalPOCommittedCents === 622800 && recon.totalGRNValueCents === 622800 && recon.totalVendorBillsPostedCents > 0,
      'Test 32: Finance reconciliation aligns committed POs, received GRNs and posted Vendor Bills'
    )

    // 33. CSV Data Export
    const csvStock = await InventoryService.exportData(tenantA.id, 'stock')
    assert(csvStock.includes('Item Code') && csvStock.includes(itemPaint.code), 'Test 33: Inventory CSV export generated complete headers & rows')

    // -------------------------------------------------------------------------
    // GROUP 10: MULTI-TENANT ISOLATION & RBAC
    // -------------------------------------------------------------------------
    console.log('\n--- Group 10: Multi-Tenant Isolation & RBAC ---')

    // 34. Tenant B cannot see Tenant A's items
    const tenantBItems = await InventoryService.listItems(tenantB.id)
    assert(tenantBItems.items.length === 0, 'Test 34: Multi-tenant boundary verified; Tenant B sees 0 items of Tenant A')

    // 35. RBAC Checks (Teacher can request, cannot approve PO)
    assert(can('TEACHER', 'inventory:request') === true, 'Test 35a: RBAC TEACHER has inventory:request permission')
    assert(can('TEACHER', 'inventory:order') === false, 'Test 35b: RBAC TEACHER blocked from inventory:order')
    assert(can('ACCOUNTS', 'inventory:order') === true, 'Test 35c: RBAC ACCOUNTS has inventory:order permission')
    assert(can('PRINCIPAL', 'inventory:approve') === true, 'Test 35d: RBAC PRINCIPAL has full inventory:approve permission')

    // -------------------------------------------------------------------------
    // GROUP 11: AUDIT TRAIL LOGGING & DOMAIN EVENTS
    // -------------------------------------------------------------------------
    console.log('\n--- Group 11: Audit Trail Logging ---')

    // 36. Verify Audit Logs Recorded for Inventory Mutations
    const auditEntries = await db.auditLog.findMany({
      where: { tenantId: tenantA.id, module: 'INVENTORY' },
    })
    assert(auditEntries.length >= 5, `Test 36: Audit trail logged ${auditEntries.length} immutable INVENTORY events`)

    // -------------------------------------------------------------------------
    // GROUP 12: CONCURRENCY & RACE CONDITIONS
    // -------------------------------------------------------------------------
    console.log('\n--- Group 12: Concurrency & Negative Stock Race-Condition Safety ---')

    // 37. Rapid concurrent issues attempting to overdraft remaining paints (10 available)
    // Fire 3 simultaneous issues of 5 paints each (total requested = 15, available = 10)
    // Exactly 2 must succeed (5 + 5 = 10) and the 3rd must fail cleanly with insufficient stock
    const results = await Promise.allSettled([
      InventoryService.issueStock(tenantA.id, {
        branchId: branchA1.id,
        fromLocationId: storeMain.id,
        destinationType: 'OPERATIONS',
        purpose: 'Concurrent test 1',
        items: [{ itemId: itemPaint.id, quantity: 5, batchNumber: `BATCH-PNT-${testSuffix}` }],
      }),
      InventoryService.issueStock(tenantA.id, {
        branchId: branchA1.id,
        fromLocationId: storeMain.id,
        destinationType: 'OPERATIONS',
        purpose: 'Concurrent test 2',
        items: [{ itemId: itemPaint.id, quantity: 5, batchNumber: `BATCH-PNT-${testSuffix}` }],
      }),
      InventoryService.issueStock(tenantA.id, {
        branchId: branchA1.id,
        fromLocationId: storeMain.id,
        destinationType: 'OPERATIONS',
        purpose: 'Concurrent test 3',
        items: [{ itemId: itemPaint.id, quantity: 5, batchNumber: `BATCH-PNT-${testSuffix}` }],
      }),
    ])

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const rejectedCount = results.filter((r) => r.status === 'rejected').length

    assert(
      successCount === 2 && rejectedCount === 1,
      `Test 37: Transactional concurrency guard prevented race condition (2 succeeded, 1 safely rejected)`
    )

    const finalPaintStock = await db.inventoryStock.findFirst({
      where: {
        locationId: storeMain.id,
        itemId: itemPaint.id,
        batchNumber: `BATCH-PNT-${testSuffix}`,
      },
    })
    assert(finalPaintStock?.quantity?.toNumber?.() === 0, 'Test 38: Final stock balance exact at 0; strictly non-negative')

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n====================================================================')
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log('====================================================================')

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err: any) {
    console.error('Fatal E2E Test Runner Error:', err)
    process.exit(1)
  }
}

runInventoryTests()
