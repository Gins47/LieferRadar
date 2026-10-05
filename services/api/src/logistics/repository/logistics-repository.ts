import { Product } from '../model/product.model';
import { Shipment } from '../model/shipment.model';
import { Supplier } from '../model/supplier.model';

export const LOGISTICS_REPOSITORY = Symbol('LOGISTICS_REPOSITORY');

export interface LogisticsRepository {
  findAllShipments(): Promise<Shipment[]>;
  findSupplierById(id: string): Promise<Supplier | undefined>;
  findProductById(id: string): Promise<Product | undefined>;
  findShipmentById(id: string): Promise<Shipment | undefined>;
}
