import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const t = await p.tenant.count();
const s = await p.student.count();
const u = await p.user.count();
const i = await p.invoice.count();
console.log(`tenants=${t} students=${s} users=${u} invoices=${i}`);
await p.$disconnect();
