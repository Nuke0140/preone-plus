import { db } from '../db'
import { Prisma } from '@prisma/client'
import { nextNumber } from '../sequence'
import { AuditService } from '../audit/audit-service'
import { emit } from '../events'
import { getDomainConfig, getInventoryConfig } from '../config'

export interface ActorContext {
  id: string
  name: string
  role?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export class InventoryService {
  // =========================================================================
  // 1. MASTER DATA: CATEGORIES
  // =========================================================================

  static async createCategory(
    tenantId: string,
    data: {
      name: string
      code: string
      description?: string
      parentCategoryId?: string
      sortOrder?: number
    },
    actor?: ActorContext
  ) {
    const code = data.code.trim().toUpperCase()
    const existing = await db.inventoryCategory.findUnique({
      where: { tenantId_code: { tenantId, code } },
    })
    if (existing) {
      throw new Error(`Category code '${code}' already exists for this tenant`)
    }

    const category = await db.inventoryCategory.create({
      data: {
        tenantId,
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        parentCategoryId: data.parentCategoryId || null,
        sortOrder: data.sortOrder ?? 0,
        createdById: actor?.id || null,
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CATEGORY_CREATED',
        entity: 'InventoryCategory',
        entityId: category.id,
        module: 'INVENTORY',
        summary: `Created inventory category '${category.name}' (${category.code})`,
        newValues: category,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        requestId: actor.requestId,
      })
    }

    return category
  }

  static async updateCategory(
    tenantId: string,
    id: string,
    data: {
      name?: string
      description?: string
      parentCategoryId?: string
      sortOrder?: number
      isActive?: boolean
    },
    actor?: ActorContext
  ) {
    const existing = await db.inventoryCategory.findFirst({
      where: { id, tenantId },
    })
    if (!existing) throw new Error('Inventory category not found')

    const updated = await db.inventoryCategory.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.parentCategoryId !== undefined ? { parentCategoryId: data.parentCategoryId || null } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedById: actor?.id || null,
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CATEGORY_UPDATED',
        entity: 'InventoryCategory',
        entityId: id,
        module: 'INVENTORY',
        summary: `Updated inventory category '${updated.name}'`,
        oldValues: existing,
        newValues: updated,
      })
    }

    return updated
  }

  static async listCategories(
    tenantId: string,
    params?: { search?: string; isActive?: boolean }
  ) {
    const where: Prisma.InventoryCategoryWhereInput = {
      tenantId,
      ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    return db.inventoryCategory.findMany({
      where,
      include: {
        parentCategory: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true, subCategories: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  // =========================================================================
  // 2. MASTER DATA: UNITS
  // =========================================================================

  static async createUnit(
    tenantId: string,
    data: {
      name: string
      code: string
      symbol: string
      decimalAllowed?: boolean
    },
    actor?: ActorContext
  ) {
    const code = data.code.trim().toUpperCase()
    const existing = await db.inventoryUnit.findUnique({
      where: { tenantId_code: { tenantId, code } },
    })
    if (existing) {
      throw new Error(`Unit code '${code}' already exists for this tenant`)
    }

    const unit = await db.inventoryUnit.create({
      data: {
        tenantId,
        name: data.name.trim(),
        code,
        symbol: data.symbol.trim(),
        decimalAllowed: data.decimalAllowed ?? false,
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_CREATED',
        entity: 'InventoryUnit',
        entityId: unit.id,
        module: 'INVENTORY',
        summary: `Created measurement unit '${unit.name}' (${unit.symbol})`,
        newValues: unit,
      })
    }

    return unit
  }

  static async updateUnit(
    tenantId: string,
    id: string,
    data: { name?: string; symbol?: string; decimalAllowed?: boolean; isActive?: boolean },
    actor?: ActorContext
  ) {
    const existing = await db.inventoryUnit.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Inventory unit not found')

    const updated = await db.inventoryUnit.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.symbol ? { symbol: data.symbol.trim() } : {}),
        ...(data.decimalAllowed !== undefined ? { decimalAllowed: data.decimalAllowed } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_UPDATED',
        entity: 'InventoryUnit',
        entityId: id,
        module: 'INVENTORY',
        summary: `Updated measurement unit '${updated.name}'`,
        oldValues: existing,
        newValues: updated,
      })
    }

    return updated
  }

  static async listUnits(tenantId: string, params?: { search?: string; isActive?: boolean }) {
    return db.inventoryUnit.findMany({
      where: {
        tenantId,
        ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
        ...(params?.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } },
                { symbol: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  // =========================================================================
  // 3. MASTER DATA: VENDORS
  // =========================================================================

  static async createVendor(
    tenantId: string,
    data: {
      name: string
      code: string
      legalName?: string
      contactPerson?: string
      email?: string
      phone?: string
      alternatePhone?: string
      address?: string
      city?: string
      state?: string
      postalCode?: string
      gstin?: string
      pan?: string
      paymentTerms?: string
      notes?: string
    },
    actor?: ActorContext
  ) {
    const code = data.code.trim().toUpperCase()
    const existing = await db.vendor.findUnique({
      where: { tenantId_code: { tenantId, code } },
    })
    if (existing) {
      throw new Error(`Vendor code '${code}' already exists for this tenant`)
    }

    const vendor = await db.vendor.create({
      data: {
        tenantId,
        name: data.name.trim(),
        code,
        legalName: data.legalName?.trim() || null,
        contactPerson: data.contactPerson?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        alternatePhone: data.alternatePhone?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        gstin: data.gstin?.trim()?.toUpperCase() || null,
        pan: data.pan?.trim()?.toUpperCase() || null,
        paymentTerms: data.paymentTerms?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'VENDOR_CREATED',
        entity: 'Vendor',
        entityId: vendor.id,
        module: 'PROCUREMENT',
        summary: `Created supplier vendor '${vendor.name}' (${vendor.code})`,
        newValues: vendor,
      })
    }

    return vendor
  }

  static async updateVendor(
    tenantId: string,
    id: string,
    data: Partial<{
      name: string
      legalName: string
      contactPerson: string
      email: string
      phone: string
      alternatePhone: string
      address: string
      city: string
      state: string
      postalCode: string
      gstin: string
      pan: string
      paymentTerms: string
      notes: string
      isActive: boolean
    }>,
    actor?: ActorContext
  ) {
    const existing = await db.vendor.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Vendor not found')

    const updated = await db.vendor.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.legalName !== undefined ? { legalName: data.legalName?.trim() || null } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson?.trim() || null } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.alternatePhone !== undefined ? { alternatePhone: data.alternatePhone?.trim() || null } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
        ...(data.state !== undefined ? { state: data.state?.trim() || null } : {}),
        ...(data.postalCode !== undefined ? { postalCode: data.postalCode?.trim() || null } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin?.trim()?.toUpperCase() || null } : {}),
        ...(data.pan !== undefined ? { pan: data.pan?.trim()?.toUpperCase() || null } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'VENDOR_UPDATED',
        entity: 'Vendor',
        entityId: id,
        module: 'PROCUREMENT',
        summary: `Updated vendor '${updated.name}'`,
        oldValues: existing,
        newValues: updated,
      })
    }

    return updated
  }

  static async listVendors(tenantId: string, params?: { search?: string; isActive?: boolean }) {
    return db.vendor.findMany({
      where: {
        tenantId,
        ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
        ...(params?.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } },
                { contactPerson: { contains: params.search, mode: 'insensitive' } },
                { phone: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { purchaseOrders: true, goodsReceipts: true, defaultItems: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  static async getVendorDetail(tenantId: string, id: string) {
    const vendor = await db.vendor.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            status: true,
            grandTotal: true,
            orderDate: true,
          },
        },
        goodsReceipts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            grnNumber: true,
            receiptDate: true,
            totalReceivedValue: true,
            status: true,
          },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalCents: true,
            paidCents: true,
            balanceCents: true,
            status: true,
          },
        },
        defaultItems: {
          select: { id: true, name: true, sku: true },
        },
      },
    })
    if (!vendor) throw new Error('Vendor not found')
    return vendor
  }

  // =========================================================================
  // 4. MASTER DATA: LOCATIONS
  // =========================================================================

  static async createLocation(
    tenantId: string,
    data: {
      branchId: string
      name: string
      code: string
      locationType?: any
      parentLocationId?: string
    },
    actor?: ActorContext
  ) {
    // Validate branch belongs to tenant
    const branch = await db.branch.findFirst({
      where: { id: data.branchId, tenantId },
    })
    if (!branch) throw new Error('Branch not found or unauthorized')

    const code = data.code.trim().toUpperCase()
    const existing = await db.inventoryLocation.findUnique({
      where: {
        tenantId_branchId_code: {
          tenantId,
          branchId: data.branchId,
          code,
        },
      },
    })
    if (existing) {
      throw new Error(`Location code '${code}' already exists in this branch`)
    }

    let locType = data.locationType || (data as any).type || 'MAIN_STORE'
    if (locType === 'CLASSROOM_STORAGE') locType = 'CLASSROOM_STORE'

    const location = await db.inventoryLocation.create({
      data: {
        tenantId,
        branchId: data.branchId,
        name: data.name.trim(),
        code,
        locationType: locType,
        parentLocationId: data.parentLocationId || null,
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        branchId: data.branchId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'LOCATION_CREATED',
        entity: 'InventoryLocation',
        entityId: location.id,
        module: 'INVENTORY',
        summary: `Created inventory storage location '${location.name}' (${location.code}) in branch '${branch.name}'`,
        newValues: location,
      })
    }

    return {
      ...location,
      type: location.locationType,
    }
  }

  static async updateLocation(
    tenantId: string,
    id: string,
    data: { name?: string; locationType?: any; parentLocationId?: string; isActive?: boolean },
    actor?: ActorContext
  ) {
    const existing = await db.inventoryLocation.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Inventory location not found')

    const updated = await db.inventoryLocation.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.locationType ? { locationType: data.locationType } : {}),
        ...(data.parentLocationId !== undefined ? { parentLocationId: data.parentLocationId || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        branchId: existing.branchId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'LOCATION_UPDATED',
        entity: 'InventoryLocation',
        entityId: id,
        module: 'INVENTORY',
        summary: `Updated inventory location '${updated.name}'`,
        oldValues: existing,
        newValues: updated,
      })
    }

    return updated
  }

  static async listLocations(
    tenantId: string,
    params?: { branchId?: string; search?: string; isActive?: boolean }
  ) {
    return db.inventoryLocation.findMany({
      where: {
        tenantId,
        ...(params?.branchId ? { branchId: params.branchId } : {}),
        ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
        ...(params?.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        parentLocation: { select: { id: true, name: true, code: true } },
        _count: { select: { stocks: true, issues: true } },
      },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    })
  }

  // =========================================================================
  // 5. MASTER DATA: ITEMS
  // =========================================================================

  static async createItem(
    tenantId: string,
    data: {
      categoryId: string
      unitId: string
      sku: string
      name: string
      description?: string
      itemType?: any
      trackStock?: boolean
      trackBatch?: boolean
      trackExpiry?: boolean
      trackSerial?: boolean
      isConsumable?: boolean
      isAsset?: boolean
      minimumStock?: number
      reorderLevel?: number
      maximumStock?: number
      defaultVendorId?: string
    },
    actor?: ActorContext
  ) {
    // Validate Category
    const category = await db.inventoryCategory.findFirst({
      where: { id: data.categoryId, tenantId },
    })
    if (!category) throw new Error('Category not found or unauthorized')

    // Validate Unit
    const unit = await db.inventoryUnit.findFirst({
      where: { id: data.unitId, tenantId },
    })
    if (!unit) throw new Error('Unit not found or unauthorized')

    // Validate default vendor if provided
    if (data.defaultVendorId) {
      const vendor = await db.vendor.findFirst({
        where: { id: data.defaultVendorId, tenantId },
      })
      if (!vendor) throw new Error('Default vendor not found or unauthorized')
    }

    const rawSku = data.sku || (data as any).code || ''
    const sku = rawSku.trim().toUpperCase()
    if (!sku) {
      throw new Error('Item SKU / code is required')
    }

    const existing = await db.inventoryItem.findUnique({
      where: { tenantId_sku: { tenantId, sku } },
    })
    if (existing) {
      throw new Error(`Item SKU '${sku}' already exists for this tenant`)
    }

    const reorderLvl = data.reorderLevel ?? (data as any).reorderPoint ?? 0

    let itemType = data.itemType || 'CONSUMABLE'
    const itemTypeMap: Record<string, string> = {
      STATIONERY: 'LEARNING_MATERIAL',
      LEARNING_KIT: 'LEARNING_MATERIAL',
      CLEANING: 'HYGIENE_SUPPLY',
      KITCHEN_PANTRY: 'FOOD_SUPPLY',
      UNIFORM: 'STUDENT_SUPPLY',
      ASSET: 'MAINTENANCE',
      EVENT_PROP: 'EVENT_MATERIAL',
    }
    if (itemTypeMap[itemType]) {
      itemType = itemTypeMap[itemType] as any
    }

    const item = await db.inventoryItem.create({
      data: {
        tenantId,
        categoryId: data.categoryId,
        unitId: data.unitId,
        sku,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        itemType: itemType as any,
        trackStock: data.trackStock ?? true,
        trackBatch: data.trackBatch ?? false,
        trackExpiry: data.trackExpiry ?? false,
        trackSerial: data.trackSerial ?? false,
        isConsumable: data.isConsumable ?? true,
        isAsset: data.isAsset ?? false,
        minimumStock: data.minimumStock ?? 0,
        reorderLevel: reorderLvl,
        maximumStock: data.maximumStock !== undefined ? data.maximumStock : null,
        defaultVendorId: data.defaultVendorId || null,
        createdById: actor?.id || null,
      },
      include: {
        category: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'ITEM_CREATED',
        entity: 'InventoryItem',
        entityId: item.id,
        module: 'INVENTORY',
        summary: `Created material item '${item.name}' (SKU: ${item.sku})`,
        newValues: item,
      })
    }

    return {
      ...item,
      code: item.sku,
    }
  }

  static async updateItem(
    tenantId: string,
    id: string,
    data: Partial<{
      categoryId: string
      unitId: string
      name: string
      description: string
      itemType: any
      trackStock: boolean
      trackBatch: boolean
      trackExpiry: boolean
      trackSerial: boolean
      isConsumable: boolean
      isAsset: boolean
      minimumStock: number
      reorderLevel: number
      maximumStock: number
      defaultVendorId: string
      isActive: boolean
    }>,
    actor?: ActorContext
  ) {
    const existing = await db.inventoryItem.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Inventory item not found')

    const updated = await db.inventoryItem.update({
      where: { id },
      data: {
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.unitId ? { unitId: data.unitId } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.itemType ? { itemType: data.itemType } : {}),
        ...(data.trackStock !== undefined ? { trackStock: data.trackStock } : {}),
        ...(data.trackBatch !== undefined ? { trackBatch: data.trackBatch } : {}),
        ...(data.trackExpiry !== undefined ? { trackExpiry: data.trackExpiry } : {}),
        ...(data.trackSerial !== undefined ? { trackSerial: data.trackSerial } : {}),
        ...(data.isConsumable !== undefined ? { isConsumable: data.isConsumable } : {}),
        ...(data.isAsset !== undefined ? { isAsset: data.isAsset } : {}),
        ...(data.minimumStock !== undefined ? { minimumStock: data.minimumStock } : {}),
        ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
        ...(data.maximumStock !== undefined ? { maximumStock: data.maximumStock } : {}),
        ...(data.defaultVendorId !== undefined ? { defaultVendorId: data.defaultVendorId || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedById: actor?.id || null,
      },
      include: {
        category: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: data.isActive === false ? 'ITEM_ARCHIVED' : 'ITEM_UPDATED',
        entity: 'InventoryItem',
        entityId: id,
        module: 'INVENTORY',
        summary: `${data.isActive === false ? 'Archived' : 'Updated'} inventory item '${updated.name}'`,
        oldValues: existing,
        newValues: updated,
      })
    }

    return updated
  }

  static async listItems(
    tenantId: string,
    params?: {
      branchId?: string
      categoryId?: string
      itemType?: string
      search?: string
      lowStock?: boolean
      isActive?: boolean
      page?: number
      pageSize?: number
    }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.InventoryItemWhereInput = {
      tenantId,
      ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params?.itemType ? { itemType: params.itemType as any } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, items] = await Promise.all([
      db.inventoryItem.count({ where }),
      db.inventoryItem.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, name: true, symbol: true } },
          defaultVendor: { select: { id: true, name: true, code: true } },
          stocks: params?.branchId ? { where: { branchId: params.branchId } } : true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
    ])

    // Calculate aggregated available stock per item
    const formatted = items.map((item) => {
      const totalAvailable = item.stocks.reduce((acc, s) => acc + Number(s.availableQuantity), 0)
      const totalPhysical = item.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)
      const totalReserved = item.stocks.reduce((acc, s) => acc + Number(s.reservedQuantity), 0)
      const isLowStock = totalAvailable <= Number(item.reorderLevel)
      const isOutOfStock = totalAvailable <= 0
      return {
        ...item,
        totalAvailable,
        totalPhysical,
        totalReserved,
        isLowStock,
        isOutOfStock,
      }
    })

    const finalItems = params?.lowStock ? formatted.filter((i) => i.isLowStock) : formatted

    return {
      items: finalItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  static async getItemDetail(tenantId: string, id: string, branchId?: string) {
    const item = await db.inventoryItem.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        unit: true,
        defaultVendor: true,
        stocks: {
          where: branchId ? { branchId } : {},
          include: {
            location: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
        movements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            fromLocation: { select: { id: true, name: true } },
            toLocation: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!item) throw new Error('Inventory item not found')

    const totalAvailable = item.stocks.reduce((acc, s) => acc + Number(s.availableQuantity), 0)
    const totalPhysical = item.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)

    return {
      ...item,
      totalAvailable,
      totalPhysical,
      isLowStock: totalAvailable <= Number(item.reorderLevel),
      isOutOfStock: totalAvailable <= 0,
    }
  }

  // =========================================================================
  // 6. PRESCHOOL MATERIAL REQUESTS (Teacher/Staff Flow)
  // =========================================================================

  static async createMaterialRequest(
    tenantId: string,
    data: {
      branchId: string
      academicSessionId?: string
      classroomId?: string
      activityId?: string
      destinationType?: any
      destinationId?: string
      requiredDate: Date | string
      priority?: any
      reason?: string
      notes?: string
      items: Array<{
        itemId: string
        requestedQuantity: number
        notes?: string
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('At least one material item is required')
    }

    // Validate branch
    const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
    if (!branch) throw new Error('Branch not found or unauthorized')

    // Validate classroom if provided
    if (data.classroomId) {
      const classroom = await db.classroom.findFirst({
        where: { id: data.classroomId, tenantId, branchId: data.branchId },
      })
      if (!classroom) throw new Error('Classroom not found in selected branch')
    }

    // Validate items belong to tenant
    const itemIds = data.items.map((i) => i.itemId)
    const items = await db.inventoryItem.findMany({
      where: { id: { in: itemIds }, tenantId, isActive: true },
    })
    if (items.length !== itemIds.length) {
      throw new Error('One or more requested items do not exist or are inactive')
    }

    for (const item of data.items) {
      const qty = item.requestedQuantity ?? (item as any).quantityRequested ?? 0
      if (qty <= 0) {
        throw new Error('Requested quantity must be greater than zero')
      }
    }

    const requestNumber = await nextNumber('material_request', tenantId)

    const rawDate = data.requiredDate || (data as any).requiredByDate || new Date()
    const parsedDate = isNaN(new Date(rawDate).getTime()) ? new Date() : new Date(rawDate)

    const request = await db.materialRequest.create({
      data: {
        tenantId,
        branchId: data.branchId,
        academicSessionId: data.academicSessionId || null,
        classroomId: data.classroomId || null,
        activityId: data.activityId || null,
        requestNumber,
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedByRole: actor.role || 'TEACHER',
        destinationType: data.destinationType || (data.classroomId ? 'CLASSROOM' : 'OPERATIONS'),
        destinationId: data.destinationId || data.classroomId || null,
        requiredDate: parsedDate,
        priority: data.priority || 'NORMAL',
        status: 'PENDING',
        reason: data.reason?.trim() || null,
        notes: data.notes?.trim() || null,
        items: {
          create: data.items.map((i: any) => ({
            itemId: i.itemId,
            requestedQuantity: i.requestedQuantity ?? i.quantityRequested ?? 1,
            notes: i.notes?.trim() || null,
          })),
        },
      },
      include: {
        items: { include: { item: { select: { id: true, name: true, sku: true } } } },
        classroom: { select: { id: true, name: true, code: true } },
      },
    })

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      academicSessionId: data.academicSessionId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'MATERIAL_REQUEST_CREATED',
      entity: 'MaterialRequest',
      entityId: request.id,
      module: 'INVENTORY',
      summary: `Teacher ${actor.name} requested ${data.items.length} material(s) for classroom (${request.requestNumber})`,
      newValues: request,
    })

    await emit({
      type: 'MaterialRequestCreated',
      tenantId,
      requestId: request.id,
      requestNumber: request.requestNumber,
      branchId: data.branchId,
      classroomId: data.classroomId,
    })

    return request
  }

  static async approveMaterialRequest(
    tenantId: string,
    id: string,
    dataOrActor?: { approvedItems?: Array<{ itemId: string; approvedQuantity: number }> } | ActorContext,
    actorParam?: ActorContext
  ) {
    let data: { approvedItems?: Array<{ itemId: string; approvedQuantity: number }> } | undefined = undefined
    let actor: ActorContext | undefined = actorParam

    if (dataOrActor && 'id' in dataOrActor && 'name' in dataOrActor) {
      actor = dataOrActor as ActorContext
    } else if (dataOrActor && 'approvedItems' in dataOrActor) {
      data = dataOrActor as { approvedItems?: Array<{ itemId: string; approvedQuantity: number }> }
    }
    const request = await db.materialRequest.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!request) throw new Error('Material request not found')
    if (request.status !== 'PENDING') {
      throw new Error(`Cannot approve request in status '${request.status}'`)
    }

    await db.$transaction(async (tx) => {
      if (data?.approvedItems && data.approvedItems.length > 0) {
        for (const appItem of data.approvedItems) {
          await tx.materialRequestItem.updateMany({
            where: { materialRequestId: id, itemId: appItem.itemId },
            data: { approvedQuantity: appItem.approvedQuantity },
          })
        }
      } else {
        // Default approvedQuantity = requestedQuantity
        for (const item of request.items) {
          await tx.materialRequestItem.update({
            where: { id: item.id },
            data: { approvedQuantity: item.requestedQuantity },
          })
        }
      }

      await tx.materialRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: actor?.id || null,
          approvedByName: actor?.name || null,
          approvedAt: new Date(),
        },
      })
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        branchId: request.branchId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'MATERIAL_REQUEST_APPROVED',
        entity: 'MaterialRequest',
        entityId: id,
        module: 'INVENTORY',
        summary: `Approved material request ${request.requestNumber}`,
      })
    }

    await emit({
      type: 'MaterialRequestApproved',
      tenantId,
      requestId: id,
      requestNumber: request.requestNumber,
    })

    return db.materialRequest.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, classroom: true },
    })
  }

  static async rejectMaterialRequest(
    tenantId: string,
    id: string,
    reason: string,
    actor: ActorContext
  ) {
    const request = await db.materialRequest.findFirst({ where: { id, tenantId } })
    if (!request) throw new Error('Material request not found')
    if (request.status !== 'PENDING') {
      throw new Error(`Cannot reject request in status '${request.status}'`)
    }

    const updated = await db.materialRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: actor.id,
        rejectedByName: actor.name,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    })

    await AuditService.record({
      tenantId,
      branchId: request.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'MATERIAL_REQUEST_REJECTED',
      entity: 'MaterialRequest',
      entityId: id,
      module: 'INVENTORY',
      summary: `Rejected material request ${request.requestNumber}: ${reason}`,
      newValues: { rejectionReason: reason },
    })

    return updated
  }

  static async listMaterialRequests(
    tenantId: string,
    params?: {
      branchId?: string
      classroomId?: string
      requestedById?: string
      status?: any
      search?: string
      page?: number
      pageSize?: number
    }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.MaterialRequestWhereInput = {
      tenantId,
      ...(params?.branchId ? { branchId: params.branchId } : {}),
      ...(params?.classroomId ? { classroomId: params.classroomId } : {}),
      ...(params?.requestedById ? { requestedById: params.requestedById } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search
        ? {
            OR: [
              { requestNumber: { contains: params.search, mode: 'insensitive' } },
              { requestedByName: { contains: params.search, mode: 'insensitive' } },
              { reason: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, requests] = await Promise.all([
      db.materialRequest.count({ where }),
      db.materialRequest.findMany({
        where,
        include: {
          items: { include: { item: { select: { id: true, name: true, sku: true } } } },
          classroom: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // =========================================================================
  // 7. PURCHASE REQUESTS (Requisitions)
  // =========================================================================

  static async createPurchaseRequest(
    tenantId: string,
    data: {
      branchId: string
      academicSessionId?: string
      sourceType?: string
      sourceId?: string
      priority?: any
      requiredBy?: Date | string
      justification?: string
      notes?: string
      items: Array<{
        itemId: string
        requestedQuantity: number
        estimatedUnitCost?: number
        notes?: string
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('At least one purchase request item is required')
    }

    const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
    if (!branch) throw new Error('Branch not found or unauthorized')

    for (const item of data.items) {
      const qty = item.requestedQuantity ?? (item as any).quantityRequested ?? 0
      if (qty <= 0) {
        throw new Error('Requested quantity must be greater than zero')
      }
    }

    const requestNumber = await nextNumber('purchase_request', tenantId)

    const pr = await db.purchaseRequest.create({
      data: {
        tenantId,
        branchId: data.branchId,
        academicSessionId: data.academicSessionId || null,
        requestNumber,
        requestedById: actor.id,
        requestedByName: actor.name,
        sourceType: data.sourceType || 'MANUAL',
        sourceId: data.sourceId || (data as any).materialRequestId || null,
        priority: data.priority || 'NORMAL',
        status: 'SUBMITTED',
        requiredBy: data.requiredBy ? new Date(data.requiredBy) : null,
        justification: data.justification?.trim() || (data as any).reason?.trim() || null,
        notes: data.notes?.trim() || null,
        items: {
          create: data.items.map((i: any) => ({
            itemId: i.itemId,
            requestedQuantity: i.requestedQuantity ?? i.quantityRequested ?? 1,
            estimatedUnitCost: i.estimatedUnitCost ?? (i.estimatedCostCents ? i.estimatedCostCents / 100 : null),
            notes: i.notes?.trim() || null,
          })),
        },
      },
      include: {
        items: { include: { item: true } },
      },
    })

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      academicSessionId: data.academicSessionId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PURCHASE_REQUEST_SUBMITTED',
      entity: 'PurchaseRequest',
      entityId: pr.id,
      module: 'PROCUREMENT',
      summary: `Submitted purchase request ${pr.requestNumber} (${pr.sourceType})`,
      newValues: pr,
    })

    await emit({
      type: 'PurchaseRequestSubmitted',
      tenantId,
      requestId: pr.id,
      requestNumber: pr.requestNumber,
      branchId: data.branchId,
    })

    return pr
  }

  static async approvePurchaseRequest(
    tenantId: string,
    id: string,
    data?: { approvedItems?: Array<{ itemId: string; approvedQuantity: number }> },
    actor?: ActorContext
  ) {
    const pr = await db.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!pr) throw new Error('Purchase request not found')
    if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
      throw new Error(`Cannot approve purchase request in status '${pr.status}'`)
    }

    await db.$transaction(async (tx) => {
      if (data?.approvedItems) {
        for (const app of data.approvedItems) {
          await tx.purchaseRequestItem.updateMany({
            where: { purchaseRequestId: id, itemId: app.itemId },
            data: { approvedQuantity: app.approvedQuantity },
          })
        }
      } else {
        for (const item of pr.items) {
          await tx.purchaseRequestItem.update({
            where: { id: item.id },
            data: { approvedQuantity: item.requestedQuantity },
          })
        }
      }

      await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: actor?.id || null,
          approvedByName: actor?.name || null,
          approvedAt: new Date(),
        },
      })
    })

    if (actor) {
      await AuditService.record({
        tenantId,
        branchId: pr.branchId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'PURCHASE_REQUEST_APPROVED',
        entity: 'PurchaseRequest',
        entityId: id,
        module: 'PROCUREMENT',
        summary: `Approved purchase request ${pr.requestNumber}`,
      })
    }

    await emit({
      type: 'PurchaseRequestApproved',
      tenantId,
      requestId: id,
      requestNumber: pr.requestNumber,
    })

    return db.purchaseRequest.findUnique({
      where: { id },
      include: { items: { include: { item: true } } },
    })
  }

  static async rejectPurchaseRequest(
    tenantId: string,
    id: string,
    reason: string,
    actor: ActorContext
  ) {
    const pr = await db.purchaseRequest.findFirst({ where: { id, tenantId } })
    if (!pr) throw new Error('Purchase request not found')
    if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
      throw new Error(`Cannot reject purchase request in status '${pr.status}'`)
    }

    const updated = await db.purchaseRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: actor.id,
        rejectedByName: actor.name,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    })

    await AuditService.record({
      tenantId,
      branchId: pr.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PURCHASE_REQUEST_REJECTED',
      entity: 'PurchaseRequest',
      entityId: id,
      module: 'PROCUREMENT',
      summary: `Rejected purchase request ${pr.requestNumber}: ${reason}`,
      newValues: { rejectionReason: reason },
    })

    return updated
  }

  static async listPurchaseRequests(
    tenantId: string,
    params?: { branchId?: string; status?: any; search?: string; page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.PurchaseRequestWhereInput = {
      tenantId,
      ...(params?.branchId ? { branchId: params.branchId } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search
        ? {
            OR: [
              { requestNumber: { contains: params.search, mode: 'insensitive' } },
              { requestedByName: { contains: params.search, mode: 'insensitive' } },
              { justification: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, requests] = await Promise.all([
      db.purchaseRequest.count({ where }),
      db.purchaseRequest.findMany({
        where,
        include: {
          items: { include: { item: { select: { id: true, name: true, sku: true } } } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // =========================================================================
  // 8. PURCHASE ORDERS (Procurement & Vendor Binding)
  // =========================================================================

  static async createPurchaseOrder(
    tenantId: string,
    data: {
      branchId: string
      academicSessionId?: string
      vendorId: string
      purchaseRequestId?: string
      expectedDeliveryDate?: Date | string
      shippingAmount?: number
      notes?: string
      terms?: string
      items: Array<{
        itemId: string
        quantity: number
        unitPrice: number
        discount?: number
        taxRate?: number
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase order must contain at least one item')
    }

    const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
    if (!branch) throw new Error('Branch not found or unauthorized')

    const vendor = await db.vendor.findFirst({ where: { id: data.vendorId, tenantId, isActive: true } })
    if (!vendor) throw new Error('Vendor not found or inactive')

    // Server-side calculation of financial lines and totals
    let subtotal = 0
    let discountAmount = 0
    let taxAmount = 0

    const computedItems = data.items.map((item: any) => {
      const rawQty = item.quantity ?? item.quantityOrdered ?? 0
      const rawPrice = item.unitPrice ?? (item.unitPriceCents !== undefined ? item.unitPriceCents / 100 : 0)
      const disc = Math.max(0, item.discount || 0)
      const taxRate = Math.max(0, item.taxRate ?? item.taxRatePercent ?? 0)

      if (rawQty <= 0) throw new Error('Quantity must be greater than zero')
      if (rawPrice < 0) throw new Error('Unit price cannot be negative')

      const qty = Number(rawQty)
      const price = Number(rawPrice)

      const lineBase = qty * price
      const lineTax = ((lineBase - disc) * taxRate) / 100
      const lineTotal = lineBase - disc + lineTax

      subtotal += lineBase
      discountAmount += disc
      taxAmount += lineTax

      return {
        itemId: item.itemId,
        quantity: qty,
        unitPrice: price,
        discount: disc,
        taxRate,
        taxAmount: Number(lineTax.toFixed(2)),
        lineTotal: Number(lineTotal.toFixed(2)),
        receivedQuantity: 0,
        pendingQuantity: qty,
      }
    })

    const shipping = Math.max(0, data.shippingAmount || 0)
    const grandTotal = Number((subtotal - discountAmount + taxAmount + shipping).toFixed(2))

    const poNumber = await nextNumber('purchase_order', tenantId)

    const po = await db.purchaseOrder.create({
      data: {
        tenantId,
        branchId: data.branchId,
        academicSessionId: data.academicSessionId || null,
        vendorId: data.vendorId,
        purchaseRequestId: data.purchaseRequestId || null,
        poNumber,
        status: 'DRAFT',
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        subtotal: Number(subtotal.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        shippingAmount: shipping,
        grandTotal,
        notes: data.notes?.trim() || null,
        terms: data.terms?.trim() || vendor.paymentTerms || null,
        createdById: actor.id,
        createdByName: actor.name,
        items: {
          create: computedItems,
        },
      },
      include: {
        vendor: true,
        items: { include: { item: true } },
      },
    })

    // If linked to purchaseRequest, mark PR as ORDERED
    if (data.purchaseRequestId) {
      await db.purchaseRequest.update({
        where: { id: data.purchaseRequestId },
        data: { status: 'ORDERED' },
      })
    }

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PURCHASE_ORDER_CREATED',
      entity: 'PurchaseOrder',
      entityId: po.id,
      module: 'PROCUREMENT',
      summary: `Created Purchase Order ${po.poNumber} for vendor '${vendor.name}' (Total: ₹${po.grandTotal})`,
      newValues: po,
    })

    return {
      ...po,
      grandTotalCents: Math.round(Number(po.grandTotal) * 100),
    }
  }

  static async approvePurchaseOrder(tenantId: string, id: string, actor: ActorContext) {
    const po = await db.purchaseOrder.findFirst({ where: { id, tenantId } })
    if (!po) throw new Error('Purchase order not found')
    if (po.status !== 'DRAFT') {
      throw new Error(`Cannot approve purchase order in status '${po.status}'`)
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: 'ISSUED',
        approvedById: actor.id,
        approvedByName: actor.name,
        approvedAt: new Date(),
      },
      include: { vendor: true, items: { include: { item: true } } },
    })

    await AuditService.record({
      tenantId,
      branchId: po.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PURCHASE_ORDER_APPROVED',
      entity: 'PurchaseOrder',
      entityId: id,
      module: 'PROCUREMENT',
      summary: `Approved Purchase Order ${po.poNumber} for vendor '${updated.vendor.name}'`,
    })

    await emit({
      type: 'PurchaseOrderApproved',
      tenantId,
      orderId: id,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
    })

    return updated
  }

  static async cancelPurchaseOrder(tenantId: string, id: string, reason: string, actor: ActorContext) {
    const po = await db.purchaseOrder.findFirst({ where: { id, tenantId } })
    if (!po) throw new Error('Purchase order not found')
    if (po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED') {
      throw new Error(`Cannot cancel purchase order with received goods`)
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledById: actor.id,
        cancelledByName: actor.name,
        cancelledAt: new Date(),
        cancellationReason: reason.trim(),
      },
    })

    await AuditService.record({
      tenantId,
      branchId: po.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PURCHASE_ORDER_CANCELLED',
      entity: 'PurchaseOrder',
      entityId: id,
      module: 'PROCUREMENT',
      summary: `Cancelled Purchase Order ${po.poNumber}: ${reason}`,
      newValues: { cancellationReason: reason },
    })

    return updated
  }

  static async listPurchaseOrders(
    tenantId: string,
    params?: { branchId?: string; vendorId?: string; status?: any; search?: string; page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(params?.branchId ? { branchId: params.branchId } : {}),
      ...(params?.vendorId ? { vendorId: params.vendorId } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search
        ? {
            OR: [
              { poNumber: { contains: params.search, mode: 'insensitive' } },
              { vendor: { name: { contains: params.search, mode: 'insensitive' } } },
              { notes: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, orders] = await Promise.all([
      db.purchaseOrder.count({ where }),
      db.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          items: { include: { item: { select: { id: true, name: true, sku: true } } } },
          goodsReceipts: { select: { id: true, grnNumber: true, status: true, totalReceivedValue: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // =========================================================================
  // 9. GOODS RECEIPT (GRN - Atomic Stock Receiving & Finance Reconciliation)
  // =========================================================================

  static async createGoodsReceipt(
    tenantId: string,
    data: {
      purchaseOrderId: string
      receiptDate?: Date | string
      notes?: string
      items: Array<{
        purchaseOrderItemId: string
        locationId: string
        receivedQuantity: number
        acceptedQuantity: number
        rejectedQuantity?: number
        unitCost?: number
        batchNumber?: string
        expiryDate?: Date | string
        serialNumber?: string
        rejectionReason?: string
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('GRN must contain at least one item')
    }

    // Load PO with items and items master data
    const po = await db.purchaseOrder.findFirst({
      where: { id: data.purchaseOrderId, tenantId },
      include: {
        vendor: true,
        items: { include: { item: true } },
      },
    })
    if (!po) throw new Error('Purchase order not found')
    if (po.status === 'CANCELLED') throw new Error('Cannot receive against a cancelled purchase order')
    if (po.status === 'FULLY_RECEIVED') throw new Error('Purchase order is already fully received')
    if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new Error(`Cannot receive goods for PO in status '${po.status}'. Must be ISSUED.`)
    }

    const cfg = getInventoryConfig(await getDomainConfig(tenantId, 'INVENTORY'))
    const grnNumber = await nextNumber('goods_receipt', tenantId)

    // Execute receiving in one single atomic transaction
    const result = await db.$transaction(async (tx) => {
      let totalReceivedValue = 0

      // Map PO items by id
      const poItemMap = new Map<string, any>(po.items.map((i: any) => [i.id, i]))

      // Validate all GRN items
      for (const grnItem of (data.items as any[])) {
        const poItem: any = poItemMap.get(grnItem.purchaseOrderItemId)
        if (!poItem) {
          throw new Error(`PO item ${grnItem.purchaseOrderItemId} does not belong to this PO`)
        }

        const received = Number(grnItem.receivedQuantity ?? grnItem.quantityReceived ?? 0)
        const accepted = Number(grnItem.acceptedQuantity ?? received)
        const rejected = Number(grnItem.rejectedQuantity ?? 0)

        grnItem.receivedQuantity = received
        grnItem.acceptedQuantity = accepted
        grnItem.rejectedQuantity = rejected
        grnItem.locationId = grnItem.locationId || (data as any).locationId

        if (received <= 0) throw new Error('Received quantity must be greater than zero')
        if (accepted + rejected > received) {
          throw new Error('Accepted + Rejected quantity cannot exceed received quantity')
        }

        const pending = Number(poItem.pendingQuantity)
        if (!cfg.allowOverReceiving && received > pending) {
          throw new Error(
            `Cannot receive ${received} units for '${poItem.item.name}'. Only ${pending} units pending.`
          )
        }

        // Validate batch/expiry tracking
        if (poItem.item.trackBatch && !grnItem.batchNumber?.trim()) {
          throw new Error(`Batch number is required for batch-tracked item '${poItem.item.name}'`)
        }
        if (poItem.item.trackExpiry && !grnItem.expiryDate) {
          throw new Error(`Expiry date is required for expiry-tracked item '${poItem.item.name}'`)
        }

        const rawCost = grnItem.unitCost ?? (grnItem.unitPriceCents !== undefined ? grnItem.unitPriceCents / 100 : Number(poItem.unitPrice))
        const cost = Number(rawCost)
        grnItem.unitCost = cost
        const taxRate = Number(poItem.taxRate || 0)
        const lineBase = accepted * cost
        const lineTax = (lineBase * taxRate) / 100
        totalReceivedValue += lineBase + lineTax
      }

      // Create GoodsReceipt header
      const grn = await tx.goodsReceipt.create({
        data: {
          tenantId,
          branchId: po.branchId,
          purchaseOrderId: po.id,
          vendorId: po.vendorId,
          grnNumber,
          receiptDate: data.receiptDate ? new Date(data.receiptDate) : new Date(),
          receivedById: actor.id,
          receivedByName: actor.name,
          status: 'FINALIZED',
          notes: data.notes?.trim() || null,
          totalReceivedValue: Number(totalReceivedValue.toFixed(2)),
        },
      })

      // Process each item: Create GRN item, update PO item, upsert InventoryStock, create StockMovement
      for (const grnItem of data.items) {
        const poItem: any = poItemMap.get(grnItem.purchaseOrderItemId)!
        const accepted = grnItem.acceptedQuantity
        const rejected = grnItem.rejectedQuantity || 0
        const cost = grnItem.unitCost !== undefined ? grnItem.unitCost : Number(poItem.unitPrice)
        const batchNumber = grnItem.batchNumber?.trim() || null
        const expiryDate = grnItem.expiryDate ? new Date(grnItem.expiryDate) : null
        const serialNumber = grnItem.serialNumber?.trim() || null

        // 1. Create GoodsReceiptItem
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: grn.id,
            purchaseOrderItemId: poItem.id,
            itemId: poItem.itemId,
            locationId: grnItem.locationId,
            orderedQuantity: poItem.quantity,
            receivedQuantity: grnItem.receivedQuantity,
            acceptedQuantity: accepted,
            rejectedQuantity: rejected,
            unitCost: cost,
            batchNumber,
            expiryDate,
            
            rejectionReason: grnItem.rejectionReason?.trim() || null,
          },
        })

        // 2. Update PO Item received & pending quantities
        const newReceivedQty = Number(poItem.receivedQuantity) + accepted
        const newPendingQty = Math.max(0, Number(poItem.quantity) - newReceivedQty)
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: newReceivedQty,
            pendingQuantity: newPendingQty,
          },
        })

        // 3. Upsert Stock and record Movement only if acceptedQuantity > 0
        if (accepted > 0) {
          // Find existing stock matching location, item, batch, serial
          const existingStock = await tx.inventoryStock.findFirst({
            where: {
              locationId: grnItem.locationId,
              itemId: poItem.itemId,
              batchNumber,
              
            },
          })

          if (existingStock) {
            const currentQty = Number(existingStock.quantity)
            const currentAvail = Number(existingStock.availableQuantity)
            const newQty = currentQty + accepted
            const newAvail = currentAvail + accepted

            // Update average cost
            const prevCost = Number(existingStock.unitCost || cost)
            const avgCost = (currentQty * prevCost + accepted * cost) / newQty

            await tx.inventoryStock.update({
              where: { id: existingStock.id },
              data: {
                quantity: newQty,
                availableQuantity: newAvail,
                unitCost: cost,
                averageCost: Number(avgCost.toFixed(2)),
                lastMovementAt: new Date(),
              },
            })
          } else {
            await tx.inventoryStock.create({
              data: {
                tenantId,
                branchId: po.branchId,
                locationId: grnItem.locationId,
                itemId: poItem.itemId,
                batchNumber,
                expiryDate,
                
                quantity: accepted,
                reservedQuantity: 0,
                availableQuantity: accepted,
                unitCost: cost,
                averageCost: cost,
                lastMovementAt: new Date(),
              },
            })
          }

          // 4. Create immutable RECEIPT StockMovement
          await tx.stockMovement.create({
            data: {
              tenantId,
              branchId: po.branchId,
              academicSessionId: po.academicSessionId,
              itemId: poItem.itemId,
              locationId: grnItem.locationId,
              movementType: 'RECEIPT',
              quantity: accepted,
              unitCost: cost,
              referenceType: 'GOODS_RECEIPT',
              referenceId: grn.id,
              batchNumber,
              expiryDate,
              
              performedById: actor.id,
              performedByName: actor.name,
              metadata: {
                poNumber: po.poNumber,
                grnNumber: grn.grnNumber,
                vendorName: po.vendor.name,
              },
            },
          })
        }
      }

      // Check PO items to see if all pendingQuantity <= 0
      const allPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      })
      const isFullyReceived = allPoItems.every((i) => Number(i.pendingQuantity) <= 0)

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: isFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED',
        },
      })

      // 5. FINANCE INTEGRATION (Consolidated Vendor Bill against PO)
      // Checks if a Vendor Bill Invoice already exists for this PO.
      // If yes, reconciles by incrementing totalCents and balanceCents (preventing duplicate invoices).
      // If no, creates the initial Vendor Bill Invoice.
      const receivedCents = Math.round(totalReceivedValue * 100)
      if (receivedCents > 0) {
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            tenantId,
            purchaseOrderId: po.id,
            invoiceType: 'VENDOR_BILL',
          },
        })

        if (existingInvoice) {
          const newSubtotal = existingInvoice.subtotalCents + receivedCents
          const newTotal = existingInvoice.totalCents + receivedCents
          const newBalance = newTotal - existingInvoice.paidCents
          await tx.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              subtotalCents: newSubtotal,
              totalCents: newTotal,
              balanceCents: newBalance,
              notes: `${existingInvoice.notes || ''} | Received against ${grnNumber} (₹${totalReceivedValue.toFixed(2)})`.trim(),
            },
          })
        } else {
          const invNumber = await nextNumber('invoice', tenantId)
          await tx.invoice.create({
            data: {
              tenantId,
              branchId: po.branchId,
              vendorId: po.vendorId,
              purchaseOrderId: po.id,
              invoiceType: 'VENDOR_BILL',
              invoiceNumber: invNumber,
              title: `Vendor Bill - ${po.poNumber} (${po.vendor.name})`,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Net 30 days
              subtotalCents: receivedCents,
              discountCents: 0,
              taxCents: 0,
              totalCents: receivedCents,
              paidCents: 0,
              balanceCents: receivedCents,
              status: 'ISSUED',
              notes: `Vendor Bill for PO ${po.poNumber} via GRN ${grnNumber}`,
              issuedById: actor.id,
              items: {
                create: {
                  feeHead: 'MATERIALS',
                  description: `Goods received against PO ${po.poNumber} (${grnNumber})`,
                  amountCents: receivedCents,
                },
              },
            },
          })
        }
      }

      return grn
    })

    await AuditService.record({
      tenantId,
      branchId: po.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'GRN_FINALIZED',
      entity: 'GoodsReceipt',
      entityId: result.id,
      module: 'PROCUREMENT',
      summary: `Finalized GRN ${result.grnNumber} against PO ${po.poNumber} (Received: ₹${result.totalReceivedValue})`,
      newValues: result,
    })

    await emit({
      type: 'GoodsReceived',
      tenantId,
      grnId: result.id,
      grnNumber: result.grnNumber,
      poId: po.id,
    })

    return db.goodsReceipt.findUnique({
      where: { id: result.id },
      include: {
        items: { include: { item: true, location: true } },
        purchaseOrder: true,
        vendor: true,
      },
    })
  }

  static async listGoodsReceipts(
    tenantId: string,
    params?: { purchaseOrderId?: string; vendorId?: string; search?: string; page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.GoodsReceiptWhereInput = {
      tenantId,
      ...(params?.purchaseOrderId ? { purchaseOrderId: params.purchaseOrderId } : {}),
      ...(params?.vendorId ? { vendorId: params.vendorId } : {}),
      ...(params?.search
        ? {
            OR: [
              { grnNumber: { contains: params.search, mode: 'insensitive' } },
              { vendor: { name: { contains: params.search, mode: 'insensitive' } } },
              { purchaseOrder: { poNumber: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [total, grns] = await Promise.all([
      db.goodsReceipt.count({ where }),
      db.goodsReceipt.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
          items: { include: { item: { select: { id: true, name: true, sku: true } }, location: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      grns,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // =========================================================================
  // 10. STOCK ISSUES (Classroom / Kitchen / Cleaning / Operations)
  // =========================================================================

  static async issueStock(
    tenantId: string,
    data: {
      branchId: string
      academicSessionId?: string
      locationId: string
      destinationType?: any
      destinationId?: string
      classroomId?: string
      studentId?: string
      materialRequestId?: string
      recipientName?: string
      notes?: string
      items: Array<{
        itemId: string
        quantity: number
        batchNumber?: string
      }>
    },
    actor?: ActorContext
  ) {
    const actorContext: ActorContext = actor || {
      id: 'system',
      name: 'System User',
      role: 'ADMIN' as any,
    }
    if (!data.items || data.items.length === 0) {
      throw new Error('Stock issue must contain at least one item')
    }

    const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
    if (!branch) throw new Error('Branch not found or unauthorized')

    const locationId = data.locationId || (data as any).fromLocationId
    if (!locationId) throw new Error('Source locationId is required')

    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, tenantId, branchId: data.branchId },
    })
    if (!location) throw new Error('Source location not found in this branch')

    const cfg = getInventoryConfig(await getDomainConfig(tenantId, 'INVENTORY'))
    const baseIssueNumber = await nextNumber('stock_issue', tenantId)
    const suffix = Math.random().toString(36).substring(2, 7).toUpperCase()
    const issueNumber = `${baseIssueNumber}-${suffix}`

    // Execute stock issue in atomic transaction with strict concurrency safety
    const issue = await db.$transaction(async (tx) => {
      // Validate all items & stock availability
      for (const item of data.items) {
        if (item.quantity <= 0) throw new Error('Issue quantity must be greater than zero')

        const itemMaster = await tx.inventoryItem.findFirst({
          where: { id: item.itemId, tenantId },
        })
        if (!itemMaster) throw new Error(`Item not found`)

        // Find available stock at location
        const stockRecord = await tx.inventoryStock.findFirst({
          where: {
            locationId,
            itemId: item.itemId,
            ...(item.batchNumber ? { batchNumber: item.batchNumber } : {}),
          },
        })

        const available = stockRecord ? Number(stockRecord.availableQuantity) : 0

        // Concurrency / negative stock guard
        if (!cfg.allowNegativeStock && available < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Only ${available} units available for '${itemMaster.name}' at ${location.name}. Requested: ${item.quantity}.`
          )
        }

        // Expiry check: Expired food/first-aid/consumables must NEVER be issued
        if (stockRecord?.expiryDate && new Date(stockRecord.expiryDate) < new Date()) {
          throw new Error(
            `EXPIRED_STOCK: Cannot issue expired item '${itemMaster.name}' (Expired on: ${stockRecord.expiryDate.toISOString().slice(0, 10)})`
          )
        }
      }

      // Create StockIssue record
      const newIssue = await tx.stockIssue.create({
        data: {
          tenantId,
          branchId: data.branchId,
          academicSessionId: data.academicSessionId || null,
          issueNumber,
          materialRequestId: data.materialRequestId || null,
          locationId,
          destinationType: data.destinationType || (data.classroomId ? 'CLASSROOM' : 'OPERATIONS'),
          destinationId: data.destinationId || data.classroomId || null,
          classroomId: data.classroomId || null,
          studentId: data.studentId || null,
          issuedById: actorContext.id,
          issuedByName: actorContext.name,
          recipientName: data.recipientName?.trim() || null,
          status: 'COMPLETED',
          notes: data.notes?.trim() || null,
        },
      })

      // Decrement stock and write StockMovement for each item
      for (const item of data.items) {
        // Atomic conditional decrement: prevents race condition overdrafts
        const updatedStockResult = await tx.$executeRaw`
          UPDATE "inventory_stocks"
          SET "quantity" = "quantity" - ${item.quantity},
              "availableQuantity" = "availableQuantity" - ${item.quantity},
              "lastMovementAt" = NOW(),
              "updatedAt" = NOW()
          WHERE "locationId" = ${locationId}
            AND "itemId" = ${item.itemId}
            ${item.batchNumber ? Prisma.sql`AND "batchNumber" = ${item.batchNumber}` : Prisma.empty}
            AND "availableQuantity" >= ${item.quantity}
        `

        if (updatedStockResult === 0) {
          throw new Error(`INSUFFICIENT_STOCK: Insufficient available quantity or concurrent modification for item ${item.itemId}`)
        }

        const stockRecord = await tx.inventoryStock.findFirst({
          where: {
            locationId,
            itemId: item.itemId,
            ...(item.batchNumber ? { batchNumber: item.batchNumber } : {}),
          },
        })

        const unitCost = stockRecord?.unitCost ? Number(stockRecord.unitCost) : null

        await tx.stockIssueItem.create({
          data: {
            stockIssueId: newIssue.id,
            itemId: item.itemId,
            quantity: item.quantity,
            unitCost,
            batchNumber: item.batchNumber || stockRecord?.batchNumber || null,
          },
        })

        // Create immutable ISSUE StockMovement
        await tx.stockMovement.create({
          data: {
            tenantId,
            branchId: data.branchId,
            academicSessionId: data.academicSessionId || null,
            itemId: item.itemId,
            locationId,
            movementType: 'ISSUE',
            quantity: item.quantity,
            unitCost,
            referenceType: 'STOCK_ISSUE',
            referenceId: newIssue.id,
            fromLocationId: locationId,
            batchNumber: item.batchNumber || stockRecord?.batchNumber || null,
            expiryDate: stockRecord?.expiryDate || null,
            performedById: actorContext.id,
            performedByName: actorContext.name,
            reason: data.notes?.trim() || `Issued to ${newIssue.destinationType}`,
            metadata: {
              issueNumber: newIssue.issueNumber,
              destinationType: newIssue.destinationType,
              destinationId: newIssue.destinationId,
              classroomId: newIssue.classroomId,
            },
          },
        })

        // Check if stock is now below reorder level -> emit alert
        const updatedStock = await tx.inventoryStock.aggregate({
          where: { tenantId, itemId: item.itemId },
          _sum: { availableQuantity: true },
        })
        const itemMaster = await tx.inventoryItem.findUnique({ where: { id: item.itemId } })
        const totalAvail = Number(updatedStock._sum.availableQuantity || 0)
        if (itemMaster && totalAvail <= Number(itemMaster.reorderLevel)) {
          await emit({
            type: 'StockBelowReorderLevel',
            tenantId,
            itemId: item.itemId,
            itemName: itemMaster.name,
            availableQuantity: totalAvail,
            reorderLevel: Number(itemMaster.reorderLevel),
          })
        }
      }

      // If linked to MaterialRequest, update issuedQuantity and request status
      if (data.materialRequestId) {
        for (const item of data.items) {
          const reqItem = await tx.materialRequestItem.findFirst({
            where: { materialRequestId: data.materialRequestId, itemId: item.itemId },
          })
          if (reqItem) {
            await tx.materialRequestItem.update({
              where: { id: reqItem.id },
              data: { issuedQuantity: Number(reqItem.issuedQuantity) + item.quantity },
            })
          }
        }

        const allReqItems = await tx.materialRequestItem.findMany({
          where: { materialRequestId: data.materialRequestId },
        })
        const allFulfilled = allReqItems.every(
          (i) => Number(i.issuedQuantity) >= Number(i.requestedQuantity)
        )
        const anyIssued = allReqItems.some((i) => Number(i.issuedQuantity) > 0)

        await tx.materialRequest.update({
          where: { id: data.materialRequestId },
          data: {
            status: allFulfilled ? 'FULFILLED' : anyIssued ? 'PARTIALLY_ISSUED' : 'PENDING',
          },
        })
      }

      return newIssue
    })

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      actorId: actorContext.id,
      actorName: actorContext.name,
      actorRole: actorContext.role,
      action: 'STOCK_ISSUED',
      entity: 'StockIssue',
      entityId: issue.id,
      module: 'INVENTORY',
      summary: `Issued ${data.items.length} item(s) from ${location.name} to ${issue.destinationType} (${issue.issueNumber})`,
      newValues: issue,
    })

    await emit({
      type: 'StockIssued',
      tenantId,
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      destinationType: issue.destinationType,
      destinationId: issue.destinationId,
    })

    return db.stockIssue.findUnique({
      where: { id: issue.id },
      include: {
        items: { include: { item: true } },
        location: true,
        classroom: true,
      },
    })
  }

  static async listStockIssues(
    tenantId: string,
    params?: {
      branchId?: string
      classroomId?: string
      destinationType?: any
      search?: string
      page?: number
      pageSize?: number
    }
  ) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 50))
    const skip = (page - 1) * pageSize

    const where: Prisma.StockIssueWhereInput = {
      tenantId,
      ...(params?.branchId ? { branchId: params.branchId } : {}),
      ...(params?.classroomId ? { classroomId: params.classroomId } : {}),
      ...(params?.destinationType ? { destinationType: params.destinationType } : {}),
      ...(params?.search
        ? {
            OR: [
              { issueNumber: { contains: params.search, mode: 'insensitive' } },
              { recipientName: { contains: params.search, mode: 'insensitive' } },
              { notes: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, issues] = await Promise.all([
      db.stockIssue.count({ where }),
      db.stockIssue.findMany({
        where,
        include: {
          items: { include: { item: { select: { id: true, name: true, sku: true } } } },
          location: { select: { id: true, name: true } },
          classroom: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      issues,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // =========================================================================
  // 11. STOCK RETURNS (Good / Damaged / Expired)
  // =========================================================================

  static async returnStock(
    tenantId: string,
    data: {
      branchId: string
      stockIssueId?: string
      destinationLocationId: string
      notes?: string
      items: Array<{
        stockIssueItemId?: string
        itemId: string
        quantity: number
        condition: 'GOOD' | 'DAMAGED' | 'EXPIRED'
        reason?: string
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Stock return must contain at least one item')
    }

    const location = await db.inventoryLocation.findFirst({
      where: { id: data.destinationLocationId, tenantId, branchId: data.branchId },
    })
    if (!location) throw new Error('Destination store location not found')

    for (const item of data.items) {
      if (item.quantity <= 0) throw new Error('Return quantity must be greater than zero')
    }

    const returnNumber = await nextNumber('stock_return', tenantId)

    const ret = await db.$transaction(async (tx) => {
      const newReturn = await tx.stockReturn.create({
        data: {
          tenantId,
          branchId: data.branchId,
          returnNumber,
          stockIssueId: data.stockIssueId || null,
          destinationLocationId: data.destinationLocationId,
          returnedById: actor.id,
          returnedByName: actor.name,
          notes: data.notes?.trim() || null,
        },
      })

      for (const item of data.items) {
        await tx.stockReturnItem.create({
          data: {
            stockReturnId: newReturn.id,
            stockIssueItemId: item.stockIssueItemId || null,
            itemId: item.itemId,
            quantity: item.quantity,
            condition: item.condition,
            reason: item.reason?.trim() || null,
          },
        })

        // Condition Handling:
        // GOOD: return to available stock + RETURN movement
        // DAMAGED: record DAMAGE movement (do not increase available stock)
        // EXPIRED: record EXPIRY movement (do not increase available stock)
        if (item.condition === 'GOOD') {
          const stock = await tx.inventoryStock.findFirst({
            where: { locationId: data.destinationLocationId, itemId: item.itemId },
          })
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                quantity: Number(stock.quantity) + item.quantity,
                availableQuantity: Number(stock.availableQuantity) + item.quantity,
                lastMovementAt: new Date(),
              },
            })
          } else {
            await tx.inventoryStock.create({
              data: {
                tenantId,
                branchId: data.branchId,
                locationId: data.destinationLocationId,
                itemId: item.itemId,
                quantity: item.quantity,
                availableQuantity: item.quantity,
                reservedQuantity: 0,
              },
            })
          }

          await tx.stockMovement.create({
            data: {
              tenantId,
              branchId: data.branchId,
              itemId: item.itemId,
              locationId: data.destinationLocationId,
              movementType: 'RETURN',
              quantity: item.quantity,
              referenceType: 'STOCK_RETURN',
              referenceId: newReturn.id,
              performedById: actor.id,
              performedByName: actor.name,
              reason: item.reason || 'Returned in good condition',
            },
          })
        } else if (item.condition === 'DAMAGED') {
          await tx.stockMovement.create({
            data: {
              tenantId,
              branchId: data.branchId,
              itemId: item.itemId,
              locationId: data.destinationLocationId,
              movementType: 'DAMAGE',
              quantity: item.quantity,
              referenceType: 'STOCK_RETURN',
              referenceId: newReturn.id,
              performedById: actor.id,
              performedByName: actor.name,
              reason: item.reason || 'Damaged stock returned',
            },
          })
        } else if (item.condition === 'EXPIRED') {
          await tx.stockMovement.create({
            data: {
              tenantId,
              branchId: data.branchId,
              itemId: item.itemId,
              locationId: data.destinationLocationId,
              movementType: 'EXPIRY',
              quantity: item.quantity,
              referenceType: 'STOCK_RETURN',
              referenceId: newReturn.id,
              performedById: actor.id,
              performedByName: actor.name,
              reason: item.reason || 'Expired stock returned',
            },
          })
        }

        // Update returned quantity on original issue item if linked
        if (item.stockIssueItemId) {
          const issueItem = await tx.stockIssueItem.findUnique({
            where: { id: item.stockIssueItemId },
          })
          if (issueItem) {
            await tx.stockIssueItem.update({
              where: { id: issueItem.id },
              data: { returnedQuantity: Number(issueItem.returnedQuantity) + item.quantity },
            })
          }
        }
      }

      return newReturn
    })

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'STOCK_RETURNED',
      entity: 'StockReturn',
      entityId: ret.id,
      module: 'INVENTORY',
      summary: `Returned ${data.items.length} item(s) to store (${ret.returnNumber})`,
      newValues: ret,
    })

    await emit({
      type: 'StockReturned',
      tenantId,
      returnId: ret.id,
      returnNumber: ret.returnNumber,
    })

    return ret
  }

  // =========================================================================
  // 12. STOCK TRANSFERS (Atomic Inter-Location Moves)
  // =========================================================================

  static async transferStock(
    tenantId: string,
    data: {
      fromBranchId: string
      toBranchId: string
      fromLocationId: string
      toLocationId: string
      itemId: string
      quantity: number
      batchNumber?: string
      reason?: string
    },
    actor: ActorContext
  ) {
    if (data.quantity <= 0) throw new Error('Transfer quantity must be greater than zero')
    if (data.fromLocationId === data.toLocationId) {
      throw new Error('Source and destination locations must be different')
    }

    const fromLoc = await db.inventoryLocation.findFirst({
      where: { id: data.fromLocationId, tenantId, branchId: data.fromBranchId },
    })
    if (!fromLoc) throw new Error('Source location not found or unauthorized')

    const toLoc = await db.inventoryLocation.findFirst({
      where: { id: data.toLocationId, tenantId, branchId: data.toBranchId },
    })
    if (!toLoc) throw new Error('Destination location not found or unauthorized')

    const item = await db.inventoryItem.findFirst({
      where: { id: data.itemId, tenantId },
    })
    if (!item) throw new Error('Item not found')

    // Atomic transaction: TRANSFER_OUT + TRANSFER_IN
    const result = await db.$transaction(async (tx) => {
      const sourceStock = await tx.inventoryStock.findFirst({
        where: {
          locationId: data.fromLocationId,
          itemId: data.itemId,
          ...(data.batchNumber ? { batchNumber: data.batchNumber } : {}),
        },
      })

      const avail = sourceStock ? Number(sourceStock.availableQuantity) : 0
      if (avail < data.quantity) {
        throw new Error(`Insufficient stock at source location. Available: ${avail}, Requested: ${data.quantity}`)
      }

      // Decrement source
      await tx.inventoryStock.update({
        where: { id: sourceStock!.id },
        data: {
          quantity: Number(sourceStock!.quantity) - data.quantity,
          availableQuantity: Number(sourceStock!.availableQuantity) - data.quantity,
          lastMovementAt: new Date(),
        },
      })

      // Increment or create destination
      const destStock = await tx.inventoryStock.findFirst({
        where: {
          locationId: data.toLocationId,
          itemId: data.itemId,
          ...(data.batchNumber ? { batchNumber: data.batchNumber } : {}),
        },
      })

      if (destStock) {
        await tx.inventoryStock.update({
          where: { id: destStock.id },
          data: {
            quantity: Number(destStock.quantity) + data.quantity,
            availableQuantity: Number(destStock.availableQuantity) + data.quantity,
            lastMovementAt: new Date(),
          },
        })
      } else {
        await tx.inventoryStock.create({
          data: {
            tenantId,
            branchId: data.toBranchId,
            locationId: data.toLocationId,
            itemId: data.itemId,
            batchNumber: data.batchNumber || null,
            expiryDate: sourceStock?.expiryDate || null,
            quantity: data.quantity,
            availableQuantity: data.quantity,
            reservedQuantity: 0,
            unitCost: sourceStock?.unitCost || null,
            averageCost: sourceStock?.averageCost || null,
          },
        })
      }

      // Record TRANSFER_OUT movement
      const outMv = await tx.stockMovement.create({
        data: {
          tenantId,
          branchId: data.fromBranchId,
          itemId: data.itemId,
          locationId: data.fromLocationId,
          movementType: 'TRANSFER_OUT',
          quantity: data.quantity,
          referenceType: 'STOCK_TRANSFER',
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          batchNumber: data.batchNumber || null,
          performedById: actor.id,
          performedByName: actor.name,
          reason: data.reason || `Transferred to ${toLoc.name}`,
        },
      })

      // Record TRANSFER_IN movement
      await tx.stockMovement.create({
        data: {
          tenantId,
          branchId: data.toBranchId,
          itemId: data.itemId,
          locationId: data.toLocationId,
          movementType: 'TRANSFER_IN',
          quantity: data.quantity,
          referenceType: 'STOCK_TRANSFER',
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          batchNumber: data.batchNumber || null,
          performedById: actor.id,
          performedByName: actor.name,
          reason: data.reason || `Transferred from ${fromLoc.name}`,
        },
      })

      return outMv
    })

    await AuditService.record({
      tenantId,
      branchId: data.fromBranchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'STOCK_TRANSFERRED',
      entity: 'StockMovement',
      entityId: result.id,
      module: 'INVENTORY',
      summary: `Transferred ${data.quantity} units of '${item.name}' from ${fromLoc.name} to ${toLoc.name}`,
    })

    await emit({
      type: 'StockTransferred',
      tenantId,
      itemId: data.itemId,
      quantity: data.quantity,
      fromLocationId: data.fromLocationId,
      toLocationId: data.toLocationId,
    } as any)

    return result
  }

  // =========================================================================
  // 13. STOCK ADJUSTMENTS (Physical Audit Reconciliation)
  // =========================================================================

  static async adjustStock(
    tenantId: string,
    data: {
      branchId: string
      locationId: string
      reason: string
      items: Array<{
        itemId: string
        physicalQuantity: number
        batchNumber?: string
        reason?: string
      }>
    },
    actor: ActorContext
  ) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Adjustment must contain at least one item')
    }

    const location = await db.inventoryLocation.findFirst({
      where: { id: data.locationId, tenantId, branchId: data.branchId },
    })
    if (!location) throw new Error('Location not found in this branch')

    const adjustmentNumber = await nextNumber('stock_adjustment', tenantId)

    const adjustment = await db.$transaction(async (tx) => {
      const adj = await tx.stockAdjustment.create({
        data: {
          tenantId,
          branchId: data.branchId,
          adjustmentNumber,
          locationId: data.locationId,
          status: 'APPLIED',
          reason: data.reason.trim(),
          requestedById: actor.id,
          requestedByName: actor.name,
          approvedById: actor.id,
          approvedByName: actor.name,
          approvedAt: new Date(),
        },
      })

      for (const item of data.items) {
        if (item.physicalQuantity < 0) {
          throw new Error('Physical quantity cannot be negative')
        }

        const stock = await tx.inventoryStock.findFirst({
          where: {
            locationId: data.locationId,
            itemId: item.itemId,
            ...(item.batchNumber ? { batchNumber: item.batchNumber } : {}),
          },
        })

        const systemQty = stock ? Number(stock.quantity) : 0
        const diff = item.physicalQuantity - systemQty

        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: adj.id,
            itemId: item.itemId,
            batchNumber: item.batchNumber || null,
            systemQuantity: systemQty,
            physicalQuantity: item.physicalQuantity,
            differenceQuantity: diff,
            reason: item.reason?.trim() || data.reason.trim(),
          },
        })

        if (diff !== 0) {
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                quantity: item.physicalQuantity,
                availableQuantity: Math.max(0, Number(stock.availableQuantity) + diff),
                lastMovementAt: new Date(),
              },
            })
          } else {
            await tx.inventoryStock.create({
              data: {
                tenantId,
                branchId: data.branchId,
                locationId: data.locationId,
                itemId: item.itemId,
                batchNumber: item.batchNumber || null,
                quantity: item.physicalQuantity,
                availableQuantity: item.physicalQuantity,
                reservedQuantity: 0,
              },
            })
          }

          // Record ADJUSTMENT_IN or ADJUSTMENT_OUT movement
          await tx.stockMovement.create({
            data: {
              tenantId,
              branchId: data.branchId,
              itemId: item.itemId,
              locationId: data.locationId,
              movementType: diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              quantity: Math.abs(diff),
              referenceType: 'STOCK_ADJUSTMENT',
              referenceId: adj.id,
              batchNumber: item.batchNumber || null,
              performedById: actor.id,
              performedByName: actor.name,
              reason: item.reason || data.reason,
            },
          })
        }
      }

      return adj
    })

    await AuditService.record({
      tenantId,
      branchId: data.branchId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'STOCK_ADJUSTED',
      entity: 'StockAdjustment',
      entityId: adjustment.id,
      module: 'INVENTORY',
      summary: `Applied stock count adjustment ${adjustment.adjustmentNumber} for ${data.items.length} item(s)`,
      newValues: adjustment,
    })

    await emit({
      type: 'StockAdjusted',
      tenantId,
      adjustmentId: adjustment.id,
      adjustmentNumber: adjustment.adjustmentNumber,
    })

    return adjustment
  }

  // =========================================================================
  // 14. ENGINES: LOW STOCK & EXPIRY ALERTS
  // =========================================================================

  static async getLowStockItems(tenantId: string, branchId?: string) {
    const items = await db.inventoryItem.findMany({
      where: { tenantId, isActive: true, trackStock: true },
      include: {
        category: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, symbol: true } },
        defaultVendor: { select: { id: true, name: true, code: true } },
        stocks: branchId ? { where: { branchId } } : true,
      },
    })

    return items
      .map((item) => {
        const available = item.stocks.reduce((sum, s) => sum + Number(s.availableQuantity), 0)
        const reorderLevel = Number(item.reorderLevel)
        const maxStock = item.maximumStock ? Number(item.maximumStock) : null
        const isLowStock = available <= reorderLevel

        // Suggested purchase quantity
        const suggestedReorder = maxStock
          ? Math.max(0, maxStock - available)
          : Math.max(0, reorderLevel * 2 - available)

        return {
          ...item,
          availableQuantity: available,
          isLowStock,
          suggestedReorderQuantity: suggestedReorder,
        }
      })
      .filter((i) => i.isLowStock)
  }

  static async getExpiringStock(tenantId: string, branchId?: string, daysThreshold?: number) {
    const cfg = getInventoryConfig(await getDomainConfig(tenantId, 'INVENTORY'))
    const days = daysThreshold ?? cfg.expiryWarningDays ?? 30
    const now = new Date()
    const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const stocks = await db.inventoryStock.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        expiryDate: { not: null },
        quantity: { gt: 0 },
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            itemType: true,
            unit: { select: { name: true, symbol: true } },
          },
        },
        location: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })

    return stocks
      .map((stock) => {
        const expiry = new Date(stock.expiryDate!)
        const isExpired = expiry < now
        const isExpiringSoon = !isExpired && expiry <= warningDate
        const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        return {
          ...stock,
          isExpired,
          isExpiringSoon,
          daysRemaining,
          status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'HEALTHY',
        }
      })
      .filter((s) => s.isExpired || s.isExpiringSoon)
  }

  // =========================================================================
  // 15. DASHBOARD KPIS & CONSUMPTION ANALYTICS
  // =========================================================================

  static async getDashboardMetrics(tenantId: string, branchId?: string) {
    const whereTenantBranch = { tenantId, ...(branchId ? { branchId } : {}) }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalMaterials,
      activeMaterials,
      pendingRequests,
      openPOs,
      pendingGRNs,
      stocks,
      monthlyReceipts,
      monthlyIssues,
      lowStockList,
      expiringList,
      recentMovements,
    ] = await Promise.all([
      db.inventoryItem.count({ where: { tenantId } }),
      db.inventoryItem.count({ where: { tenantId, isActive: true } }),
      db.materialRequest.count({ where: { ...whereTenantBranch, status: 'PENDING' } }),
      db.purchaseOrder.count({ where: { ...whereTenantBranch, status: { in: ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED'] } } }),
      db.goodsReceipt.count({ where: { ...whereTenantBranch, status: 'SUBMITTED' } }),
      db.inventoryStock.findMany({
        where: whereTenantBranch,
        select: { quantity: true, unitCost: true },
      }),
      db.stockMovement.findMany({
        where: {
          ...whereTenantBranch,
          movementType: 'RECEIPT',
          createdAt: { gte: startOfMonth },
        },
        select: { quantity: true, unitCost: true },
      }),
      db.stockMovement.findMany({
        where: {
          ...whereTenantBranch,
          movementType: 'ISSUE',
          createdAt: { gte: startOfMonth },
        },
        select: { quantity: true, unitCost: true },
      }),
      this.getLowStockItems(tenantId, branchId),
      this.getExpiringStock(tenantId, branchId),
      db.stockMovement.findMany({
        where: whereTenantBranch,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          item: { select: { name: true, sku: true } },
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      }),
    ])

    // Total valuation
    const totalValuation = stocks.reduce((acc, s) => {
      const q = Number(s.quantity)
      const c = Number(s.unitCost || 0)
      return acc + q * c
    }, 0)

    // Monthly procurement value
    const monthlyProcurementValue = monthlyReceipts.reduce((acc, m) => {
      const q = Number(m.quantity)
      const c = Number(m.unitCost || 0)
      return acc + q * c
    }, 0)

    // Monthly consumption value
    const monthlyConsumptionValue = monthlyIssues.reduce((acc, m) => {
      const q = Number(m.quantity)
      const c = Number(m.unitCost || 0)
      return acc + q * c
    }, 0)

    const expiredCount = expiringList.filter((s) => s.isExpired).length
    const expiringSoonCount = expiringList.filter((s) => s.isExpiringSoon).length

    return {
      kpis: {
        totalMaterials,
        activeMaterials,
        lowStockCount: lowStockList.length,
        outOfStockCount: lowStockList.filter((i) => i.availableQuantity <= 0).length,
        expiringSoonCount,
        expiredCount,
        pendingRequests,
        openPOs,
        pendingGRNs,
        totalValuation: Number(totalValuation.toFixed(2)),
        monthlyProcurementValue: Number(monthlyProcurementValue.toFixed(2)),
        monthlyConsumptionValue: Number(monthlyConsumptionValue.toFixed(2)),
      },
      alerts: {
        lowStock: lowStockList.slice(0, 10),
        expiring: expiringList.slice(0, 10),
      },
      recentMovements,
    }
  }

  static async getConsumptionAnalytics(
    tenantId: string,
    params?: {
      branchId?: string
      classroomId?: string
      categoryId?: string
      fromDate?: Date | string
      toDate?: Date | string
    }
  ) {
    const from = params?.fromDate ? new Date(params.fromDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const to = params?.toDate ? new Date(params.toDate) : new Date()

    const movements = await db.stockMovement.findMany({
      where: {
        tenantId,
        movementType: 'ISSUE',
        createdAt: { gte: from, lte: to },
        ...(params?.branchId ? { branchId: params.branchId } : {}),
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
            unit: { select: { symbol: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
    })

    // Grouping by Classroom, Destination, Category, and Item
    const byClassroom: Record<string, { classroomId: string; name: string; classroomName?: string; count: number; value: number; totalValueCents: number }> = {}
    const byDestination: Record<string, { count: number; value: number }> = {}
    const byCategory: Record<string, { name: string; count: number; value: number }> = {}
    const byItem: Record<string, { name: string; sku: string; count: number; unit: string }> = {}

    for (const m of movements) {
      const meta = m.metadata as Record<string, any> | null
      const classroomId = meta?.classroomId || 'UNASSIGNED'
      const destType = meta?.destinationType || 'OTHER'
      const catName = m.item.category?.name || 'Uncategorized'
      const qty = Number(m.quantity)
      const cost = Number(m.unitCost || 0)
      const lineVal = qty * cost

      // By Classroom
      if (meta?.classroomId) {
        if (!byClassroom[classroomId]) {
          byClassroom[classroomId] = {
            classroomId,
            name: `Classroom ${classroomId}`,
            classroomName: `Classroom ${classroomId}`,
            count: 0,
            value: 0,
            totalValueCents: 0,
          }
        }
        byClassroom[classroomId].count += qty
        byClassroom[classroomId].value += lineVal
        byClassroom[classroomId].totalValueCents += Math.round(lineVal * 100)
      }

      // By Destination
      if (!byDestination[destType]) {
        byDestination[destType] = { count: 0, value: 0 }
      }
      byDestination[destType].count += qty
      byDestination[destType].value += lineVal

      // By Category
      if (!byCategory[catName]) {
        byCategory[catName] = { name: catName, count: 0, value: 0 }
      }
      byCategory[catName].count += qty
      byCategory[catName].value += lineVal

      // By Item
      if (!byItem[m.itemId]) {
        byItem[m.itemId] = {
          name: m.item.name,
          sku: m.item.sku,
          count: 0,
          unit: m.item.unit.symbol,
        }
      }
      byItem[m.itemId].count += qty
    }

    return {
      period: { from, to },
      totalMovements: movements.length,
      byClassroom: Object.values(byClassroom),
      byDestination: Object.entries(byDestination).map(([destinationType, val]) => ({
        destinationType,
        count: val.count,
        value: val.value,
        totalValueCents: Math.round(val.value * 100),
      })),
      byCategory: Object.values(byCategory),
      topItems: Object.values(byItem).sort((a, b) => b.count - a.count).slice(0, 15),
    }
  }

  // =========================================================================
  // 16. FINANCE RECONCILIATION
  // =========================================================================

  static async getFinanceReconciliation(tenantId: string, branchId?: string) {
    const whereTenantBranch = { tenantId, ...(branchId ? { branchId } : {}) }

    const [pos, grns, bills] = await Promise.all([
      db.purchaseOrder.findMany({
        where: { ...whereTenantBranch, status: { not: 'CANCELLED' } },
        select: { grandTotal: true, status: true },
      }),
      db.goodsReceipt.findMany({
        where: { ...whereTenantBranch, status: 'FINALIZED' },
        select: { totalReceivedValue: true },
      }),
      db.invoice.findMany({
        where: { ...whereTenantBranch, invoiceType: 'VENDOR_BILL' },
        select: { totalCents: true, paidCents: true, balanceCents: true, status: true },
      }),
    ])

    const totalPoAmount = pos.reduce((sum, p) => sum + Number(p.grandTotal), 0)
    const totalReceivedValue = grns.reduce((sum, g) => sum + Number(g.totalReceivedValue), 0)
    const totalBilledValue = bills.reduce((sum, b) => sum + b.totalCents / 100, 0)
    const totalPaidValue = bills.reduce((sum, b) => sum + b.paidCents / 100, 0)
    const totalUnpaidBalance = bills.reduce((sum, b) => sum + b.balanceCents / 100, 0)

    const totalPOCommittedCents = Math.round(totalPoAmount * 100)
    const totalGRNValueCents = Math.round(totalReceivedValue * 100)
    const totalVendorBillsPostedCents = Math.round(totalBilledValue * 100)
    const vendorPayableBalanceCents = Math.round(totalUnpaidBalance * 100)

    return {
      totalPoAmount: Number(totalPoAmount.toFixed(2)),
      totalReceivedValue: Number(totalReceivedValue.toFixed(2)),
      totalBilledValue: Number(totalBilledValue.toFixed(2)),
      totalPaidValue: Number(totalPaidValue.toFixed(2)),
      totalUnpaidBalance: Number(totalUnpaidBalance.toFixed(2)),
      totalPOCommittedCents,
      totalGRNValueCents,
      totalVendorBillsPostedCents,
      vendorPayableBalanceCents,
      orderedNotReceived: Math.max(0, totalPoAmount - totalReceivedValue),
      receivedNotBilled: Math.max(0, totalReceivedValue - totalBilledValue),
      billedNotPaid: totalUnpaidBalance,
    }
  }

  // =========================================================================
  // 17. CSV EXPORT
  // =========================================================================

  static async exportData(
    tenantId: string,
    type: 'stock' | 'movements' | 'procurement' | 'consumption',
    actor?: ActorContext
  ): Promise<string> {
    let csv = ''

    if (type === 'stock') {
      const stocks = await db.inventoryStock.findMany({
        where: { tenantId },
        include: {
          item: { include: { category: true, unit: true } },
          location: true,
          branch: true,
        },
        orderBy: { item: { name: 'asc' } },
      })

      csv = 'Item Code,Item Name,SKU,Category,Branch,Location,Batch,Expiry,Quantity,Reserved,Available,Unit,Unit Cost\n'
      for (const s of stocks) {
        csv += `"${s.item.sku}","${s.item.name}","${s.item.sku}","${s.item.category.name}","${s.branch.name}","${s.location.name}","${s.batchNumber || ''}","${s.expiryDate ? s.expiryDate.toISOString().slice(0, 10) : ''}",${s.quantity},${s.reservedQuantity},${s.availableQuantity},"${s.item.unit.symbol}",${s.unitCost || 0}\n`
      }
    } else if (type === 'movements') {
      const movements = await db.stockMovement.findMany({
        where: { tenantId },
        include: { item: true, branch: true },
        take: 1000,
        orderBy: { createdAt: 'desc' },
      })

      csv = 'Date,Branch,Item,SKU,Movement Type,Quantity,Unit Cost,Reference,Performed By,Reason\n'
      for (const m of movements) {
        csv += `"${m.createdAt.toISOString().slice(0, 19)}","${m.branch.name}","${m.item.name}","${m.item.sku}","${m.movementType}",${m.quantity},${m.unitCost || 0},"${m.referenceType || ''}","${m.performedByName || ''}","${m.reason || ''}"\n`
      }
    }

    if (actor) {
      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'INVENTORY_EXPORTED',
        entity: 'Report',
        module: 'INVENTORY',
        summary: `Exported inventory ${type} data as CSV`,
      })
    }

    return csv
  }
}
