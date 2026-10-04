export interface DemoDriver {
  name: string;
  email: string;
  phone: string;
}

export type DemoPosition = [longitude: number, latitude: number];

export interface DemoVehicleState {
  vehicleId: string;
  driver: DemoDriver;
  routeHash: string;
  elapsedSeconds: number;
  position: DemoPosition;
  simulatedAt: Date;
  revision: number;
  updatedAt: Date;
}

export type NewDemoVehicleState = Omit<DemoVehicleState, 'updatedAt'>;

export interface DemoVehicleShipment {
  shipmentId: string;
  vehicleId: string;
}
