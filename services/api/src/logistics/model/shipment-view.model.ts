import { Location } from './location.model';
import { Product } from './product.model';
import { ShipmentStatus } from './shipment.model';
import { Supplier } from './supplier.model';

export interface ShipmentView {
  id: string;
  supplier: Supplier;
  product: Product;
  quantity: number;
  pickupLocation: Location;
  destination: Location;
  plannedRoute: string[];
  status: ShipmentStatus;
  pickupAt: Date;
  plannedDeliveryAt: Date;
}
