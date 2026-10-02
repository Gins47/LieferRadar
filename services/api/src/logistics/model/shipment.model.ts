import { Location } from './location.model';

export type ShipmentStatus =
  'PLANNED' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED' | 'CANCELLED';

export interface Shipment {
  id: string;
  supplierId: string;
  productId: string;
  quantity: number;
  pickupLocation: Location;
  destination: Location;
  plannedRoute: string[];
  status: ShipmentStatus;
  pickupAt: Date;
  plannedDeliveryAt: Date;
}
