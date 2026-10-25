// users/{uid}/purchases (v1's old shop, B14; docs/v2/INVENTORY.md: description,
// amount int or float złoty, pointsCost int, timestamp). Read-only: nothing in v2
// writes purchases.
import type { DocumentData } from 'firebase/firestore';
import type { Purchase } from '@/domain/parent';
import { groszeFromZloty } from '@/lib/money';
import { dateOrNull, numberOr, stringOr } from './fields';

export function purchaseFromData(id: string, data: DocumentData): Purchase {
  return {
    id,
    description: stringOr(data.description).trim(),
    grosze: groszeFromZloty(numberOr(data.amount)),
    pointsCost: numberOr(data.pointsCost),
    at: dateOrNull(data.timestamp),
  };
}
